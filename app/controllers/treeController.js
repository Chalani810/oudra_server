
const Tree = require('../models/TreeModel');
const Observation = require('../models/Observations');
const TreeHistory = require('../models/TreeHistory');

const { getNextAvailableNumber, buildTreeId } = require('./autoIncrementController');

async function getNextTreeId(block) {
  const num = await getNextAvailableNumber();
  return buildTreeId(block, num);
}

// Helper function to calculate tree age in years and months
function calculateTreeAge(plantedDate) {
  if (!plantedDate) return { years: 0, months: 0, totalMonths: 0 };
  
  const planted = new Date(plantedDate);
  const now = new Date();
  
  let years = now.getFullYear() - planted.getFullYear();
  let months = now.getMonth() - planted.getMonth();
  let days = now.getDate() - planted.getDate();
  
  if (days < 0) {
    months--;
    // Adjust month count
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  
  if (months < 0) {
    years--;
    months += 12;
  }
  
  return {
    years,
    months,
    totalMonths: (years * 12) + months
  };
}

// Determine lifecycle status based on age and inoculation count (SERVER-SIDE LOGIC)
function determineLifecycleStatus(treeData) {
  if (!treeData) return 'Growing';
  
  const { plantedDate, healthStatus, inoculationCount, lifecycleStatus } = treeData;
  
  // CRITICAL: If tree is DEAD or HARVESTED, lifecycle STOPS permanently
  if (healthStatus === 'Dead' || lifecycleStatus === 'Harvested') {
    return lifecycleStatus === 'Harvested' ? 'Harvested' : 'Dead - Lifecycle Stopped';
  }
  
  const age = calculateTreeAge(plantedDate);
  
  // Check conditions for auto-updating lifecycle
  if (inoculationCount === 0) {
    if (age.years >= 4 && healthStatus === 'Healthy') {
      return 'Ready for 1st Inoculation';
    }
    return 'Growing';
  } else if (inoculationCount === 1) {
    if (age.totalMonths >= 52 && healthStatus === 'Healthy') { // 4 years + 4 months = 52 months
      return 'Ready for 2nd Inoculation';
    }
    return 'Inoculated Once';
  } else if (inoculationCount === 2) {
    // Only ready for harvest if: Age >= 8 AND Healthy
    if (age.years >= 8 && healthStatus === 'Healthy') {
      return 'Ready for Harvest';
    }
    return 'Inoculated Twice';
  }
  
  return lifecycleStatus || 'Growing';
}

// Check if tree can progress in lifecycle (NOT dead or harvested)
function canProgressLifecycle(treeData) {
  if (!treeData) return true;
  
  const { healthStatus, lifecycleStatus } = treeData;
  
  // Tree cannot progress if DEAD or already HARVESTED
  if (healthStatus === 'Dead' || lifecycleStatus === 'Harvested') {
    return false;
  }
  
  return true;
}

// Auto-update lifecycle based on inoculation logic
function autoUpdateLifecycleStatus(treeData, updates) {
  const tree = { ...treeData, ...updates };
  
  // If tree is dead or harvested, don't auto-update
  if (tree.healthStatus === 'Dead' || tree.lifecycleStatus === 'Harvested') {
    return {
      lifecycleStatus: tree.lifecycleStatus,
      readyForInoculation: false,
      readyForHarvest: false
    };
  }
  
  const age = calculateTreeAge(tree.plantedDate);
  const inoculationCount = tree.inoculationCount || 0;
  const healthStatus = tree.healthStatus || 'Healthy';
  
  let lifecycleStatus = tree.lifecycleStatus || 'Growing';
  let readyForInoculation = false;
  let readyForHarvest = false;
  
  // Apply inoculation logic
  if (inoculationCount === 0) {
    if (age.years >= 4 && healthStatus === 'Healthy') {
      lifecycleStatus = 'Ready for 1st Inoculation';
      readyForInoculation = true;
    } else {
      lifecycleStatus = 'Growing';
      readyForInoculation = false;
    }
  } else if (inoculationCount === 1) {
    if (age.totalMonths >= 52 && healthStatus === 'Healthy') { // 4 years + 4 months = 52 months
      lifecycleStatus = 'Ready for 2nd Inoculation';
      readyForInoculation = true;
    } else {
      lifecycleStatus = 'Inoculated Once';
      readyForInoculation = false;
    }
  } else if (inoculationCount === 2) {
    if (age.years >= 8 && healthStatus === 'Healthy') {
      lifecycleStatus = 'Ready for Harvest';
      readyForHarvest = true;
    } else {
      lifecycleStatus = 'Inoculated Twice';
      readyForHarvest = false;
    }
  }
  
  // If manually set to Harvested, update accordingly
  if (tree.lifecycleStatus === 'Harvested') {
    lifecycleStatus = 'Harvested';
    readyForInoculation = false;
    readyForHarvest = false;
  }
  
  return { lifecycleStatus, readyForInoculation, readyForHarvest };
}

function buildDisplayName(reqUser) {
  if (!reqUser) return 'field-worker';
  const { firstName, lastName, userId } = reqUser;
  if (firstName && lastName && userId) {
    return `${firstName} ${lastName} (${userId})`;
  }
  if (firstName && userId) {
    return `${firstName} (${userId})`;
  }
  return userId || 'field-worker';
}

// Create a new tree - UPDATED: No NFC, GPS, or status inputs from web
exports.createTree = async (req, res) => {
  try {
    const { investorId, investorName, block } = req.body;
    
    // Validate required fields
    if (!block) {
      return res.status(400).json({ message: 'Block is required' });
    }

    // Get user info
    const userData = req.user || {};
    const lastUpdatedBy = userData.userId ? `${userData.userId} - ${userData.name || 'Manager'}` : 'web-admin';

    // Generate tree ID
    const treeId = await getNextTreeId(block);

    // Set current date as planted date
    const plantedDate = new Date();
    
    // Calculate age (0 years 0 months)
    const ageData = calculateTreeAge(plantedDate);

    // Create tree with default values
    const tree = new Tree({
      treeId,
      nfcTagId: null, // No NFC assigned yet - field workers will assign
      plantedDate,
      age: ageData.years,
      investorId: investorId || null,
      investorName: investorName || null,
      block,
      gps: { lat: 0, lng: 0 }, // Default GPS - field workers will capture
      healthStatus: 'Healthy', // Always healthy when planted
      lastInspection: null,
      inspectedBy: null,
      lastUpdatedAt: new Date(),
      lastUpdatedBy: lastUpdatedBy,
      offlineUpdated: false,
      lifecycleStatus: 'Growing', // Always growing when planted
      inoculationCount: 0, // Always 0 when planted
      readyForInoculation: false,
      readyForHarvest: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await tree.save();

    // Add to tree history
    const history = new TreeHistory({
      treeId,
      actionType: 'ManualEdit',
      newValue: {
        treeId,
        block,
        investorId: investorId || null,
        investorName: investorName || null,
        plantedDate,
        healthStatus: 'Healthy',
        lifecycleStatus: 'Growing'
      },
      changedBy: lastUpdatedBy,
      notes: 'Tree registered digitally by manager',
      timestamp: new Date(),
      device: 'web'
    });
    await history.save();

    return res.status(201).json(tree);
  } catch (err) {
    console.error('createTree error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// Getting all trees (with optional filters)
exports.getAllTrees = async (req, res) => {
  
  try {
    const filter = {};
    if (req.query.block) filter.block = req.query.block;
    if (req.query.status) filter.healthStatus = req.query.status;
    if (req.query.includeArchived !== 'true') filter.isArchived = { $ne: true };

    const trees = await Tree.find(filter).lean().exec();
    return res.json(trees);
  } catch (err) {
    console.error('getAllTrees error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// Getting a single tree by treeId
exports.getTreeById = async (req, res) => {
  try {
    const tree = await Tree.findOne({ treeId: req.params.treeId }).lean().exec();
    if (!tree) return res.status(404).json({ message: 'Tree not found' });
    
    // Calculate current age for response
    const ageData = calculateTreeAge(tree.plantedDate);
    const treeWithAge = {
      ...tree,
      calculatedAge: ageData,
      calculatedLifecycleStatus: determineLifecycleStatus(tree) // Add calculated status
    };
    
    return res.json(treeWithAge);
  } catch (err) {
    console.error('getTreeById error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// Generic update (PUT /api/trees/:treeId) - UPDATED: Managers can only update certain fields
exports.updateTree = async (req, res) => {
  try {
    const tree = await Tree.findOne({ treeId: req.params.treeId }).exec();
    if (!tree) return res.status(404).json({ message: 'Tree not found' });
    
    // Get user info
    const userData = req.user || {};
    const lastUpdatedBy = userData.userId ? `${userData.userId} - ${userData.name || 'Manager'}` : 'web-admin';
    
    // Managers can only update these fields
    const allowedUpdates = ['block', 'investorId', 'investorName'];
    const updates = { 
      lastUpdatedBy,
      lastUpdatedAt: new Date(),
      updatedAt: new Date()
    };
    
    // Only copy allowed fields
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });
    
    // Update the tree
    Object.assign(tree, updates);
    await tree.save();

    // Adding to history
    const history = new TreeHistory({
      treeId: req.params.treeId,
      actionType: 'ManualEdit',
      newValue: updates,
      changedBy: lastUpdatedBy,
      notes: 'Tree updated by manager',
      timestamp: new Date(),
      device: 'web'
    });
    await history.save();
    
    return res.json(tree);
  } catch (err) {
    console.error('updateTree error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// DELETE the tree permanently
exports.deleteTree = async (req, res) => {
  try {
    const { deletedBy } = req.body;
    const { treeId } = req.params;

    // Find and delete the tree
    const tree = await Tree.findOneAndDelete({ treeId });
    if (!tree) {
      return res.status(404).json({ message: 'Tree not found' });
    }

    // Add to history before deletion
    const history = new TreeHistory({
      treeId,
      actionType: 'ManualEdit',
      oldValue: tree.toObject(),
      changedBy: deletedBy || 'system',
      notes: 'Tree permanently deleted',
      timestamp: new Date(),
      device: 'web'
    });
    await history.save();

    // Delete related observations
    await Observation.deleteMany({ treeId });

    return res.json({ 
      message: 'Tree deleted successfully',
      deletedTree: tree 
    });
  } catch (err) {
    console.error('deleteTree error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// Update tree profile (for Save button in frontend) - UPDATED: Only manager fields
exports.updateTreeProfile = async (req, res) => {
  try {
    const { treeId } = req.params;
    const { 
      lastUpdatedBy,
      block,
      investorId,
      investorName
      // Removed: healthStatus, lifecycleStatus, inoculationCount (field workers only)
    } = req.body;

    const tree = await Tree.findOne({ treeId }).exec();
    if (!tree) return res.status(404).json({ message: 'Tree not found' });

    // Prepare updates - only manager-editable fields
    const updates = {
      lastUpdatedBy,
      lastUpdatedAt: new Date(),
      updatedAt: new Date()
    };

    // Update manager fields if provided
    if (block !== undefined) updates.block = block;
    if (investorId !== undefined) updates.investorId = investorId;
    if (investorName !== undefined) updates.investorName = investorName;

    // Update the tree
    Object.assign(tree, updates);
    await tree.save();

    // Add to history
    const history = new TreeHistory({
      treeId,
      actionType: 'ManualEdit',
      newValue: updates,
      changedBy: lastUpdatedBy,
      notes: 'Tree profile updated by manager',
      timestamp: new Date(),
      device: 'web'
    });
    await history.save();
    
    return res.json(tree);
  } catch (err) {
    console.error('updateTreeProfile error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// ========== CRITICAL ENDPOINT: MOBILE TREE PROFILE UPDATE ==========
// This is the endpoint field workers will use to update health status and inoculation count
exports.mobileUpdateTreeProfile = async (req, res) => {
  try {
    const { treeId } = req.params;
    const { 
      healthStatus, 
      inoculationCount,
      block,
      lastUpdatedBy   // still accepted from body for backward compat 
    } = req.body;

    const tree = await Tree.findOne({ treeId }).exec();
    if (!tree) return res.status(404).json({ message: 'Tree not found' });

    // Check if tree is dead or harvested - cannot update
    if (tree.healthStatus === 'Dead' || tree.lifecycleStatus === 'Harvested') {
      return res.status(400).json({ 
        message: tree.healthStatus === 'Dead' 
          ? 'Cannot update a dead tree. Lifecycle has stopped permanently.'
          : 'Cannot update a harvested tree. Record is preserved for tracking.',
        currentStatus: tree.healthStatus === 'Dead' ? 'Dead' : 'Harvested'
      });
    }

    // Prepare updates - field workers can update these
    const updates = {
      lastUpdatedBy: buildDisplayName(req.user) || lastUpdatedBy || 'field-worker',
      lastUpdatedAt: new Date(),
      updatedAt: new Date()
    };

    // Update allowed fields if provided
    if (healthStatus !== undefined) updates.healthStatus = healthStatus;
    if (inoculationCount !== undefined) updates.inoculationCount = parseInt(inoculationCount);
    if (block !== undefined) updates.block = block;

    // Auto-calculate lifecycle status based on new data
    const newTreeData = { ...tree.toObject(), ...updates };
    const calculatedLifecycle = determineLifecycleStatus(newTreeData);
    updates.lifecycleStatus = calculatedLifecycle;

    // Update flags based on lifecycle
    const age = calculateTreeAge(tree.plantedDate);
    const newInoculationCount = inoculationCount !== undefined ? parseInt(inoculationCount) : tree.inoculationCount;
    const newHealthStatus = healthStatus || tree.healthStatus;
    
    // Set readyForInoculation flag
    if (newInoculationCount === 0 && age.years >= 4 && newHealthStatus === 'Healthy') {
      updates.readyForInoculation = true;
    } else if (newInoculationCount === 1 && age.totalMonths >= 52 && newHealthStatus === 'Healthy') {
      updates.readyForInoculation = true;
    } else {
      updates.readyForInoculation = false;
    }

    // Set readyForHarvest flag
    if (newInoculationCount === 2 && age.years >= 8 && newHealthStatus === 'Healthy') {
      updates.readyForHarvest = true;
    } else {
      updates.readyForHarvest = false;
    }

    // Update the tree
    Object.assign(tree, updates);
    await tree.save();

    // Add to history
    const history = new TreeHistory({
      treeId,
      actionType: 'ManualEdit',
      oldValue: {
        healthStatus: tree.healthStatus,
        inoculationCount: tree.inoculationCount,
        lifecycleStatus: tree.lifecycleStatus,
        block: tree.block
      },
      newValue: updates,
      changedBy: buildDisplayName(req.user) || lastUpdatedBy || 'field-worker',
      notes: 'Tree profile updated via mobile app',
      timestamp: new Date(),
      device: 'mobile'
    });
    await history.save();
    
    // Return tree with calculated fields
    const responseTree = {
      ...tree.toObject(),
      calculatedLifecycleStatus: calculatedLifecycle,
      calculatedAge: calculateTreeAge(tree.plantedDate)
    };
    
    return res.json(responseTree);
  } catch (err) {
    console.error('mobileUpdateTreeProfile error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// Mobile app endpoint for field worker updates
exports.mobileUpdateTree = async (req, res) => {
  try {
    const { treeId } = req.params;
    const { 
      nfcTagId,
      healthStatus, 
      lifecycleStatus, 
      inoculationCount,
      gps,
      observedBy,
      notes 
    } = req.body;

    const tree = await Tree.findOne({ treeId }).exec();
    if (!tree) return res.status(404).json({ message: 'Tree not found' });

    const updates = {
      lastUpdatedAt: new Date(),
      updatedAt: new Date(),
      lastUpdatedBy: buildDisplayName(req.user) || observedBy || 'field-worker'
    };

    // Field workers can update these fields:
    if (nfcTagId !== undefined) {
      updates.nfcTagId = nfcTagId;
      updates.offlineUpdated = true;
    }
    
    if (healthStatus) updates.healthStatus = healthStatus;
    if (lifecycleStatus) updates.lifecycleStatus = lifecycleStatus;
    if (inoculationCount !== undefined) updates.inoculationCount = inoculationCount;
    if (gps) updates.gps = gps;

    // Apply auto lifecycle logic
    const lifecycleUpdates = autoUpdateLifecycleStatus(tree.toObject(), updates);
    Object.assign(updates, lifecycleUpdates);

    // Update the tree
    Object.assign(tree, updates);
    await tree.save();

    // Add to tree history
    const history = new TreeHistory({
      treeId,
      actionType: 'ManualEdit',
      newValue: updates,
      changedBy: buildDisplayName(req.user) || observedBy || 'field-worker',
      notes: notes || 'Tree updated via mobile app',
      timestamp: new Date(),
      device: 'mobile'
    });
    await history.save();

    // If NFC was assigned/unassigned, add specific history entry
    if (nfcTagId !== undefined) {
      const nfcHistory = new TreeHistory({
        treeId,
        actionType: 'ManualEdit',
        newValue: { nfcTagId },
        changedBy: observedBy || 'field-worker',
        notes: nfcTagId ? `NFC tag ${nfcTagId} assigned` : 'NFC tag unassigned',
        timestamp: new Date(),
        device: 'mobile'
      });
      await nfcHistory.save();
    }
    
    return res.json(tree);
  } catch (err) {
    console.error('mobileUpdateTree error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// Special endpoint for inoculation actions
exports.performInoculation = async (req, res) => {
  try {
    const { treeId } = req.params;
    const { inoculationType, performedBy, notes } = req.body; // inoculationType: '1st' or '2nd'

    const tree = await Tree.findOne({ treeId }).exec();
    if (!tree) return res.status(404).json({ message: 'Tree not found' });

    // Check if tree is ready for inoculation
    const age = calculateTreeAge(tree.plantedDate);
    let canInoculate = false;
    let expectedInoculationType = '';

    if (tree.inoculationCount === 0 && age.years >= 4 && tree.healthStatus === 'Healthy') {
      canInoculate = true;
      expectedInoculationType = '1st';
    } else if (tree.inoculationCount === 1 && age.totalMonths >= 52 && tree.healthStatus === 'Healthy') {
      canInoculate = true;
      expectedInoculationType = '2nd';
    }

    if (!canInoculate) {
      return res.status(400).json({ 
        message: `Tree is not ready for ${inoculationType} inoculation`,
        details: {
          currentInoculationCount: tree.inoculationCount,
          age: age.years,
          healthStatus: tree.healthStatus,
          requiredAge: inoculationType === '1st' ? '4 years' : '4 years 4 months'
        }
      });
    }

    if (inoculationType !== expectedInoculationType) {
      return res.status(400).json({ 
        message: `Expected ${expectedInoculationType} inoculation but received ${inoculationType}` 
      });
    }

    // Perform inoculation
    tree.inoculationCount += 1;
    
    // Update lifecycle status based on new inoculation count
    if (tree.inoculationCount === 1) {
      tree.lifecycleStatus = 'Inoculated Once';
      tree.readyForInoculation = false;
    } else if (tree.inoculationCount === 2) {
      tree.lifecycleStatus = 'Inoculated Twice';
      tree.readyForInoculation = false;
      
      // Check if ready for harvest
      if (age.years >= 8 && tree.healthStatus === 'Healthy') {
        tree.lifecycleStatus = 'Ready for Harvest';
        tree.readyForHarvest = true;
      }
    }

    tree.lastUpdatedBy = performedBy;
    tree.lastUpdatedAt = new Date();
    tree.updatedAt = new Date();

    await tree.save();

    // Add to tree history
    const history = new TreeHistory({
      treeId,
      actionType: 'Inoculated',
      oldValue: { 
        inoculationCount: tree.inoculationCount - 1,
        lifecycleStatus: tree.lifecycleStatus === 'Inoculated Once' ? 'Ready for 1st Inoculation' : 'Ready for 2nd Inoculation'
      },
      newValue: { 
        inoculationCount: tree.inoculationCount,
        lifecycleStatus: tree.lifecycleStatus
      },
      changedBy: performedBy,
      notes: notes || `${inoculationType} inoculation performed`,
      timestamp: new Date(),
      device: 'mobile'
    });
    await history.save();

    return res.json({
      message: `${inoculationType} inoculation completed successfully`,
      tree
    });
  } catch (err) {
    console.error('performInoculation error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// Mark inspection completed
exports.updateInspection = async (req, res) => {
  try {
    const { inspectedBy, notes } = req.body;
    const now = new Date();
    const tree = await Tree.findOneAndUpdate(
      { treeId: req.params.treeId },
      { 
        lastInspection: now, 
        inspectedBy: inspectedBy || null, 
        lastUpdatedBy: inspectedBy || null, 
        updatedAt: now,
        lastUpdatedAt: now
      },
      { new: true }
    ).exec();

    if (!tree) return res.status(404).json({ message: 'Tree not found' });

    // Add to tree history
    const history = new TreeHistory({
      treeId: req.params.treeId,
      actionType: 'Inspection',
      newValue: { lastInspection: now, inspectedBy },
      changedBy: inspectedBy,
      notes: notes || 'Inspection completed',
      timestamp: now,
      device: 'web'
    });
    await history.save();

    return res.json(tree);
  } catch (err) {
    console.error('updateInspection error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// Update lifecycle (legacy - use performInoculation instead)
exports.updateLifecycle = async (req, res) => {
  try {
    const tree = await Tree.findOne({ treeId: req.params.treeId }).exec();
    if (!tree) return res.status(404).json({ message: 'Tree not found' });

    const { action, lifecycleStatus, inoculationCount, performedBy, notes } = req.body;
    let changed = false;

    if (typeof inoculationCount === 'number') {
      tree.inoculationCount = inoculationCount;
      changed = true;
    }

    if (lifecycleStatus) {
      tree.lifecycleStatus = lifecycleStatus;
      changed = true;
    }

    if (action === 'inoculate') {
      tree.inoculationCount = (tree.inoculationCount || 0) + 1;
      if (tree.inoculationCount === 1) tree.lifecycleStatus = 'Inoculated Once';
      if (tree.inoculationCount >= 2) tree.lifecycleStatus = 'Inoculated Twice';
      changed = true;
    }

    // Auto-update based on inoculation logic
    const lifecycleUpdates = autoUpdateLifecycleStatus(tree.toObject(), {});
    Object.assign(tree, lifecycleUpdates);

    if (performedBy) {
      tree.lastUpdatedBy = performedBy;
    }
    
    if (changed) {
      tree.updatedAt = new Date();
      tree.lastUpdatedAt = new Date();
    }

    await tree.save();

    // Add to tree history
    const history = new TreeHistory({
      treeId: req.params.treeId,
      actionType: 'LifecycleUpdate',
      oldValue: { 
        lifecycleStatus: tree.lifecycleStatus, 
        inoculationCount: tree.inoculationCount - (action === 'inoculate' ? 1 : 0)
      },
      newValue: { 
        lifecycleStatus: tree.lifecycleStatus, 
        inoculationCount: tree.inoculationCount 
      },
      changedBy: performedBy,
      notes: notes || `Lifecycle updated to ${tree.lifecycleStatus}`,
      timestamp: new Date(),
      device: 'web'
    });
    await history.save();

    return res.json(tree);
  } catch (err) {
    console.error('updateLifecycle error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// Link / assign NFC tag to tree - UPDATED: Now mobile-only endpoint
exports.updateNFCTag = async (req, res) => {
  try {
    const { nfcTagId, assignedBy } = req.body;
    if (!nfcTagId) return res.status(400).json({ message: 'nfcTagId required' });

    const tree = await Tree.findOneAndUpdate(
      { treeId: req.params.treeId },
      { nfcTagId, lastUpdatedBy: assignedBy || null, updatedAt: new Date(), lastUpdatedAt: new Date() },
      { new: true }
    ).exec();

    if (!tree) return res.status(404).json({ message: 'Tree not found' });

    // Add to history
    const history = new TreeHistory({
      treeId: req.params.treeId,
      actionType: 'ManualEdit',
      newValue: { nfcTagId },
      changedBy: assignedBy,
      notes: 'NFC tag assigned via mobile app',
      timestamp: new Date(),
      device: 'mobile'
    });
    await history.save();

    return res.json(tree);
  } catch (err) {
    console.error('updateNFCTag error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// Update GPS coords - UPDATED: Now mobile-only endpoint
exports.updateGPS = async (req, res) => {
  try {
    console.log('========================================');
    console.log('🌍 GPS UPDATE REQUEST RECEIVED');
    console.log('========================================');
    console.log('Tree ID:', req.params.treeId);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('Timestamp:', new Date().toISOString());
    
    const { gps, updatedBy } = req.body;
    
    // Validate GPS data
    if (!gps || typeof gps.lat !== 'number' || typeof gps.lng !== 'number') {
      console.log('❌ Invalid GPS data:', gps);
      return res.status(400).json({ message: 'gps { lat, lng } required' });
    }
    
    console.log('✅ GPS data validated:', gps);
    console.log('   Latitude:', gps.lat);
    console.log('   Longitude:', gps.lng);
    
    // Find tree first to see current GPS
    const existingTree = await Tree.findOne({ treeId: req.params.treeId }).lean().exec();
    if (!existingTree) {
      console.log('❌ Tree not found:', req.params.treeId);
      return res.status(404).json({ message: 'Tree not found' });
    }
    
    console.log('📍 Current GPS in DB:', existingTree.gps);
    console.log('📍 New GPS to save:', gps);
    
    // Update tree
    const tree = await Tree.findOneAndUpdate(
      { treeId: req.params.treeId },
      { 
        gps, 
        lastUpdatedBy: updatedBy || null, 
        updatedAt: new Date(), 
        lastUpdatedAt: new Date() 
      },
      { new: true }
    ).exec();

    console.log('✅ Tree updated in DB');
    console.log('   Updated GPS:', tree.gps);
    
    // Verify the update
    const verifyTree = await Tree.findOne({ treeId: req.params.treeId }).lean().exec();
    console.log('🔍 Verification - GPS in DB after update:', verifyTree.gps);
    
    // Add to history
    const history = new TreeHistory({
      treeId: req.params.treeId,
      actionType: 'ManualEdit',
      oldValue: { gps: existingTree.gps },
      newValue: { gps },
      changedBy: updatedBy,
      notes: `GPS coordinates updated via mobile app from (${existingTree.gps.lat}, ${existingTree.gps.lng}) to (${gps.lat}, ${gps.lng})`,
      timestamp: new Date(),
      device: 'mobile'
    });
    await history.save();
    console.log('✅ History entry created');
    
    console.log('========================================');
    console.log('✅ GPS UPDATE COMPLETED SUCCESSFULLY');
    console.log('========================================');

    return res.json(tree);
  } catch (err) {
    console.error('========================================');
    console.error('❌ GPS UPDATE ERROR');
    console.error('========================================');
    console.error('Error:', err);
    console.error('Stack:', err.stack);
    console.error('========================================');
    return res.status(500).json({ message: err.message });
  }
};

// Archive tree (soft delete)
exports.archiveTree = async (req, res) => {
  try {
    const { archivedBy } = req.body;
    const tree = await Tree.findOneAndUpdate(
      { treeId: req.params.treeId },
      { 
        isArchived: true, 
        lastUpdatedBy: archivedBy || null, 
        updatedAt: new Date(), 
        lastUpdatedAt: new Date() 
      },
      { new: true }
    ).exec();

    if (!tree) return res.status(404).json({ message: 'Tree not found' });

    // Add to history
    const history = new TreeHistory({
      treeId: req.params.treeId,
      actionType: 'ManualEdit',
      newValue: { isArchived: true },
      changedBy: archivedBy,
      notes: 'Tree archived',
      timestamp: new Date(),
      device: 'web'
    });
    await history.save();

    return res.json(tree);
  } catch (err) {
    console.error('archiveTree error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// Get tree status summary
exports.getTreeStatusSummary = async (req, res) => {
  try {
    const tree = await Tree.findOne({ treeId: req.params.treeId }).lean().exec();
    if (!tree) return res.status(404).json({ message: 'Tree not found' });

    const age = calculateTreeAge(tree.plantedDate);
    const lifecycleStatus = determineLifecycleStatus(tree);
    
    let canInoculate = false;
    let inoculationType = '';
    let inoculationReason = '';

    if (tree.inoculationCount === 0 && age.years >= 4 && tree.healthStatus === 'Healthy') {
      canInoculate = true;
      inoculationType = '1st';
      inoculationReason = 'Tree is 4+ years old and healthy';
    } else if (tree.inoculationCount === 1 && age.totalMonths >= 52 && tree.healthStatus === 'Healthy') {
      canInoculate = true;
      inoculationType = '2nd';
      inoculationReason = 'Tree is 4 years 4+ months old, first inoculation completed, and healthy';
    }

    const canHarvest = tree.inoculationCount === 2 && age.years >= 8 && tree.healthStatus === 'Healthy';

    return res.json({
      treeId: tree.treeId,
      healthStatus: tree.healthStatus,
      currentLifecycleStatus: tree.lifecycleStatus,
      calculatedLifecycleStatus: lifecycleStatus,
      age: {
        years: age.years,
        months: age.months,
        totalMonths: age.totalMonths
      },
      inoculation: {
        count: tree.inoculationCount,
        canInoculate,
        inoculationType,
        inoculationReason,
        nextInoculationAge: inoculationType === '1st' ? '4 years' : '4 years 4 months'
      },
      harvest: {
        canHarvest,
        readyForHarvest: tree.readyForHarvest,
        harvestAge: '8 years',
        reason: canHarvest ? 'Tree is 8+ years old with both inoculations completed and healthy' : 'Not ready for harvest'
      },
      flags: {
        readyForInoculation: tree.readyForInoculation,
        readyForHarvest: tree.readyForHarvest
      }
    });
  } catch (err) {
    console.error('getTreeStatusSummary error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// ========== FIELD NOTES / OBSERVATIONS ==========
exports.getTreeObservations = async (req, res) => {
  try {
    const observations = await Observation.find({ treeId: req.params.treeId })
      .sort({ timestamp: -1 })
      .lean()
      .exec();
    return res.json(observations);
  } catch (err) {
    console.error('getTreeObservations error:', err);
    return res.status(500).json({ message: err.message });
  }
};

exports.addObservation = async (req, res) => {
  try {
    const { treeId } = req.params;
    const { notes, images, healthStatus, observedBy, type } = req.body;

    if (!notes) {
      return res.status(400).json({ message: 'Notes are required' });
    }

    // Use JWT user display name if available, otherwise fall back to body value
    const callerDisplayName = buildDisplayName(req.user) || observedBy;
    if (!callerDisplayName) {
      return res.status(400).json({ message: 'observedBy is required' });
    }

    const observation = new Observation({
      observationId: `OBS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      treeId,
      notes,
      // FIX: Accept base64 strings or URLs — store whatever arrives in the array
      images: Array.isArray(images) ? images : [],
      healthStatus: healthStatus || 'Healthy',
      observedBy: callerDisplayName,
      type: type || 'Routine',
      timestamp: new Date(),
      canEdit: true,
      lastUpdatedAt: new Date(),
    });

    await observation.save();

    // Add to tree history
    const history = new TreeHistory({
      treeId,
      actionType: 'NoteAdded',
      newValue: {
        observationId: observation.observationId,
        notes: notes.substring(0, 100) + (notes.length > 100 ? '...' : ''),
        type: type || 'Routine',
        imagesCount: observation.images.length,
      },
      changedBy: callerDisplayName,
      notes: 'Field note added',
      timestamp: new Date(),
      device: 'mobile',
    });
    await history.save();

    return res.status(201).json(observation);
  } catch (err) {
    console.error('addObservation error:', err);
    return res.status(500).json({ message: err.message });
  }
};

exports.updateObservation = async (req, res) => {
  try {
    const { observationId } = req.params;
    // FIX: also accept 'type' in the update payload
    const { notes, images, type, lastUpdatedBy } = req.body;

    const observation = await Observation.findOne({ observationId });
    if (!observation) {
      return res.status(404).json({ message: 'Observation not found' });
    }

    const callerDisplayName = buildDisplayName(req.user) || lastUpdatedBy;

    // FIX: relaxed author check — compare trimmed lowercase so minor
    // differences in whitespace or case don't block legitimate edits
    const storedAuthor = (observation.observedBy || '').trim().toLowerCase();
    const callerName   = (callerDisplayName || '').trim().toLowerCase();

    if (storedAuthor && callerName && storedAuthor !== callerName) {
      return res.status(403).json({ message: 'Cannot edit another user\'s note' });
    }

    const oldNotes = observation.notes;

    if (notes    !== undefined) observation.notes  = notes;
    if (type     !== undefined) observation.type   = type;   // FIX: persist type change
    if (images   !== undefined) observation.images = Array.isArray(images) ? images : [];

    observation.lastUpdatedBy = callerDisplayName;
    observation.lastUpdatedAt = new Date();

    await observation.save();

    if (oldNotes !== notes) {
      const history = new TreeHistory({
        treeId: observation.treeId,
        actionType: 'NoteAdded',
        oldValue: { notes: oldNotes.substring(0, 100) + (oldNotes.length > 100 ? '...' : '') },
        newValue: { notes: (notes || '').substring(0, 100) + ((notes || '').length > 100 ? '...' : '') },
        changedBy: callerDisplayName,
        notes: 'Field note updated',
        timestamp: new Date(),
        device: 'mobile',
      });
      await history.save();
    }

    return res.json(observation);
  } catch (err) {
    console.error('updateObservation error:', err);
    return res.status(500).json({ message: err.message });
  }
};

exports.deleteObservation = async (req, res) => {
  try {
    const { observationId } = req.params;
    const { deletedBy } = req.body;

    const observation = await Observation.findOne({ observationId });
    if (!observation) {
      return res.status(404).json({ message: 'Observation not found' });
    }

    const callerDisplayName = buildDisplayName(req.user) || deletedBy;

    // FIX: same relaxed case-insensitive author check as update
    const storedAuthor = (observation.observedBy || '').trim().toLowerCase();
    const callerName   = (callerDisplayName || '').trim().toLowerCase();

    if (storedAuthor && callerName && storedAuthor !== callerName) {
      return res.status(403).json({ message: 'Cannot delete another user\'s note' });
    }

    await Observation.deleteOne({ observationId });

    // Add to history
    const history = new TreeHistory({
      treeId: observation.treeId,
      actionType: 'NoteAdded',
      oldValue: {
        observationId,
        notes: observation.notes.substring(0, 100) + (observation.notes.length > 100 ? '...' : ''),
      },
      changedBy: callerDisplayName,
      notes: 'Field note deleted',
      timestamp: new Date(),
      device: 'mobile',
    });
    await history.save();

    return res.json({ message: 'Observation deleted successfully' });
  } catch (err) {
    console.error('deleteObservation error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// ========== TREE HISTORY ==========
exports.getTreeHistory = async (req, res) => {
  try {
    const history = await TreeHistory.find({ treeId: req.params.treeId })
      .sort({ timestamp: -1 })
      .lean()
      .exec();
    return res.json(history);
  } catch (err) {
    console.error('getTreeHistory error:', err);
    return res.status(500).json({ message: err.message });
  }
};

exports.getAllTreeHistory = async (req, res) => {
  try {
    const filter = { treeId: req.params.treeId };
    
    // Optional filters
    if (req.query.actionType) filter.actionType = req.query.actionType;
    if (req.query.changedBy) filter.changedBy = req.query.changedBy;
    
    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filter.timestamp = {};
      if (req.query.startDate) filter.timestamp.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.timestamp.$lte = new Date(req.query.endDate);
    }

    const history = await TreeHistory.find(filter)
      .sort({ timestamp: -1 })
      .lean()
      .exec();
      
    return res.json(history);
  } catch (err) {
    console.error('getAllTreeHistory error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// Get tree by NFC tag content (the treeId written on the card, e.g. "TB-000023")
exports.getTreeByNFCTag = async (req, res) => {
  try {
    const { nfcTagId } = req.params;
    
    // First try: the card stores the treeId directly (e.g. "TB-000023")
    let tree = await Tree.findOne({ treeId: nfcTagId }).lean().exec();
    
    // Second try: the card stores the nfcTagId field value
    if (!tree) {
      tree = await Tree.findOne({ nfcTagId: nfcTagId }).lean().exec();
    }
    
    if (!tree) {
      return res.status(404).json({ 
        message: `No tree found for NFC tag: ${nfcTagId}` 
      });
    }
    
    // Return tree with calculated fields
    const ageData = calculateTreeAge(tree.plantedDate);
    return res.json({
      ...tree,
      calculatedAge: ageData,
      calculatedLifecycleStatus: determineLifecycleStatus(tree)
    });
  } catch (err) {
    console.error('getTreeByNFCTag error:', err);
    return res.status(500).json({ message: err.message });
  }
};