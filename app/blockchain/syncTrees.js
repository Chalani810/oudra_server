// path: oudra-server/blockchain/syncTrees.js
const { ethers } = require("ethers");
const Tree = require("../models/TreeModel");
require("dotenv").config();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Tuning knobs ─────────────────────────────────────────────────────────────
const BATCH_LIMIT      = 10;              // Smaller batch — easier on free-tier RPC
const TX_TIMEOUT_MS    = 10 * 60 * 1000; // 10 min max wait per tx
const POLL_INTERVAL_MS = 15_000;          // Poll every 15 s — saves ~75% of RPC calls vs 5s
const INTER_TX_DELAY   = 8_000;           // 8 s between txs — stays under rate limit
const MAX_RETRIES      = 2;              // 2 retries max (3 attempts total)
const GAS_MULTIPLIER   = 120n;            // 2× network price — aggressive but safe on testnet

// ── Mutex: prevent two sync jobs running at the same time ───────────────────
// This is the #1 cause of nonce collisions and "could not replace tx" errors.
let syncInProgress = false;

// ── Full ABI inline ──────────────────────────────────────────────────────────
const AGARWOOD_ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "_id",     "type": "string" },
      { "internalType": "string", "name": "_gps",    "type": "string" },
      { "internalType": "string", "name": "_status", "type": "string" }
    ],
    "name": "enrollTree",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "_id",        "type": "string" },
      { "internalType": "string", "name": "_newStatus", "type": "string" }
    ],
    "name": "updateTreeStatus",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "string", "name": "_id",       "type": "string" },
      { "internalType": "string", "name": "_certHash", "type": "string" }
    ],
    "name": "verifyHarvest",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "name": "treeRegistry",
    "outputs": [
      { "internalType": "string",  "name": "treeId",      "type": "string"  },
      { "internalType": "string",  "name": "gpsCoords",   "type": "string"  },
      { "internalType": "string",  "name": "status",      "type": "string"  },
      { "internalType": "string",  "name": "certHash",    "type": "string"  },
      { "internalType": "uint256", "name": "lastUpdated", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "name": "allTreeIds",
    "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "string", "name": "treeId",   "type": "string" },
      { "indexed": false, "internalType": "string", "name": "status",   "type": "string" },
      { "indexed": false, "internalType": "string", "name": "certHash", "type": "string" }
    ],
    "name": "TreeUpdated",
    "type": "event"
  }
];

// ── Build provider ────────────────────────────────────────────────────────────
// Plain JsonRpcProvider (not FallbackProvider) so ethers doesn't multiply
// calls across all providers and burn through the free-tier rate limit.
function buildProvider(primaryRpc) {
  return new ethers.JsonRpcProvider(primaryRpc, undefined, {
    staticNetwork: true,   // skip eth_chainId on every call
    batchMaxCount: 1,      // one call at a time — avoids burst rate limiting
  });
}

// Public fallback used only when the primary RPC fails to broadcast a tx
const FALLBACK_RPC = "https://rpc-amoy.polygon.technology";

async function sendViaFallback(signedTx) {
  const fallback = new ethers.JsonRpcProvider(FALLBACK_RPC);
  return fallback.broadcastTransaction(signedTx);
}

// ── Poll for receipt with per-call error tolerance ───────────────────────────
async function waitForReceipt(provider, txHash, label) {
  const startMs  = Date.now();
  const deadline = startMs + TX_TIMEOUT_MS;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);

    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if (receipt) {
        if (receipt.status === 0) throw new Error("Transaction reverted on-chain");
        return receipt;
      }
    } catch (err) {
      if (err.message.includes("reverted")) throw err; // fatal
      console.warn(`   ⚠️  RPC poll error (retrying): ${err.message.slice(0, 80)}`);
    }

    const elapsed = Math.round((Date.now() - startMs) / 1000);
    console.log(`   ⏳ Still waiting for ${label}... (${elapsed}s elapsed)`);
  }

  throw new Error(`TIMEOUT — tx ${txHash} not confirmed within ${TX_TIMEOUT_MS / 60000} min`);
}

