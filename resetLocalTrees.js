// resetLocalTrees.js
require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  console.log("Connecting to MongoDB...");
  await mongoose.connect(uri);

  const result = await mongoose.connection.collection("trees").updateMany(
    {
      treeId: {
        $in: [
          "TA-000001", "TA-000002", "TA-000003", "TA-000004", "TA-000005",
          "TA-000006", "TA-000007", "TA-000008", "TA-000009", "TA-000010",
        ],
      },
    },
    {
      $set: {
        blockchainStatus: "pending",
        blockchainTxHash: null,
        blockchainBlock: null,
      },
    }
  );

  console.log("✅ Reset", result.modifiedCount, "trees to pending");
  await mongoose.disconnect();
}

main().catch(console.error);