const Tree = require("../models/TreeModel");
const Investor = require("../models/Investor");
const Certificate = require("../models/Certificate");
const blockchainService = require("../services/blockchain.service");

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

module.exports = exports;