// ── Enroll one tree, with retries and gas bumping ────────────────────────────
async function enrollWithRetry(wallet, contract, provider, tree, baseGasPrice, nonce) {
  const gpsStr   = `${tree.gps.lat},${tree.gps.lng}`;
  const attempts = MAX_RETRIES + 1;
  let   lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    // 2× on attempt 1, 2.4× on attempt 2, 2.8× on attempt 3
    const bumpFactor = GAS_MULTIPLIER + BigInt((attempt - 1) * 40);
    const gasPrice   = (baseGasPrice * bumpFactor) / 100n;
    const gweiStr    = ethers.formatUnits(gasPrice, "gwei");

    try {
      if (attempt === 1) {
        console.log(`   ⛽ Gas: ${gweiStr} gwei (${Number(bumpFactor)}% of network price, nonce: ${nonce})`);
      } else {
        console.log(`   🔁 Retry ${attempt}/${attempts} — gas: ${gweiStr} gwei, nonce: ${nonce}`);
        await sleep(5_000);
      }

      // Sign locally so we can re-broadcast via fallback if Alchemy drops the call
      const populatedTx = await contract.enrollTree.populateTransaction(
        tree.treeId, gpsStr, tree.lifecycleStatus
      );
      populatedTx.gasPrice = gasPrice;
      populatedTx.nonce    = nonce;
      populatedTx.gasLimit = 200_000n;
      populatedTx.chainId  = 80002n;

      const signedTx = await wallet.signTransaction(populatedTx);
      let   tx;

      try {
        tx = await provider.broadcastTransaction(signedTx);
      } catch (broadcastErr) {
        const msg = broadcastErr.message || "";

        if (msg.includes("could not replace") || msg.includes("replacement transaction")) {
          // Gas bump was not enough — check if tree already landed
          const existing = await contract.treeRegistry(tree.treeId).catch(() => null);
          if (existing?.treeId?.length > 0) {
            console.log(`   ✅ Tree is already on chain (confirmed while retrying)`);
            return { alreadyOnChain: true };
          }
          throw broadcastErr;
        }

        // Primary RPC dropped the send — try fallback
        console.warn(`   ⚠️  Primary broadcast failed, trying fallback: ${msg.slice(0, 80)}`);
        tx = await sendViaFallback(signedTx);
      }

      console.log(`   📤 Tx: ${tx.hash}`);
      console.log(`   🔍 https://amoy.polygonscan.com/tx/${tx.hash}`);

      const receipt = await waitForReceipt(provider, tx.hash, tree.treeId);
      return receipt;

    } catch (err) {
      lastError = err;
      const msg = err.message || "";

      if (
        msg.includes("reverted") ||
        msg.includes("INSUFFICIENT_FUNDS") ||
        msg.includes("nonce too low")
      ) throw err;

      console.warn(`   ⚠️  Attempt ${attempt} failed: ${msg.slice(0, 120)}`);
    }
  }

  throw lastError;
}

// ── Public entry point (with mutex) ─────────────────────────────────────────
async function enrollExistingTrees(contractAddress) {
  if (syncInProgress) {
    console.warn("⛔ Sync already in progress — ignoring duplicate request");
    return { successCount: 0, failCount: 0, skippedCount: 0, alreadyRunning: true };
  }
  syncInProgress = true;
  try {
    return await _enrollExistingTrees(contractAddress);
  } finally {
    syncInProgress = false;
  }
}

