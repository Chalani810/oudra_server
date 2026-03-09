
const Tree = require('../models/TreeModel');
const Observation = require('../models/Observations');
const TreeHistory = require('../models/TreeHistory');

const { getNextAvailableNumber, buildTreeId } = require('./autoIncrementController');

async function getNextTreeId(block) {
  const num = await getNextAvailableNumber();
  return buildTreeId(block, num);
}

function calculateTreeAge(plantedDate) {
  if (!plantedDate) return { years: 0, months: 0, totalMonths: 0 };
  
  const planted = new Date(plantedDate);
  const now = new Date();
  
  let years = now.getFullYear() - planted.getFullYear();
  let months = now.getMonth() - planted.getMonth();
  let days = now.getDate() - planted.getDate();
  
  if (days < 0) {
    months--;
    const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    days += prevMonth.getDate();
  }
  
  if (months < 0) {
    years--;
    months += 12;
  }
  
  return { years, months, totalMonths: (years * 12) + months };
}

function determineLifecycleStatus(treeData) {
  if (!treeData) return 'Growing';
  
  const { plantedDate, healthStatus, inoculationCount, lifecycleStatus } = treeData;
  
  if (healthStatus === 'Dead' || lifecycleStatus === 'Harvested') {
    return lifecycleStatus === 'Harvested' ? 'Harvested' : 'Dead - Lifecycle Stopped';
  }
  
  const age = calculateTreeAge(plantedDate);
  
  if (inoculationCount === 0) {
    if (age.years >= 4 && healthStatus === 'Healthy') return 'Ready for 1st Inoculation';
    return 'Growing';
  } else if (inoculationCount === 1) {
    if (age.totalMonths >= 52 && healthStatus === 'Healthy') return 'Ready for 2nd Inoculation';
    return 'Inoculated Once';
  } else if (inoculationCount === 2) {
    if (age.years >= 8 && healthStatus === 'Healthy') return 'Ready for Harvest';
    return 'Inoculated Twice';
  }
  
  return lifecycleStatus || 'Growing';
}

function canProgressLifecycle(treeData) {
  if (!treeData) return true;
  const { healthStatus, lifecycleStatus } = treeData;
  if (healthStatus === 'Dead' || lifecycleStatus === 'Harvested') return false;
  return true;
}

function autoUpdateLifecycleStatus(treeData, updates) {
  const tree = { ...treeData, ...updates };
  
  if (tree.healthStatus === 'Dead' || tree.lifecycleStatus === 'Harvested') {
    return { lifecycleStatus: tree.lifecycleStatus, readyForInoculation: false, readyForHarvest: false };
  }
  
  const age = calculateTreeAge(tree.plantedDate);
  const inoculationCount = tree.inoculationCount || 0;
  const healthStatus = tree.healthStatus || 'Healthy';
  
  let lifecycleStatus = tree.lifecycleStatus || 'Growing';
  let readyForInoculation = false;
  let readyForHarvest = false;
  
  if (inoculationCount === 0) {
    if (age.years >= 4 && healthStatus === 'Healthy') {
      lifecycleStatus = 'Ready for 1st Inoculation';
      readyForInoculation = true;
    } else {
      lifecycleStatus = 'Growing';
    }
  } else if (inoculationCount === 1) {
    if (age.totalMonths >= 52 && healthStatus === 'Healthy') {
      lifecycleStatus = 'Ready for 2nd Inoculation';
      readyForInoculation = true;
    } else {
      lifecycleStatus = 'Inoculated Once';
    }
  } else if (inoculationCount === 2) {
    if (age.years >= 8 && healthStatus === 'Healthy') {
      lifecycleStatus = 'Ready for Harvest';
      readyForHarvest = true;
    } else {
      lifecycleStatus = 'Inoculated Twice';
    }
  }
  
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
  if (firstName && lastName && userId) return `${firstName} ${lastName} (${userId})`;
  if (firstName && userId) return `${firstName} (${userId})`;
  return userId || 'field-worker';
}

