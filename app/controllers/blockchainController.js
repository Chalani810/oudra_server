// path: oudra-server/app/controllers/blockchainController.js
const { enrollExistingTrees } = require("../blockchain/syncTrees");
const Blockchain = require("../blockchain/Blockchain");
const BlockchainRecord = require("../models/BlockchainRecord");
const Investor = require("../models/Investor");
const Tree = require("../models/TreeModel");

require("dotenv").config();

const blockchain = new Blockchain();

(async () => {
  try {
    await blockchain.initialize();
  } catch (err) {
    console.error("Blockchain initialization error:", err);
  }
})();

// ══════════════════════════════════════════════════════════════
// 1️⃣  POLYGON SYNC
// ══════════════════════════════════════════════════════════════

const syncTreesToPolygon = async (req, res) => {
  try {
    const contractAddress = process.env.AGARWOOD_REGISTRY_ADDRESS;

    // ── Guard: missing address ──────────────────────────────────
    if (!contractAddress) {
      return res.status(500).json({
        success: false,
        message: "AGARWOOD_REGISTRY_ADDRESS not set in .env",
      });
    }

    // ── Guard: localhost address used in production ─────────────
    if (contractAddress === "0x5FbDB2315678afecb367f032d93F642f64180aa3") {
      return res.status(500).json({
        success: false,
        message:
          "Contract address is the Hardhat localhost default. " +
          "Deploy to Amoy first and update AGARWOOD_REGISTRY_ADDRESS in .env.",
      });
    }

    const result = await enrollExistingTrees(contractAddress);

    const totalProcessed = result.successCount + result.skippedCount + result.failCount;

    return res.status(200).json({
      success: true,
      message:
        `Sync complete. ` +
        `${result.successCount} enrolled, ` +
        `${result.skippedCount} already verified, ` +
        `${result.failCount} failed.`,
      data: {
        ...result,
        totalProcessed,
        contractAddress,
      },
    });
  } catch (error) {
    console.error("Polygon Sync Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to sync trees to Polygon.",
    });
  }
};

// ══════════════════════════════════════════════════════════════
// 2️⃣  LOCAL BLOCKCHAIN
// ══════════════════════════════════════════════════════════════

const getBlockchain = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        chain:  blockchain.getChainData(),
        length: blockchain.chain.length,
      },
    });
  } catch (error) {
    console.error("Get blockchain error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const verifyBlockchain = async (req, res) => {
  try {
    const isValid = blockchain.isChainValid();
    res.json({
      success: true,
      data: {
        isValid,
        message: isValid ? "Blockchain integrity verified ✓" : "Blockchain tampered ✗",
        chainLength: blockchain.chain.length,
      },
    });
  } catch (error) {
    console.error("Verify blockchain error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getDetailedVerification = async (req, res) => {
  try {
    const results = [];
    let isValid = true;

    for (let i = 1; i < blockchain.chain.length; i++) {
      const currentBlock  = blockchain.chain[i];
      const previousBlock = blockchain.chain[i - 1];

      const recalculatedHash = currentBlock.calculateHash();
      const hashValid        = currentBlock.hash === recalculatedHash;
      const linkValid        = currentBlock.previousHash === previousBlock.hash;

      let investorInfo = null;
      if (currentBlock.data?.investorId) {
        try {
          investorInfo = await Investor.findById(currentBlock.data.investorId)
            .select("name email")
            .lean();
        } catch (err) {
          console.error(`Could not fetch investor for block ${i}:`, err.message);
        }
      }

      results.push({
        blockIndex: i,
        blockData:  currentBlock.data,
        investor:   investorInfo,
        timestamp:  new Date(currentBlock.timestamp).toLocaleString(),
        checks: {
          hashIntegrity: {
            passed:  hashValid,
            message: hashValid ? "✓ Block data is untampered" : "✗ Block data modified!",
          },
          chainLink: {
            passed:  linkValid,
            message: linkValid ? "✓ Chain link intact" : "✗ Previous block modified!",
          },
        },
        isValid: hashValid && linkValid,
      });

      if (!hashValid || !linkValid) isValid = false;
    }

    res.json({ success: true, data: { overallValid: isValid, results } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const verifyInvestorBlockchain = async (req, res) => {
  try {
    const { investorId } = req.params;
    const investor = await Investor.findById(investorId);

    if (!investor) {
      return res.status(404).json({ success: false, error: "Investor not found" });
    }

    const investorBlocks = await BlockchainRecord
      .find({ "data.investorId": investorId })
      .sort({ index: 1 });

    let isValid = true;
    const results = investorBlocks.map((block) => {
      const inMainChain = blockchain.chain.some((b) => b.hash === block.hash);
      if (!inMainChain) isValid = false;
      return { blockIndex: block.index, inMainChain };
    });

    res.json({
      success: true,
      data: { investor, verification: { isValid, results } },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getAuditTrail = async (req, res) => {
  try {
    const { investorId } = req.params;
    const auditTrail = await BlockchainRecord
      .find({ "data.investorId": investorId })
      .sort({ timestamp: -1 });
    const investor = await Investor.findById(investorId).select("name email").lean();

    res.json({ success: true, data: { investor, records: auditTrail } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getBlockByIndex = async (req, res) => {
  try {
    const block = await BlockchainRecord.findOne({
      index: parseInt(req.params.index),
    });
    if (!block) {
      return res.status(404).json({ success: false, error: "Block not found" });
    }
    res.json({ success: true, data: block });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getBlockchainStats = async (req, res) => {
  try {
    const totalBlocks      = await BlockchainRecord.countDocuments();
    const lastBlock        = await BlockchainRecord.findOne().sort({ index: -1 });
    const totalTrees       = await Tree.countDocuments();
    const verifiedOnPolygon = await Tree.countDocuments({ blockchainStatus: "Verified" });
    const pendingSync       = await Tree.countDocuments({ blockchainStatus: { $ne: "Verified" } });

    res.json({
      success: true,
      data: {
        localBlockchain: {
          totalBlocks,
          isValid:       blockchain.isChainValid(),
          lastBlockHash: lastBlock?.hash || null,
        },
        polygonNetwork: {
          totalTrees,
          verifiedOnPolygon,
          pendingSync,
          contractAddress: process.env.AGARWOOD_REGISTRY_ADDRESS || null,
          network:         process.env.BLOCKCHAIN_NETWORK || "amoy",
        },
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  syncTreesToPolygon,
  getBlockchain,
  verifyBlockchain,
  getDetailedVerification,
  getAuditTrail,
  getBlockByIndex,
  verifyInvestorBlockchain,
  getBlockchainStats,
};