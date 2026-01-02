// path: app/controllers/treeController.js
const Tree = require('../models/TreeModel');
const TreeHistory = require('../models/TreeHistory');
const Observation = require('../models/Observations');

// CRUD Operations
exports.createTree = async (req, res) => {
  try {
    const { investorId, investorName, block, plantedDate } = req.body;
    
    // Generate tree ID
    const treeId = `TR-${Date.now().toString().slice(-6)}`;
    
    const tree = new Tree({
      treeId,
      investorId,
      investorName,
      block,
      plantedDate: plantedDate || new Date(),
      gps: { lat: 0, lng: 0 },
      healthStatus: 'Healthy',
      lifecycleStatus: 'Growing',
      inoculationCount: 0,
      readyForInoculation: false,
      readyForHarvest: false,
      lastUpdatedBy: 'system'
    });

    await tree.save();

    // Add to history
    await TreeHistory.create({
      treeId,
      actionType: 'ManualEdit',
      newValue: { treeId, block, investorId, investorName },
      changedBy: 'system',
      notes: 'Tree created',
      timestamp: new Date(),
      device: 'web'
    });

    res.status(201).json({
      success: true,
      message: 'Tree created successfully',
      data: tree
    });
  } catch (error) {
    console.error('Create tree error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getAllTrees = async (req, res) => {
  try {
    const trees = await Tree.find().sort({ treeId: 1 });
    res.json({
      success: true,
      count: trees.length,
      data: trees
    });
  } catch (error) {
    console.error('Get all trees error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.getTreeById = async (req, res) => {
  try {
    const { treeId } = req.params;
    
    // Try by treeId string first, then by _id
    let tree = await Tree.findOne({ treeId });
    if (!tree) {
      tree = await Tree.findById(treeId);
    }

    if (!tree) {
      return res.status(404).json({
        success: false,
        error: 'Tree not found'
      });
    }

    res.json({
      success: true,
      data: tree
    });
  } catch (error) {
    console.error('Get tree by ID error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.updateTree = async (req, res) => {
  try {
    const { treeId } = req.params;
    const updates = req.body;

    const tree = await Tree.findOneAndUpdate(
      { treeId },
      { ...updates, lastUpdatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (!tree) {
      return res.status(404).json({
        success: false,
        error: 'Tree not found'
      });
    }

    // Add to history
    await TreeHistory.create({
      treeId: tree.treeId,
      actionType: 'ManualEdit',
      newValue: updates,
      changedBy: 'web-admin',
      notes: 'Tree updated via web',
      timestamp: new Date(),
      device: 'web'
    });

    res.json({
      success: true,
      message: 'Tree updated successfully',
      data: tree
    });
  } catch (error) {
    console.error('Update tree error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

exports.deleteTree = async (req, res) => {
  try {
    const { treeId } = req.params;

    const tree = await Tree.findOneAndDelete({ treeId });

    if (!tree) {
      return res.status(404).json({
        success: false,
        error: 'Tree not found'
      });
    }

    // Add to history
    await TreeHistory.create({
      treeId,
      actionType: 'ManualEdit',
      changedBy: 'web-admin',
      notes: 'Tree deleted permanently',
      timestamp: new Date(),
      device: 'web'
    });

    res.json({
      success: true,
      message: 'Tree deleted successfully'
    });
  } catch (error) {
    console.error('Delete tree error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// IMPLEMENTED HISTORY FUNCTION
exports.getTreeHistory = async (req, res) => {
  try {
    const { treeId } = req.params;
    
    const history = await TreeHistory.find({ treeId })
      .sort({ timestamp: -1 })
      .limit(50);
    
    res.json({
      success: true,
      count: history.length,
      data: history
    });
  } catch (error) {
    console.error('Get tree history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Other functions that might be referenced in your routes
exports.updateTreeProfile = async (req, res) => {
  res.json({ success: true, message: 'updateTreeProfile function' });
};

exports.updateInspection = async (req, res) => {
  res.json({ success: true, message: 'updateInspection function' });
};

exports.updateLifecycle = async (req, res) => {
  res.json({ success: true, message: 'updateLifecycle function' });
};

exports.updateNFCTag = async (req, res) => {
  res.json({ success: true, message: 'updateNFCTag function' });
};

exports.updateGPS = async (req, res) => {
  res.json({ success: true, message: 'updateGPS function' });
};

exports.archiveTree = async (req, res) => {
  res.json({ success: true, message: 'archiveTree function' });
};

exports.mobileUpdateTree = async (req, res) => {
  res.json({ success: true, message: 'mobileUpdateTree function' });
};

exports.mobileUpdateTreeProfile = async (req, res) => {
  res.json({ success: true, message: 'mobileUpdateTreeProfile function' });
};

exports.getTreeObservations = async (req, res) => {
  res.json({ success: true, message: 'getTreeObservations function' });
};

exports.addObservation = async (req, res) => {
  res.json({ success: true, message: 'addObservation function' });
};

exports.updateObservation = async (req, res) => {
  res.json({ success: true, message: 'updateObservation function' });
};

exports.deleteObservation = async (req, res) => {
  res.json({ success: true, message: 'deleteObservation function' });
};

exports.getAllTreeHistory = async (req, res) => {
  res.json({ success: true, message: 'getAllTreeHistory function' });
};