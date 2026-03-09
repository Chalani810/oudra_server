// oudra-server/syncAllTrees.js
// Syncs ALL unverified trees to Polygon Amoy
// Usage: node syncAllTrees.js

require("dotenv").config();
const mongoose   = require("mongoose");
const { ethers } = require("ethers");

const MONGO_URI     = process.env.MONGO_URI || process.env.MONGODB_URI;
const RPC_URL       = process.env.BLOCKCHAIN_RPC_URL;
const PRIVATE_KEY   = process.env.BLOCKCHAIN_PRIVATE_KEY;
const CONTRACT_ADDR = process.env.AGARWOOD_REGISTRY_ADDRESS || process.env.CONTRACT_ADDRESS;

const ABI = [
  "function enrollTree(string treeId, string nfcTagId, int256 lat, int256 lng, uint256 plantedDate) external",
  "function treeRegistry(string) external view returns (string treeId, string nfcTagId, int256 lat, int256 lng, uint256 plantedDate, uint8 status, uint256 enrolledAt, address enrolledBy)",
];

const TreeSchema = new mongoose.Schema({
  treeId:           String,
  nfcTagId:         String,
  plantedDate:      Date,
  block:            String,
  gps:              { lat: Number, lng: Number },
  healthStatus:     String,
  lifecycleStatus:  String,
  blockchainStatus: { type: String, default: "Unverified" },
  blockchainTxHash: String,
}, { timestamps: true, strict: false });

const Tree = mongoose.models.Tree || mongoose.model("Tree", TreeSchema);

const sleep    = (ms) => new Promise((r) => setTimeout(r, ms));
const toFixed6 = (val) => {
  if (!val && val !== 0) return 0n;
  return BigInt(Math.round(parseFloat(val) * 1_000_000));
};

