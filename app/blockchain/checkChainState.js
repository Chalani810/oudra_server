// path: oudra-server/blockchain/checkChainState.js
// Run with: node blockchain/checkChainState.js
// Checks first 12 unverified trees against chain and fixes MongoDB.

const { ethers } = require("ethers");
const mongoose = require("mongoose");
require("dotenv").config();

const Tree = require("../models/TreeModel");

const AGARWOOD_ABI = [
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
  }
];

async function main() {
  // ── MongoDB ────────────────────────────────────────────────────────────────
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGODB_URI / MONGO_URI missing from .env");
  await mongoose.connect(mongoUri);
  console.log("✅ MongoDB connected\n");

  // ── Blockchain ─────────────────────────────────────────────────────────────
  const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);
  const contract = new ethers.Contract(
    process.env.AGARWOOD_REGISTRY_ADDRESS,
    AGARWOOD_ABI,
    provider
  );

  // ── Fetch first 12 unverified trees ───────────────────────────────────────
  const trees = await Tree.find({ blockchainStatus: { $ne: "Verified" } })
    .sort({ treeId: 1 })
    .limit(12);

  console.log(`🔍 Checking ${trees.length} trees...\n`);
  console.log("─".repeat(60));

  let fixedCount   = 0;
  let pendingCount = 0;

  for (const tree of trees) {
    try {
      const record = await contract.treeRegistry(tree.treeId);
      const onChain = record.treeId && record.treeId.length > 0;

      if (onChain) {
        // Already on chain — fix MongoDB
        console.log(`✅ ON-CHAIN   ${tree.treeId}`);
        console.log(`   GPS:    ${record.gpsCoords}`);
        console.log(`   Status: ${record.status}`);
        console.log(`   ⚙️  Fixing MongoDB blockchainStatus → Verified`);

        tree.blockchainStatus = "Verified";
        await tree.save();
        fixedCount++;
      } else {
        console.log(`⏳ PENDING    ${tree.treeId} — not yet on chain`);
        pendingCount++;
      }
    } catch (err) {
      console.log(`❌ ERROR      ${tree.treeId}: ${err.message.slice(0, 80)}`);
    }

    console.log("─".repeat(60));

    // Small delay between RPC calls to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Already on-chain (MongoDB fixed): ${fixedCount}`);
  console.log(`   ⏳ Truly pending (need enrolling):   ${pendingCount}`);

  if (fixedCount > 0) {
    console.log(`\n💡 Run sync-polygon again — those ${fixedCount} trees will now be skipped`);
    console.log(`   and only the ${pendingCount} truly pending trees will be enrolled.`);
  }

  await mongoose.disconnect();
  console.log("\n✅ Done.");
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});