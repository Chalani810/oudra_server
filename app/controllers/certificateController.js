// app/controllers/certificateController.js
const crypto = require("crypto");
const Tree = require("../models/TreeModel");
const Investor = require("../models/Investor");
const Certificate = require("../models/Certificate");
const blockchainService = require("../services/blockchain.service");

// ========================================
// GET HARVESTED TREES FOR CERTIFICATE MODAL
// ========================================
exports.getHarvestableTreesByInvestor = async (req, res) => {
  try {
    const { investorId } = req.params;

    const investor = await Investor.findById(investorId);
    if (!investor) {
      return res
        .status(404)
        .json({ success: false, message: "Investor not found" });
    }

    const trees = await Tree.find({
      investor: investor._id,
      lifecycleStatus: "Harvested",
    }).sort({ treeId: 1 });

    res.json({ success: true, count: trees.length, data: trees });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ========================================
// GET INVESTOR CERTIFICATES
// ========================================
exports.getInvestorCertificates = async (req, res) => {
  try {
    const investor = await Investor.findById(req.params.investorId).populate({
      path: "certificates.certificate",
      populate: { path: "tree", select: "treeId block lifecycleStatus" },
    });

    if (!investor) {
      return res
        .status(404)
        .json({ success: false, message: "Investor not found" });
    }

    res.json({ success: true, data: investor.certificates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// ========================================
// GET CERTIFICATE BY ID
// ========================================
exports.getCertificate = async (req, res) => {
  try {
    const certificate = await Certificate.findOne({
      certificateId: req.params.certificateId,
    })
      .populate("investor", "name email phone investorId")
      .populate("tree", "treeId block lifecycleStatus");

    if (!certificate) {
      return res
        .status(404)
        .json({ success: false, error: "Certificate not found" });
    }

    res.json({ success: true, data: certificate });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.generateHarvestCertificate = async (req, res) => {
  try {
    const { treeId } = req.body;

    const tree = await Tree.findById(treeId).populate(
      "investor",
      "investorId name email phone"
    );

    if (!tree || !tree.investor) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid tree or investor" });
    }

    if (tree.lifecycleStatus !== "Harvested") {
      return res
        .status(400)
        .json({ success: false, error: "Tree not harvested yet" });
    }

    const existing = await Certificate.findOne({
      tree: tree._id,
      type: "HARVEST",
      status: "ACTIVE",
    });

    if (existing) {
      return res.status(200).json({
        success: true,
        alreadyExists: true,
        message: "Certificate already exists",
        data: {
          certificateId: existing.certificateId,
        },
      });
    }

    const certificateId = `HAR-${tree.treeId}-${Date.now()
      .toString()
      .slice(-6)}`;

    const certificate = new Certificate({
      certificateId,
      investor: tree.investor._id,
      tree: tree._id,
      type: "HARVEST",
      status: "ACTIVE",
      issueDate: new Date(),
      issuedBy: "Admin",
      data: {
        treeId: tree.treeId,
        block: tree.block,
        harvestData: tree.harvestData,
        investor: {
          investorId: tree.investor.investorId,
          name: tree.investor.name,
        },
      },
      qrCodeUrl: `${
        process.env.BASE_URL || "http://localhost:3000"
      }/certificates/${certificateId}`,
    });

    await certificate.save();

    // 🔗 SIMPLE BLOCKCHAIN REGISTRATION (VIVA READY)
    const tx = await blockchainService.issueCertificate(
      certificateId,
      process.env.ADMIN_WALLET || "0x1Be31A94361a391bBaFB2a4CCd704F57dc04d4bb",
      "HARVEST_CERTIFICATE"
    );

    certificate.blockchain = {
      onChain: true,
      txHash: tx.transactionHash,
      blockNumber: tx.blockNumber,
      wallet: process.env.ADMIN_WALLET,
      registeredAt: new Date(),
    };

    await certificate.save();

    await Investor.findByIdAndUpdate(tree.investor._id, {
      $push: { certificates: { certificate: certificate._id } },
    });

    res.status(201).json({
      success: true,
      message: "Harvest certificate generated & blockchain verified",
      data: certificate,
    });
  } catch (error) {
    console.error("❌ Harvest certificate error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getHarvestCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;

    const certificate = await Certificate.findOne({
      certificateId: certificateId,
    })
      .populate("investor", "name email")
      .populate("tree", "treeId block lifecycleStatus");

    if (!certificate) {
      return res.status(404).json({
        success: false,
        error: "Harvest certificate not found for this investor and tree",
      });
    }

    res.json({
      success: true,
      verified: certificate.blockchain?.onChain === true,
      data: certificate,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

// ========================================
// VERIFY CERTIFICATE (DB + BLOCKCHAIN FLAG)
// ========================================
exports.verifyCertificate = async (req, res) => {
  try {
    const certificate = await Certificate.findOne({
      certificateId: req.params.certificateId,
    })
      .populate("investor", "name email")
      .populate("tree", "treeId block lifecycleStatus");

    if (!certificate) {
      return res
        .status(404)
        .json({ success: false, error: "Certificate not found" });
    }

    res.json({
      success: true,
      verified: certificate.blockchain?.onChain === true,
      data: certificate,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
/**
 * GET /api/certificates/:certificateId/details
 * Returns a single cleaned certificate object
 */
exports.getHarvestCertificateDetails = async (req, res) => {
  try {
    const { certificateId } = req.params;

    const certificate = await Certificate.findOne({ certificateId })
      .populate({
        path: "investor",
        select: "investorId name email phone investment status",
      })
      .populate({
        path: "tree",
        select: `
          treeId block plantedDate
          healthStatus lifecycleStatus
          harvestData gps
          blockchain
        `,
      })
      .lean();

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: "Certificate not found",
      });
    }

    // ===============================
    // CLEAN & NORMALIZE RESPONSE
    // ===============================
    const response = {
      certificate: {
        certificateId: certificate.certificateId,
        certificateNumber: certificate.certificateNumber,
        type: certificate.type,
        status: certificate.status,
        issueDate: certificate.issueDate,
        issuedBy: certificate.issuedBy,
        qrCodeUrl: certificate.qrCodeUrl,
      },

      investor: certificate.investor
        ? {
            investorId: certificate.investor.investorId,
            name: certificate.investor.name,
            email: certificate.investor.email,
            phone: certificate.investor.phone,
            investment: certificate.investor.investment,
            status: certificate.investor.status,
          }
        : null,

      tree: certificate.tree
        ? {
            treeId: certificate.tree.treeId,
            block: certificate.tree.block,
            plantedDate: certificate.tree.plantedDate,
            lifecycleStatus: certificate.tree.lifecycleStatus,
            healthStatus: certificate.tree.healthStatus,

            harvest: {
              resinYield: certificate.tree.harvestData?.resinYield || 0,
              qualityGrade: certificate.tree.harvestData?.qualityGrade || "N/A",
              harvestedBy: certificate.tree.harvestData?.harvestedBy,
              harvestedAt: certificate.tree.harvestData?.harvestedAt,
            },

            location: certificate.tree.gps,
          }
        : null,

      blockchain: {
        onChain: certificate.blockchain?.onChain || false,
        transactionHash: certificate.blockchain?.transactionHash || null,
        blockNumber: certificate.blockchain?.blockNumber || null,
        network: certificate.blockchain?.network || null,
        verifiedAt: certificate.blockchain?.lastVerifiedAt || null,
        verificationCount: certificate.blockchain?.verificationCount || 0,
        isRevoked: certificate.blockchain?.isRevoked || false,
      },

      verification: {
        isValid:
          certificate.blockchain?.onChain === true &&
          certificate.blockchain?.isRevoked !== true,
        verificationUrl: certificate.qrCodeUrl,
      },
    };

    return res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("❌ Certificate details error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load certificate details",
    });
  }
};

module.exports = exports;