async function main() {
  console.log("=".repeat(60));
  console.log("  Oudra — Sync ALL Trees to Polygon Amoy");
  console.log("=".repeat(60));

  if (!MONGO_URI)     { console.error("❌ MONGO_URI not set");              process.exit(1); }
  if (!RPC_URL)       { console.error("❌ BLOCKCHAIN_RPC_URL not set");     process.exit(1); }
  if (!PRIVATE_KEY)   { console.error("❌ BLOCKCHAIN_PRIVATE_KEY not set"); process.exit(1); }
  if (!CONTRACT_ADDR) { console.error("❌ CONTRACT ADDRESS not set");       process.exit(1); }

  console.log("\n📦 Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("✅ MongoDB connected");

  console.log("\n🔗 Connecting to Polygon Amoy...");
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);
  const contract = new ethers.Contract(CONTRACT_ADDR, ABI, wallet);

  const network = await provider.getNetwork();
  const balance = await provider.getBalance(wallet.address);

  console.log(`   Network  : ${network.name} (chainId: ${network.chainId})`);
  console.log(`   Wallet   : ${wallet.address}`);
  console.log(`   Balance  : ${ethers.formatEther(balance)} POL`);
  console.log(`   Contract : ${CONTRACT_ADDR}`);

  if (balance === 0n) {
    console.error("\n❌ Wallet has 0 POL.");
    process.exit(1);
  }

  // ── Fetch ALL unverified trees (no limit) ─────────────────────
  console.log("\n🌳 Fetching all unverified trees...");
  const trees = await Tree.find({ blockchainStatus: { $ne: "Verified" } })
    .sort({ treeId: 1 })
    .limit(25)
    .lean();

  if (trees.length === 0) {
    console.log("✅ All trees already verified — nothing to sync!");
    await mongoose.disconnect();
    process.exit(0);
  }

  console.log(`   Found ${trees.length} trees to sync\n`);

  // ── Cost estimate ─────────────────────────────────────────────
  const feeData  = await provider.getFeeData();
  const gasPrice = feeData.gasPrice * 10n;
  const estCost  = ethers.formatEther(gasPrice * 300_000n * BigInt(trees.length));

  console.log(`⛽ Base gas   : ${ethers.formatUnits(feeData.gasPrice, "gwei")} gwei`);
  console.log(`⛽ Using      : ${ethers.formatUnits(gasPrice, "gwei")} gwei (10x)`);
  console.log(`💰 Est. cost  : ~${estCost} POL for ${trees.length} trees`);
  console.log(`💰 Balance    : ${ethers.formatEther(balance)} POL`);

  if (parseFloat(estCost) > parseFloat(ethers.formatEther(balance))) {
    console.error(`\n❌ Insufficient balance! Need ~${estCost} POL but only have ${ethers.formatEther(balance)} POL`);
    process.exit(1);
  }

  console.log(`\n✅ Balance sufficient. Starting sync...\n`);

  // ── Always use confirmed nonce ────────────────────────────────
  let nonce = await provider.getTransactionCount(wallet.address, "latest");
  console.log(`🔢 Starting nonce: ${nonce}\n`);
  console.log("─".repeat(60));

  let successCount = 0;
  let skipCount    = 0;
  let failCount    = 0;
  const failed     = []; // track which trees failed

  for (let i = 0; i < trees.length; i++) {
    const tree = trees[i];
    const num  = `[${i + 1}/${trees.length}]`;

    process.stdout.write(`${num} ${tree.treeId}... `);

    try {
      const treeId    = tree.treeId   || `TREE-${i}`;
      const nfcTagId  = tree.nfcTagId || `NFC-${treeId}`;
      const lat       = toFixed6(tree.gps?.lat);
      const lng       = toFixed6(tree.gps?.lng);
      const plantedTs = tree.plantedDate
        ? BigInt(Math.floor(new Date(tree.plantedDate).getTime() / 1000))
        : BigInt(Math.floor(Date.now() / 1000));

      // Check if already on chain
      try {
        const existing = await contract.treeRegistry(treeId);
        if (existing.treeId === treeId) {
          console.log(`⚠️  already on chain`);
          await Tree.updateOne({ _id: tree._id }, { blockchainStatus: "Verified" });
          skipCount++;
          nonce++;
          continue;
        }
      } catch (_) { /* not on chain yet — proceed */ }

      // Send legacy tx
      const tx = await contract.enrollTree(treeId, nfcTagId, lat, lng, plantedTs, {
        type:     0,
        gasPrice,
        gasLimit: 300_000n,
        nonce,
      });

      nonce++;
      console.log(`📤 sent`);
      console.log(`         Hash  : ${tx.hash}`);
      console.log(`         Track : https://amoy.polygonscan.com/tx/${tx.hash}`);
      process.stdout.write(`         ⏳ confirming...`);

      const receipt = await Promise.race([
        tx.wait(1),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("TIMEOUT")), 300_000)
        ),
      ]);

      console.log(` ✅ block ${receipt.blockNumber}`);
      await Tree.updateOne(
        { _id: tree._id },
        { blockchainStatus: "Verified", blockchainTxHash: tx.hash }
      );
      successCount++;

      // Progress summary every 10 trees
      if ((i + 1) % 10 === 0) {
        const remaining = trees.length - (i + 1);
        console.log(`\n📊 Progress: ${successCount} done, ${failCount} failed, ${remaining} remaining\n`);
      }

      // 4s delay between trees
      if (i < trees.length - 1) await sleep(4000);

    } catch (err) {
      failCount++;
      failed.push(tree.treeId);

      if (err.message === "TIMEOUT") {
        console.log(`⚠️  TIMEOUT — may still confirm`);
      } else {
        console.log(`❌ ${err.message.substring(0, 80)}`);
      }

      // Re-fetch confirmed nonce after any error
      await sleep(3000);
      const freshNonce = await provider.getTransactionCount(wallet.address, "latest");
      if (freshNonce !== nonce) {
        console.log(`         🔢 Nonce corrected: ${nonce} → ${freshNonce}`);
        nonce = freshNonce;
      }
    }
  }

  // ── Final summary ─────────────────────────────────────────────
  const finalBalance = await provider.getBalance(wallet.address);
  console.log("\n" + "=".repeat(60));
  console.log(`  SYNC COMPLETE`);
  console.log(`  ✅ Synced    : ${successCount}`);
  console.log(`  ⚠️  Skipped   : ${skipCount} (already on chain)`);
  console.log(`  ❌ Failed    : ${failCount}`);
  console.log(`  💰 Remaining : ${ethers.formatEther(finalBalance)} POL`);
  if (failed.length > 0) {
    console.log(`\n  Failed trees : ${failed.join(", ")}`);
    console.log(`  Run again to retry failed trees.`);
  }
  console.log("=".repeat(60));

  // ── How to view on PolygonScan ─────────────────────────────────
  console.log(`
📍 VIEW YOUR TREES ON POLYGONSCAN:
   Contract page:
   https://amoy.polygonscan.com/address/${CONTRACT_ADDR}

   Click "Contract" tab → "Read Contract" → find treeRegistry
   Enter any treeId (e.g. TA-000001) to see its blockchain data.

   Or view all transactions to this contract:
   https://amoy.polygonscan.com/address/${CONTRACT_ADDR}#internaltx
  `);

  await mongoose.disconnect();
  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Fatal error:", err.message);
  process.exit(1);
});