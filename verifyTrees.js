require("dotenv").config();
const { ethers } = require("ethers");
const Tree = require("./app/models/TreeModel");
const mongoose = require("mongoose");

async function verifyTreesOnBlockchain() {
    console.log("🔍 Verifying trees on blockchain...\n");

    const provider = new ethers.JsonRpcProvider(process.env.BLOCKCHAIN_RPC_URL);

    // ✅ Full ABI including treeRegistry getter
    const abi = [
        {
            "inputs": [
                { "internalType": "string", "name": "_id", "type": "string" },
                { "internalType": "string", "name": "_gps", "type": "string" },
                { "internalType": "string", "name": "_status", "type": "string" }
            ],
            "name": "enrollTree",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                { "internalType": "string", "name": "_id", "type": "string" },
                { "internalType": "string", "name": "_newStatus", "type": "string" }
            ],
            "name": "updateTreeStatus",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                { "internalType": "string", "name": "_id", "type": "string" },
                { "internalType": "string", "name": "_certHash", "type": "string" }
            ],
            "name": "verifyHarvest",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            // ✅ treeRegistry public mapping getter
            "inputs": [
                { "internalType": "string", "name": "", "type": "string" }
            ],
            "name": "treeRegistry",
            "outputs": [
                { "internalType": "string", "name": "treeId", "type": "string" },
                { "internalType": "string", "name": "gpsCoords", "type": "string" },
                { "internalType": "string", "name": "status", "type": "string" },
                { "internalType": "string", "name": "certHash", "type": "string" },
                { "internalType": "uint256", "name": "lastUpdated", "type": "uint256" }
            ],
            "stateMutability": "view",
            "type": "function"
        },
        {
            // ✅ allTreeIds array getter
            "inputs": [
                { "internalType": "uint256", "name": "", "type": "uint256" }
            ],
            "name": "allTreeIds",
            "outputs": [
                { "internalType": "string", "name": "", "type": "string" }
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ];

    const contract = new ethers.Contract(
        process.env.AGARWOOD_REGISTRY_ADDRESS,
        abi,
        provider
    );

    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI);
    console.log("✅ MongoDB connected\n");

    const trees = await Tree.find({ blockchainStatus: 'Verified' });

    console.log("======================================================");
    console.log("📋 BLOCKCHAIN VERIFICATION REPORT");
    console.log("======================================================");
    console.log(`🌐 Network: ${process.env.BLOCKCHAIN_RPC_URL}`);
    console.log(`📄 Contract: ${process.env.AGARWOOD_REGISTRY_ADDRESS}`);
    console.log(`🌳 Trees to verify: ${trees.length}`);
    console.log("======================================================\n");

    let found = 0;
    let notFound = 0;

    for (const tree of trees) {
        try {
            const result = await contract.treeRegistry(tree.treeId);

            if (result[0] && result[0].length > 0) {
                console.log(`✅ ${tree.treeId} → FOUND ON BLOCKCHAIN`);
                console.log(`   📍 GPS: ${result[1]}`);
                console.log(`   🌱 Status: ${result[2]}`);
                console.log(`   🕐 Last Updated: ${new Date(Number(result[4]) * 1000).toLocaleString()}`);
                console.log(`   🔗 Tx Hash: ${tree.blockchainTxHash}\n`);
                found++;
            } else {
                console.log(`❌ ${tree.treeId} → NOT found on blockchain\n`);
                notFound++;
            }
        } catch (err) {
            console.log(`❌ ${tree.treeId} → Error: ${err.message}\n`);
            notFound++;
        }
    }

    console.log("======================================================");
    console.log(`📊 VERIFICATION SUMMARY`);
    console.log(`   ✅ Found on blockchain: ${found} trees`);
    console.log(`   ❌ Not found:           ${notFound} trees`);
    console.log("======================================================");

    await mongoose.disconnect();
    process.exit(0);
}

verifyTreesOnBlockchain().catch(console.error);