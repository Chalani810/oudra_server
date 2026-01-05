// app/controllers/treeController.js
const Tree = require('../models/TreeModel');
const TreeHistory = require('../models/TreeHistory');
const Observation = require('../models/Observations');
const Investor = require('../models/Investor');
const Certificate = require('../models/Certificate');
const blockchainService = require('../services/blockchain.service');

/* =========================
   CREATE TREE
========================= */
const createTree = async (req, res) => {
  try {
    const tree = new Tree(req.body);
    await tree.save();
    res.status(201).json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/* =========================
   GET ALL TREES
========================= */
const getAllTrees = async (req, res) => {
  try {
    const trees = await Tree.find()
      .populate('investor', 'investorId name')
      .sort({ treeId: 1 });
    res.json({ success: true, data: trees });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/* =========================
   GET TREE BY ID
========================= */
const getTreeById = async (req, res) => {
  try {
    const tree = await Tree.findOne({ treeId: req.params.treeId })
      .populate('investor', 'investorId name email phone');
    if (!tree) {
      return res.status(404).json({ success: false, error: 'Tree not found' });
    }
    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/* =========================
   UPDATE TREE
   🌾 AUTO CERTIFICATE + BLOCKCHAIN
========================= */
const updateTree = async (req, res) => {
  try {
    const tree = await Tree.findOne({ treeId: req.params.treeId })
      .populate('investor', 'investorId name email phone');

    if (!tree) return res.status(404).json({ success: false, error: 'Tree not found' });

    const oldStatus = tree.lifecycleStatus;
    Object.assign(tree, req.body);
    await tree.save();

    // Issue certificate if harvested
    if (oldStatus !== 'Harvested' && tree.lifecycleStatus === 'Harvested' && tree.investor) {
      const certificateId = `HAR-${tree.treeId}-${Date.now().toString().slice(-6)}`;
      const certificate = new Certificate({
        certificateId,
        investor: tree.investor._id,
        tree: tree._id,
        type: 'HARVEST',
        status: 'ACTIVE',
        issueDate: new Date(),
        issuedBy: 'System',
        data: { treeId: tree.treeId, harvestData: tree.harvestData }
      });

      await certificate.save();

      const tx = await blockchainService.issueCertificate(
        certificateId,
        process.env.ADMIN_WALLET,
        'HARVEST_CERTIFICATE'
      );

      certificate.blockchain = {
        onChain: true,
        txHash: tx.transactionHash,
        blockNumber: tx.blockNumber
      };
      await certificate.save();
    }

    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/* =========================
   DELETE TREE
========================= */
const deleteTree = async (req, res) => {
  try {
    const tree = await Tree.findOneAndDelete({ treeId: req.params.treeId });
    if (!tree) return res.status(404).json({ success: false, error: 'Tree not found' });
    res.json({ success: true, message: 'Tree deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/* =========================
   UPDATE TREE PROFILE
========================= */
const updateTreeProfile = async (req, res) => {
  try {
    const tree = await Tree.findOneAndUpdate({ treeId: req.params.treeId }, req.body, { new: true });
    if (!tree) return res.status(404).json({ success: false, error: 'Tree not found' });
    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/* =========================
   TREE-INVESTOR MANAGEMENT
========================= */
const getTreesByInvestorId = async (req, res) => {
  try {
    const trees = await Tree.find({ investor: req.params.investorId })
      .populate('investor', 'investorId name');
    res.json({ success: true, data: trees });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const bulkUpdateTreeInvestors = async (req, res) => {
  try {
    const { treeIds, investorId } = req.body;
    await Tree.updateMany({ _id: { $in: treeIds } }, { investor: investorId });
    res.json({ success: true, message: 'Trees updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/* =========================
   SPECIALIZED TREE UPDATES
========================= */
const updateInspection = async (req, res) => {
  try {
    const tree = await Tree.findOneAndUpdate(
      { treeId: req.params.treeId },
      { inspectionData: req.body },
      { new: true }
    );
    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateLifecycle = async (req, res) => {
  try {
    const tree = await Tree.findOneAndUpdate(
      { treeId: req.params.treeId },
      { lifecycleStatus: req.body.lifecycleStatus },
      { new: true }
    );
    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateNFCTag = async (req, res) => {
  try {
    const tree = await Tree.findOneAndUpdate(
      { treeId: req.params.treeId },
      { nfcTag: req.body.nfcTag },
      { new: true }
    );
    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateGPS = async (req, res) => {
  try {
    const tree = await Tree.findOneAndUpdate(
      { treeId: req.params.treeId },
      { gps: req.body.gps },
      { new: true }
    );
    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const archiveTree = async (req, res) => {
  try {
    const tree = await Tree.findOneAndUpdate(
      { treeId: req.params.treeId },
      { archived: true },
      { new: true }
    );
    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const mobileUpdateTree = async (req, res) => {
  try {
    const tree = await Tree.findOneAndUpdate({ treeId: req.params.treeId }, req.body, { new: true });
    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const mobileUpdateTreeProfile = mobileUpdateTree;

/* =========================
   FIELD NOTES / OBSERVATIONS
========================= */
const getTreeObservations = async (req, res) => {
  try {
    const observations = await Observation.find({ tree: req.params.treeId });
    res.json({ success: true, data: observations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const addObservation = async (req, res) => {
  try {
    const observation = new Observation({
      tree: req.params.treeId,
      ...req.body
    });
    await observation.save();
    res.status(201).json({ success: true, data: observation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateObservation = async (req, res) => {
  try {
    const observation = await Observation.findByIdAndUpdate(req.params.observationId, req.body, { new: true });
    res.json({ success: true, data: observation });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteObservation = async (req, res) => {
  try {
    await Observation.findByIdAndDelete(req.params.observationId);
    res.json({ success: true, message: 'Observation deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/* =========================
   TREE HISTORY
========================= */
const getTreeHistory = async (req, res) => {
  try {
    const history = await TreeHistory.find({ tree: req.params.treeId }).sort({ date: -1 });
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const getAllTreeHistory = async (req, res) => {
  try {
    const history = await TreeHistory.find({ tree: req.params.treeId })
      .sort({ date: -1 })
      .limit(50); // example filter
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/* =========================
   EXPORT ALL FUNCTIONS
========================= */
module.exports = {
  createTree,
  getAllTrees,
  getTreeById,
  updateTree,
  deleteTree,
  updateTreeProfile,
  getTreesByInvestorId,
  bulkUpdateTreeInvestors,
  updateInspection,
  updateLifecycle,
  updateNFCTag,
  updateGPS,
  archiveTree,
  mobileUpdateTree,
  mobileUpdateTreeProfile,
  getTreeObservations,
  addObservation,
  updateObservation,
  deleteObservation,
  getTreeHistory,
  getAllTreeHistory
};
