// saveTxHashes.js
require("dotenv").config();
const mongoose = require("mongoose");

const TX_DATA = [
  {
    treeId: "TA-000001",
    txHash: "0x58a7140c0f92f0456a57afb4f13e3019501a0bf2d42bdd1462f310e6ffb3e45b",
    block: 34880836,
  },
  {
    treeId: "TA-000002",
    txHash: "0xdefb380b2221951d09f7cc83ea183ddd5b83f37a84173c7a40f844b84fbeb09f",
    block: 34880836,
  },
  {
    treeId: "TA-000005",
    txHash: "0xe915f87cf6ea8ace0e584154306a60c090bf4a08be6c4b249a95bd00f15149b0",
    block: 34880834,
  },
];

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);

  for (const t of TX_DATA) {
    const result = await mongoose.connection.collection("trees").updateOne(
      { treeId: t.treeId },
      {
        $set: {
          blockchainStatus: "Verified",
          blockchainTxHash: t.txHash,
          blockchainBlock: t.block,
        },
      }
    );
    console.log(`✅ ${t.treeId} — updated: ${result.modifiedCount === 1 ? "yes" : "already set"}`);
  }

  await mongoose.disconnect();
  console.log("\nDone! All 3 trees now have tx hashes in MongoDB.");
}

main().catch(console.error);