// ── Core sync logic ──────────────────────────────────────────────────────────
async function _enrollExistingTrees(contractAddress) {
  console.log("\n🔗 Connecting to blockchain network...");
  console.log(`📡 RPC:      ${process.env.BLOCKCHAIN_RPC_URL}`);
  console.log(`📄 Contract: ${contractAddress}`);

  if (!process.env.BLOCKCHAIN_RPC_URL)     throw new Error("BLOCKCHAIN_RPC_URL missing from .env");
  if (!process.env.BLOCKCHAIN_PRIVATE_KEY) throw new Error("BLOCKCHAIN_PRIVATE_KEY missing from .env");
  if (!contractAddress)                    throw new Error("Contract address is missing");

  if (contractAddress === "0x5FbDB2315678afecb367f032d93F642f64180aa3")
    throw new Error("Contract address is the Hardhat localhost default. Deploy to Amoy first.");

  const provider = buildProvider(process.env.BLOCKCHAIN_RPC_URL);

  try {
    const network = await provider.getNetwork();
    console.log(`✅ Network: ${network.name} (chainId: ${network.chainId})`);
    if (network.chainId === 137n)
      throw new Error("Connected to Polygon MAINNET — use Amoy testnet.");
    if (network.chainId !== 80002n && network.chainId !== 31337n)
      throw new Error(`Unexpected chainId: ${network.chainId}. Expected 80002 or 31337.`);
    console.log(network.chainId === 31337n ? "🖥️  localhost" : "🌐 Amoy testnet");
  } catch (err) {
    if (err.message.includes("MAINNET") || err.message.includes("Unexpected chainId")) throw err;
    throw new Error(`Cannot reach RPC at ${process.env.BLOCKCHAIN_RPC_URL}. Check your Alchemy key.`);
  }

  const wallet = new ethers.Wallet(process.env.BLOCKCHAIN_PRIVATE_KEY, provider);
  console.log(`👛 Wallet: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Balance: ${ethers.formatEther(balance)} POL`);
  if (balance === 0n)
    throw new Error("Wallet balance is zero. Get testnet POL from https://faucet.polygon.technology");

  const contract = new ethers.Contract(contractAddress, AGARWOOD_ABI, wallet);
  console.log("📃 Contract loaded\n");

  const totalPending = await Tree.countDocuments({ blockchainStatus: { $ne: "Verified" } });
  const trees = await Tree.find({ blockchainStatus: { $ne: "Verified" } })
    .sort({ treeId: 1 })
    .limit(BATCH_LIMIT);

  console.log(`🌳 Trees pending sync: ${totalPending} total, syncing ${trees.length} this batch`);
  if (trees.length === 0) {
    console.log("✅ All trees already verified on blockchain.");
    return { successCount: 0, failCount: 0, skippedCount: 0 };
  }
  
  let baseGasPrice;
  try {
    const gsRes = await fetch("https://gasstation.polygon.technology/amoy");
    const gsData = await gsRes.json();
    const fastGwei = gsData.fast.maxFee;
    baseGasPrice = BigInt(Math.ceil(fastGwei * 1e9));
    console.log(`⛽ Gas station price (fast): ${fastGwei} gwei`);
    console.log(`   (txs will bid ${Number(GAS_MULTIPLIER)}% of this, +40% per retry)\n`);
  } catch {
    baseGasPrice = 50_000_000_000n;
    console.log("⛽ Using fallback gas price: 50 gwei\n");
  }

  let nonce = await provider.getTransactionCount(wallet.address, "pending");
  console.log(`🔢 Starting nonce: ${nonce}\n`);

  let successCount = 0;
  let failCount    = 0;
  let skippedCount = 0;

  for (let i = 0; i < trees.length; i++) {
    const tree = trees[i];
    try {
      console.log(`⏳ Enrolling: ${tree.treeId} (${i + 1}/${trees.length})`);

      if (!tree.treeId)
        throw new Error("Tree is missing treeId");
      if (!tree.gps || tree.gps.lat === undefined || tree.gps.lng === undefined)
        throw new Error("Missing GPS data");
      if (!tree.lifecycleStatus)
        throw new Error("Missing lifecycleStatus");

      const existing = await contract.treeRegistry(tree.treeId);
      if (existing.treeId && existing.treeId.length > 0) {
        console.log(`⏩ ${tree.treeId} already on chain — marking as Verified\n`);
        tree.blockchainStatus = "Verified";
        await tree.save();
        skippedCount++;
        continue;
      }

      const result = await enrollWithRetry(wallet, contract, provider, tree, baseGasPrice, nonce);

      if (result.alreadyOnChain) {
        tree.blockchainStatus = "Verified";
        await tree.save();
        skippedCount++;
      } else {
        console.log(`   ✅ Confirmed block: ${result.blockNumber}`);
        tree.blockchainStatus = "Verified";
        tree.blockchainTxHash = result.hash;
        await tree.save();
        console.log(`   💾 MongoDB updated\n`);
        successCount++;
      }

      nonce++;

      if (i < trees.length - 1) {
        console.log(`   ⏸️  Waiting ${INTER_TX_DELAY / 1000}s before next tx...\n`);
        await sleep(INTER_TX_DELAY);
      }

    } catch (error) {
      console.error(`   ❌ Failed (${tree.treeId}): ${error.message}\n`);
      failCount++;

      try {
        const freshNonce = await provider.getTransactionCount(wallet.address, "pending");
        console.log(`   🔢 Nonce refreshed to ${freshNonce} after failure`);
        nonce = freshNonce;
      } catch {
        nonce++;
      }

      await sleep(5_000);
    }
  }

  const remaining = totalPending - successCount - skippedCount;

  console.log("══════════════════════════════════════");
  console.log("📊 Sync complete:");
  console.log(`   ✅ Enrolled:  ${successCount}`);
  console.log(`   ⏩ Skipped:   ${skippedCount} (already on chain)`);
  console.log(`   ❌ Failed:    ${failCount}`);
  console.log(`   🔄 Remaining: ${remaining} (run sync again to continue)`);
  console.log("══════════════════════════════════════\n");

  return { successCount, failCount, skippedCount, remaining };
}

module.exports = { enrollExistingTrees };