// Create a new tree
exports.createTree = async (req, res) => {
  try {
    const { investorId, investorName, block } = req.body;
    
    if (!block) return res.status(400).json({ message: 'Block is required' });

    const userData = req.user || {};
    const lastUpdatedBy = userData.userId ? `${userData.userId} - ${userData.name || 'Manager'}` : 'web-admin';

    const seq = await getNextTreeSequence();
    const treeId = formatTreeId(seq);
    const plantedDate = new Date();
    const ageData = calculateTreeAge(plantedDate);

    const tree = new Tree({
      treeId,
      nfcTagId: null,
      plantedDate,
      age: ageData.years,
      investorId: investorId || null,
      investorName: investorName || null,
      block,
      gps: { lat: 0, lng: 0 },
      healthStatus: 'Healthy',
      lastInspection: null,
      inspectedBy: null,
      lastUpdatedAt: new Date(),
      lastUpdatedBy,
      offlineUpdated: false,
      lifecycleStatus: 'Growing',
      inoculationCount: 0,
      readyForInoculation: false,
      readyForHarvest: false,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await tree.save();

    const history = new TreeHistory({
      treeId,
      actionType: 'ManualEdit',
      newValue: { treeId, block, investorId: investorId || null, investorName: investorName || null, plantedDate, healthStatus: 'Healthy', lifecycleStatus: 'Growing' },
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

// Getting all trees
exports.getAllTrees = async (req, res) => {
  try {
    const filter = {};
    if (req.query.block) filter.block = req.query.block;
    if (req.query.status) filter.healthStatus = req.query.status;
    if (req.query.includeArchived !== 'true') filter.isArchived = { $ne: true };

    const trees = await Tree.find(filter).lean().exec();

    // Recalculate lifecycle for each tree before returning
    // (DB value may be stale for trees that aged into a new lifecycle stage)
    const treesWithCorrectLifecycle = trees.map(tree => ({
      ...tree,
      lifecycleStatus: determineLifecycleStatus(tree),
    }));

    return res.json(treesWithCorrectLifecycle);
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
    
    const ageData = calculateTreeAge(tree.plantedDate);
    return res.json({
      ...tree,
      calculatedAge: ageData,
      calculatedLifecycleStatus: determineLifecycleStatus(tree)
    });
  } catch (err) {
    console.error('getTreeById error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// Generic update
exports.updateTree = async (req, res) => {
  try {
    const tree = await Tree.findOne({ treeId: req.params.treeId }).exec();
    if (!tree) return res.status(404).json({ message: 'Tree not found' });
    
    const userData = req.user || {};
    const lastUpdatedBy = userData.userId ? `${userData.userId} - ${userData.name || 'Manager'}` : 'web-admin';
    
    const allowedUpdates = ['block', 'investorId', 'investorName'];
    const updates = { lastUpdatedBy, lastUpdatedAt: new Date(), updatedAt: new Date() };
    
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    
    Object.assign(tree, updates);
    await tree.save();

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

// DELETE tree permanently
exports.deleteTree = async (req, res) => {
  try {
    const { deletedBy } = req.body;
    const { treeId } = req.params;

    const tree = await Tree.findOneAndDelete({ treeId });
    if (!tree) return res.status(404).json({ message: 'Tree not found' });

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

    await Observation.deleteMany({ treeId });

    return res.json({ message: 'Tree deleted successfully', deletedTree: tree });
  } catch (err) {
    console.error('deleteTree error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// Update tree profile (manager only)
exports.updateTreeProfile = async (req, res) => {
  try {
    const { treeId } = req.params;
    const { lastUpdatedBy, block, investorId, investorName } = req.body;

    const tree = await Tree.findOne({ treeId }).exec();
    if (!tree) return res.status(404).json({ message: 'Tree not found' });

    const updates = { lastUpdatedBy, lastUpdatedAt: new Date(), updatedAt: new Date() };
    if (block !== undefined)        updates.block        = block;
    if (investorId !== undefined)   updates.investorId   = investorId;
    if (investorName !== undefined) updates.investorName = investorName;

    Object.assign(tree, updates);
    await tree.save();

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

// Mobile tree profile update (field workers)
exports.mobileUpdateTreeProfile = async (req, res) => {
  try {
    const { treeId } = req.params;
    const { 
    healthStatus, 
    inoculationCount,
    lifecycleStatus, 
    block,
    lastUpdatedBy
  } = req.body;

    const tree = await Tree.findOne({ treeId }).exec();
    if (!tree) return res.status(404).json({ message: 'Tree not found' });

    if (tree.healthStatus === 'Dead' || tree.lifecycleStatus === 'Harvested') {
      return res.status(400).json({ 
        message: tree.healthStatus === 'Dead' 
          ? 'Cannot update a dead tree. Lifecycle has stopped permanently.'
          : 'Cannot update a harvested tree. Record is preserved for tracking.',
        currentStatus: tree.healthStatus === 'Dead' ? 'Dead' : 'Harvested'
      });
    }

    const updates = {
      lastUpdatedBy: buildDisplayName(req.user) || lastUpdatedBy || 'field-worker',
      lastUpdatedAt: new Date(),
      updatedAt: new Date()
    };

    // Update allowed fields if provided
      if (healthStatus !== undefined) updates.healthStatus = healthStatus;
      if (inoculationCount !== undefined) updates.inoculationCount = parseInt(inoculationCount);
      if (block !== undefined) updates.block = block;

      // If lifecycleStatus is explicitly set to 'Harvested', honour it directly
      // and skip auto-calculation so it cannot be overwritten
      if (lifecycleStatus === 'Harvested') {
        updates.lifecycleStatus = 'Harvested';
        updates.readyForInoculation = false;
        updates.readyForHarvest = false;

        // Add to history and save immediately
        Object.assign(tree, updates);
        await tree.save();

        const history = new TreeHistory({
          treeId,
          actionType: 'ManualEdit',
          oldValue: { lifecycleStatus: tree.lifecycleStatus },
          newValue: { lifecycleStatus: 'Harvested' },
          changedBy: buildDisplayName(req.user) || lastUpdatedBy || 'field-worker',
          notes: 'Tree marked as harvested via mobile app',
          timestamp: new Date(),
          device: 'mobile'
        });
        await history.save();

        return res.json({
          ...tree.toObject(),
          calculatedLifecycleStatus: 'Harvested',
          calculatedAge: calculateTreeAge(tree.plantedDate)
        });
      }

      // For all other updates, auto-calculate lifecycle status
      const newTreeData = { ...tree.toObject(), ...updates };
      const calculatedLifecycle = determineLifecycleStatus(newTreeData);
      updates.lifecycleStatus = calculatedLifecycle;

    const age = calculateTreeAge(tree.plantedDate);
    const newInoculationCount = inoculationCount !== undefined ? parseInt(inoculationCount) : tree.inoculationCount;
    const newHealthStatus = healthStatus || tree.healthStatus;
    
    updates.readyForInoculation =
      (newInoculationCount === 0 && age.years >= 4 && newHealthStatus === 'Healthy') ||
      (newInoculationCount === 1 && age.totalMonths >= 52 && newHealthStatus === 'Healthy');

    updates.readyForHarvest =
      newInoculationCount === 2 && age.years >= 8 && newHealthStatus === 'Healthy';

    const previousLifecycle = tree.lifecycleStatus;

    Object.assign(tree, updates);
    await tree.save();

    // ── BLOCKCHAIN: Record status change if lifecycle changed & tree is enrolled ──
    if (calculatedLifecycle !== previousLifecycle) {
      blockchainService.recordStatusChange(treeId, calculatedLifecycle, tree.blockchainStatus)
        .then(result => {
          if (result.success) {
            console.log(`🔗 Status change recorded on blockchain: ${treeId} → ${calculatedLifecycle}`);
            Tree.findOneAndUpdate({ treeId }, { blockchainStatusTxHash: result.transactionHash }).catch(() => {});
          }
        })
        .catch(err => console.error('❌ Blockchain status update error:', err.message));
    }

    const history = new TreeHistory({
      treeId,
      actionType: 'ManualEdit',
      oldValue: { healthStatus: tree.healthStatus, inoculationCount: tree.inoculationCount, lifecycleStatus: previousLifecycle, block: tree.block },
      newValue: updates,
      changedBy: buildDisplayName(req.user) || lastUpdatedBy || 'field-worker',
      notes: 'Tree profile updated via mobile app',
      timestamp: new Date(),
      device: 'mobile'
    });
    await history.save();
    
    return res.json({
      ...tree.toObject(),
      calculatedLifecycleStatus: calculatedLifecycle,
      calculatedAge: calculateTreeAge(tree.plantedDate)
    });
  } catch (err) {
    console.error('mobileUpdateTreeProfile error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// Mobile app endpoint for field worker updates
exports.mobileUpdateTree = async (req, res) => {
  try {
    const { treeId } = req.params;
    const { nfcTagId, healthStatus, lifecycleStatus, inoculationCount, gps, observedBy, notes } = req.body;

    const tree = await Tree.findOne({ treeId }).exec();
    if (!tree) return res.status(404).json({ message: 'Tree not found' });

    const updates = {
      lastUpdatedAt: new Date(),
      updatedAt: new Date(),
      lastUpdatedBy: buildDisplayName(req.user) || observedBy || 'field-worker'
    };

    if (nfcTagId !== undefined)      { updates.nfcTagId = nfcTagId; updates.offlineUpdated = true; }
    if (healthStatus)                  updates.healthStatus    = healthStatus;
    if (lifecycleStatus)               updates.lifecycleStatus = lifecycleStatus;
    if (inoculationCount !== undefined) updates.inoculationCount = inoculationCount;
    if (gps)                           updates.gps             = gps;

    const lifecycleUpdates = autoUpdateLifecycleStatus(tree.toObject(), updates);
    Object.assign(updates, lifecycleUpdates);

    Object.assign(tree, updates);
    await tree.save();

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

// Inoculation action
exports.performInoculation = async (req, res) => {
  try {
    const { treeId } = req.params;
    const { inoculationType, performedBy, notes } = req.body;

    const tree = await Tree.findOne({ treeId }).exec();
    if (!tree) return res.status(404).json({ message: 'Tree not found' });

    const age = calculateTreeAge(tree.plantedDate);
    let canInoculate = false;
    let expectedInoculationType = '';

    if (tree.inoculationCount === 0 && age.years >= 4 && tree.healthStatus === 'Healthy') {
      canInoculate = true; expectedInoculationType = '1st';
    } else if (tree.inoculationCount === 1 && age.totalMonths >= 52 && tree.healthStatus === 'Healthy') {
      canInoculate = true; expectedInoculationType = '2nd';
    }

    if (!canInoculate) {
      return res.status(400).json({ 
        message: `Tree is not ready for ${inoculationType} inoculation`,
        details: { currentInoculationCount: tree.inoculationCount, age: age.years, healthStatus: tree.healthStatus }
      });
    }

    if (inoculationType !== expectedInoculationType) {
      return res.status(400).json({ message: `Expected ${expectedInoculationType} inoculation but received ${inoculationType}` });
    }

    const previousLifecycle = tree.lifecycleStatus;
    tree.inoculationCount += 1;
    
    if (tree.inoculationCount === 1) {
      tree.lifecycleStatus = 'Inoculated Once';
      tree.readyForInoculation = false;
    } else if (tree.inoculationCount === 2) {
      tree.lifecycleStatus = age.years >= 8 && tree.healthStatus === 'Healthy' ? 'Ready for Harvest' : 'Inoculated Twice';
      tree.readyForInoculation = false;
      tree.readyForHarvest = tree.lifecycleStatus === 'Ready for Harvest';
    }

    tree.lastUpdatedBy = performedBy;
    tree.lastUpdatedAt = new Date();
    tree.updatedAt = new Date();

    await tree.save();

    // ── BLOCKCHAIN: Record inoculation status change ──────────────────────────
    if (tree.lifecycleStatus !== previousLifecycle) {
      blockchainService.recordStatusChange(treeId, tree.lifecycleStatus, tree.blockchainStatus)
        .then(result => {
          if (result.success) {
            console.log(`🔗 Inoculation status recorded on blockchain: ${treeId} → ${tree.lifecycleStatus}`);
          }
        })
        .catch(err => console.error('❌ Blockchain inoculation status error:', err.message));
    }

    const history = new TreeHistory({
      treeId,
      actionType: 'Inoculated',
      oldValue: { inoculationCount: tree.inoculationCount - 1, lifecycleStatus: previousLifecycle },
      newValue: { inoculationCount: tree.inoculationCount, lifecycleStatus: tree.lifecycleStatus },
      changedBy: performedBy,
      notes: notes || `${inoculationType} inoculation performed`,
      timestamp: new Date(),
      device: 'mobile'
    });
    await history.save();

    return res.json({ message: `${inoculationType} inoculation completed successfully`, tree });
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
      { lastInspection: now, inspectedBy: inspectedBy || null, lastUpdatedBy: inspectedBy || null, updatedAt: now, lastUpdatedAt: now },
      { new: true }
    ).exec();

    if (!tree) return res.status(404).json({ message: 'Tree not found' });

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

// Update lifecycle (legacy)
exports.updateLifecycle = async (req, res) => {
  try {
    const tree = await Tree.findOne({ treeId: req.params.treeId }).exec();
    if (!tree) return res.status(404).json({ message: 'Tree not found' });

    const { action, lifecycleStatus, inoculationCount, performedBy, notes } = req.body;
    let changed = false;

    if (typeof inoculationCount === 'number') { tree.inoculationCount = inoculationCount; changed = true; }
    if (lifecycleStatus) { tree.lifecycleStatus = lifecycleStatus; changed = true; }
    if (action === 'inoculate') {
      tree.inoculationCount = (tree.inoculationCount || 0) + 1;
      if (tree.inoculationCount === 1) tree.lifecycleStatus = 'Inoculated Once';
      if (tree.inoculationCount >= 2) tree.lifecycleStatus = 'Inoculated Twice';
      changed = true;
    }

    const lifecycleUpdates = autoUpdateLifecycleStatus(tree.toObject(), {});
    Object.assign(tree, lifecycleUpdates);

    if (performedBy) tree.lastUpdatedBy = performedBy;
    if (changed) { tree.updatedAt = new Date(); tree.lastUpdatedAt = new Date(); }

    await tree.save();

    const history = new TreeHistory({
      treeId: req.params.treeId,
      actionType: 'LifecycleUpdate',
      oldValue: { lifecycleStatus: tree.lifecycleStatus, inoculationCount: tree.inoculationCount - (action === 'inoculate' ? 1 : 0) },
      newValue: { lifecycleStatus: tree.lifecycleStatus, inoculationCount: tree.inoculationCount },
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

// Link NFC tag
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

// Update GPS
exports.updateGPS = async (req, res) => {
  try {
    const { gps, updatedBy } = req.body;
    
    if (!gps || typeof gps.lat !== 'number' || typeof gps.lng !== 'number') {
      return res.status(400).json({ message: 'gps { lat, lng } required' });
    }
    
    const existingTree = await Tree.findOne({ treeId: req.params.treeId }).lean().exec();
    if (!existingTree) return res.status(404).json({ message: 'Tree not found' });
    
    const tree = await Tree.findOneAndUpdate(
      { treeId: req.params.treeId },
      { gps, lastUpdatedBy: updatedBy || null, updatedAt: new Date(), lastUpdatedAt: new Date() },
      { new: true }
    ).exec();

    const history = new TreeHistory({
      treeId: req.params.treeId,
      actionType: 'ManualEdit',
      oldValue: { gps: existingTree.gps },
      newValue: { gps },
      changedBy: updatedBy,
      notes: `GPS updated from (${existingTree.gps.lat}, ${existingTree.gps.lng}) to (${gps.lat}, ${gps.lng})`,
      timestamp: new Date(),
      device: 'mobile'
    });
    await history.save();

    return res.json(tree);
  } catch (err) {
    console.error('updateGPS error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// Archive tree
exports.archiveTree = async (req, res) => {
  try {
    const { archivedBy } = req.body;
    const tree = await Tree.findOneAndUpdate(
      { treeId: req.params.treeId },
      { isArchived: true, lastUpdatedBy: archivedBy || null, updatedAt: new Date(), lastUpdatedAt: new Date() },
      { new: true }
    ).exec();

    if (!tree) return res.status(404).json({ message: 'Tree not found' });

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

// Tree status summary
exports.getTreeStatusSummary = async (req, res) => {
  try {
    const tree = await Tree.findOne({ treeId: req.params.treeId }).lean().exec();
    if (!tree) return res.status(404).json({ message: 'Tree not found' });

    const age = calculateTreeAge(tree.plantedDate);
    const lifecycleStatus = determineLifecycleStatus(tree);
    
    let canInoculate = false, inoculationType = '', inoculationReason = '';

    if (tree.inoculationCount === 0 && age.years >= 4 && tree.healthStatus === 'Healthy') {
      canInoculate = true; inoculationType = '1st'; inoculationReason = 'Tree is 4+ years old and healthy';
    } else if (tree.inoculationCount === 1 && age.totalMonths >= 52 && tree.healthStatus === 'Healthy') {
      canInoculate = true; inoculationType = '2nd'; inoculationReason = 'Tree is 4 years 4+ months old, first inoculation completed, and healthy';
    }

    const canHarvest = tree.inoculationCount === 2 && age.years >= 8 && tree.healthStatus === 'Healthy';

    return res.json({
      treeId: tree.treeId,
      healthStatus: tree.healthStatus,
      currentLifecycleStatus: tree.lifecycleStatus,
      calculatedLifecycleStatus: lifecycleStatus,
      age: { years: age.years, months: age.months, totalMonths: age.totalMonths },
      inoculation: { count: tree.inoculationCount, canInoculate, inoculationType, inoculationReason },
      harvest: { canHarvest, readyForHarvest: tree.readyForHarvest, harvestAge: '8 years' },
      flags: { readyForInoculation: tree.readyForInoculation, readyForHarvest: tree.readyForHarvest }
    });
  } catch (err) {
    console.error('getTreeStatusSummary error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// ========== FIELD NOTES / OBSERVATIONS ==========
exports.getTreeObservations = async (req, res) => {
  try {
    const observations = await Observation.find({ treeId: req.params.treeId }).sort({ timestamp: -1 }).lean().exec();
    return res.json(observations);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.addObservation = async (req, res) => {
  try {
    const { treeId } = req.params;
    const { notes, images, healthStatus, observedBy, type } = req.body;

    if (!notes) return res.status(400).json({ message: 'Notes are required' });

    const callerDisplayName = buildDisplayName(req.user) || observedBy;
    if (!callerDisplayName) return res.status(400).json({ message: 'observedBy is required' });

    const observation = new Observation({
      observationId: `OBS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      treeId,
      notes,
      images: Array.isArray(images) ? images : [],
      healthStatus: healthStatus || 'Healthy',
      observedBy: callerDisplayName,
      type: type || 'Routine',
      timestamp: new Date(),
      canEdit: true,
      lastUpdatedAt: new Date(),
    });

    await observation.save();

    const history = new TreeHistory({
      treeId,
      actionType: 'NoteAdded',
      newValue: { observationId: observation.observationId, notes: notes.substring(0, 100), type: type || 'Routine', imagesCount: observation.images.length },
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
    const { notes, images, type, lastUpdatedBy } = req.body;

    const observation = await Observation.findOne({ observationId });
    if (!observation) return res.status(404).json({ message: 'Observation not found' });

    const callerDisplayName = buildDisplayName(req.user) || lastUpdatedBy;
    const storedAuthor = (observation.observedBy || '').trim().toLowerCase();
    const callerName   = (callerDisplayName || '').trim().toLowerCase();

    if (storedAuthor && callerName && storedAuthor !== callerName) {
      return res.status(403).json({ message: 'Cannot edit another user\'s note' });
    }

    const oldNotes = observation.notes;
    if (notes  !== undefined) observation.notes  = notes;
    if (type   !== undefined) observation.type   = type;
    if (images !== undefined) observation.images = Array.isArray(images) ? images : [];
    observation.lastUpdatedBy = callerDisplayName;
    observation.lastUpdatedAt = new Date();
    await observation.save();

    if (oldNotes !== notes) {
      const history = new TreeHistory({
        treeId: observation.treeId,
        actionType: 'NoteAdded',
        oldValue: { notes: oldNotes.substring(0, 100) },
        newValue: { notes: (notes || '').substring(0, 100) },
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
    if (!observation) return res.status(404).json({ message: 'Observation not found' });

    const callerDisplayName = buildDisplayName(req.user) || deletedBy;
    const storedAuthor = (observation.observedBy || '').trim().toLowerCase();
    const callerName   = (callerDisplayName || '').trim().toLowerCase();

    if (storedAuthor && callerName && storedAuthor !== callerName) {
      return res.status(403).json({ message: 'Cannot delete another user\'s note' });
    }

    await Observation.deleteOne({ observationId });

    const history = new TreeHistory({
      treeId: observation.treeId,
      actionType: 'NoteAdded',
      oldValue: { observationId, notes: observation.notes.substring(0, 100) },
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
    const history = await TreeHistory.find({ treeId: req.params.treeId }).sort({ timestamp: -1 }).lean().exec();
    return res.json(history);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.getAllTreeHistory = async (req, res) => {
  try {
    const filter = { treeId: req.params.treeId };
    if (req.query.actionType) filter.actionType = req.query.actionType;
    if (req.query.changedBy)  filter.changedBy  = req.query.changedBy;
    if (req.query.startDate || req.query.endDate) {
      filter.timestamp = {};
      if (req.query.startDate) filter.timestamp.$gte = new Date(req.query.startDate);
      if (req.query.endDate)   filter.timestamp.$lte = new Date(req.query.endDate);
    }

    const history = await TreeHistory.find(filter).sort({ timestamp: -1 }).lean().exec();
    return res.json(history);
  } catch (err) {
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