//path: oudra-server(same backend for web & mobile apps)>app>controllers>treeController.js
const Tree = require('../models/TreeModel');
const AutoIncrementTreeIdCount = require('../models/AutoIncrementTreeIdCount');
const Observation = require('../models/Observations');
const TreeHistory = require('../models/TreeHistory');

// Helper to get next sequence number for treeId - FIXED VERSION
async function getNextTreeSequence() {
  try {
    // Get all existing tree IDs to find gaps from deletions
    const existingTrees = await Tree.find({}, 'treeId').sort({ treeId: 1 }).lean();
    const existingIds = existingTrees.map(tree => {
      const num = parseInt(tree.treeId.replace('T-', ''));
      return isNaN(num) ? 0 : num;
    }).filter(num => num > 0).sort((a, b) => a - b);

    console.log('Existing Tree IDs:', existingIds); // Debug log

    // Find the first gap or use the next sequential number
    let nextId = 1;
    for (let i = 0; i < existingIds.length; i++) {
      if (existingIds[i] !== i + 1) {
        nextId = i + 1;
        break;
      }
      nextId = existingIds[i] + 1;
    }

    console.log('Calculated nextId from gaps:', nextId); // Debug log

    // Get current counter
    const currentCounter = await AutoIncrementTreeIdCount.findOne({ _id: 'tree' });
    console.log('Current counter seq:', currentCounter?.seq); // Debug log

    // If we found a gap, use that ID and update counter to be one more than the gap
    if (!currentCounter || currentCounter.seq < nextId) {
      const updatedCounter = await AutoIncrementTreeIdCount.findOneAndUpdate(
        { _id: 'tree' },
        { seq: nextId + 1 }, // Set counter to NEXT number after the gap
        { new: true, upsert: true }
      );
      console.log('Updated counter for gap:', updatedCounter.seq); // Debug log
      return nextId;
    }

    // If no gaps found, use and increment the counter normally
    const doc = await AutoIncrementTreeIdCount.findOneAndUpdate(
      { _id: 'tree' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    console.log('Using counter seq:', doc.seq); // Debug log
    return doc.seq - 1; // Return the value BEFORE increment (since we want the current number)
    
  } catch (error) {
    console.error('Error in getNextTreeSequence:', error);
    // Fallback to original method
    const doc = await AutoIncrementTreeIdCount.findOneAndUpdate(
      { _id: 'tree' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    return doc.seq;
  }
}

function formatTreeId(seq) {
  return `T-${String(seq).padStart(6, '0')}`;
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

// Create a new tree
exports.createTree = async (req, res) => {
  try {
    const { gps, plantedDate, healthStatus } = req.body;
    
    // Validate GPS - make it optional for creation
    let gpsData = { lat: 0, lng: 0 };
    if (gps && typeof gps.lat === 'number' && typeof gps.lng === 'number') {
      gpsData = gps;
    }

    // Calculate age when the plantedDate is provided
    let age = null;
    if (plantedDate) {
      const planted = new Date(plantedDate);
      const now = new Date();
      const diffTime = Math.abs(now - planted);
      const diffYears = Math.floor(diffTime / (1000 * 60 * 60 * 24 * 365));
      age = diffYears;
    }

    const seq = await getNextTreeSequence();
    const treeId = formatTreeId(seq);

    // Determine initial lifecycle status
    const initialHealthStatus = healthStatus || 'Healthy';
    const initialInoculationCount = typeof req.body.inoculationCount === 'number' ? req.body.inoculationCount : 0;
    
    let initialLifecycleStatus = 'Growing';
    let readyForInoculation = false;
    let readyForHarvest = false;
    
    if (plantedDate) {
      const ageData = calculateTreeAge(plantedDate);
      if (initialInoculationCount === 0) {
        if (ageData.years >= 4 && initialHealthStatus === 'Healthy') {
          initialLifecycleStatus = 'Ready for 1st Inoculation';
          readyForInoculation = true;
        }
      } else if (initialInoculationCount === 1) {
        if (ageData.totalMonths >= 52 && initialHealthStatus === 'Healthy') {
          initialLifecycleStatus = 'Ready for 2nd Inoculation';
          readyForInoculation = true;
        } else {
          initialLifecycleStatus = 'Inoculated Once';
        }
      } else if (initialInoculationCount === 2) {
        if (ageData.years >= 8 && initialHealthStatus === 'Healthy') {
          initialLifecycleStatus = 'Ready for Harvest';
          readyForHarvest = true;
        } else {
          initialLifecycleStatus = 'Inoculated Twice';
        }
      }
    }

    const payload = {
      treeId,
      nfcTagId: req.body.nfcTagId || null,
      plantedDate: req.body.plantedDate ? new Date(req.body.plantedDate) : null,
      age: age,
      investorId: req.body.investorId || null,
      investorName: req.body.investorName || null,
      block: req.body.block || null,
      gps: gpsData,
      healthStatus: initialHealthStatus,
      lifecycleStatus: initialLifecycleStatus,
      inoculationCount: initialInoculationCount,
      readyForInoculation,
      readyForHarvest,
      lastUpdatedAt: new Date(),
      lastUpdatedBy: req.body.lastUpdatedBy || 'system',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const tree = new Tree(payload);
    await tree.save();

    // Adding to tree history
    const history = new TreeHistory({
      treeId,
      actionType: 'ManualEdit',
      newValue: payload,
      changedBy: req.body.lastUpdatedBy || 'system',
      notes: 'Tree created',
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
      calculatedAge: ageData
    };
    
    return res.json(treeWithAge);
  } catch (err) {
    console.error('getTreeById error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// Generic update (PUT /api/trees/:treeId)
exports.updateTree = async (req, res) => {
  try {
    const tree = await Tree.findOne({ treeId: req.params.treeId }).exec();
    if (!tree) return res.status(404).json({ message: 'Tree not found' });
    
    // Apply auto lifecycle logic
    const lifecycleUpdates = autoUpdateLifecycleStatus(tree.toObject(), req.body);
    
    const updates = { 
      ...req.body,
      ...lifecycleUpdates,
      updatedAt: new Date(), 
      lastUpdatedAt: new Date() 
    };
    
    // Update the tree
    Object.assign(tree, updates);
    await tree.save();

    // Adding to history
    const history = new TreeHistory({
      treeId: req.params.treeId,
      actionType: 'ManualEdit',
      newValue: updates,
      changedBy: req.body.lastUpdatedBy || 'system',
      notes: 'Tree updated',
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

// Update tree profile (for Save button in frontend) - WITH INOCULATION LOGIC
exports.updateTreeProfile = async (req, res) => {
  try {
    const { treeId } = req.params;
    const { 
      healthStatus, 
      lifecycleStatus, 
      inoculationCount, 
      lastUpdatedBy,
      block,
      investorId,
      investorName
    } = req.body;

    const tree = await Tree.findOne({ treeId }).exec();
    if (!tree) return res.status(404).json({ message: 'Tree not found' });

    // Prepare updates
    const updates = {
      lastUpdatedBy,
      lastUpdatedAt: new Date(),
      updatedAt: new Date()
    };

    // Update health status if provided
    if (healthStatus) {
      updates.healthStatus = healthStatus;
      
      // If tree becomes dead, stop lifecycle
      if (healthStatus === 'Dead') {
        updates.lifecycleStatus = 'Dead - Lifecycle Stopped';
        updates.readyForInoculation = false;
        updates.readyForHarvest = false;
      }
    }

    // Update lifecycle status if provided (manual override)
    if (lifecycleStatus) {
      updates.lifecycleStatus = lifecycleStatus;
      
      // If manually set to Harvested, update flags
      if (lifecycleStatus === 'Harvested') {
        updates.readyForInoculation = false;
        updates.readyForHarvest = false;
      }
    }

    // Update inoculation count if provided
    if (inoculationCount !== undefined) {
      updates.inoculationCount = parseInt(inoculationCount) || 0;
    }

    // Update other fields if provided
    if (block !== undefined) updates.block = block;
    if (investorId !== undefined) updates.investorId = investorId;
    if (investorName !== undefined) updates.investorName = investorName;

    // Apply auto lifecycle logic (unless tree is dead or harvested)
    if (updates.healthStatus !== 'Dead' && updates.lifecycleStatus !== 'Harvested') {
      const lifecycleUpdates = autoUpdateLifecycleStatus(tree.toObject(), updates);
      Object.assign(updates, lifecycleUpdates);
    }

    // Update the tree
    Object.assign(tree, updates);
    await tree.save();

    // Add to history
    const history = new TreeHistory({
      treeId,
      actionType: 'ManualEdit',
      newValue: updates,
      changedBy: lastUpdatedBy,
      notes: 'Tree profile updated',
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

// Link / assign NFC tag to tree
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
      notes: 'NFC tag assigned',
      timestamp: new Date(),
      device: 'web'
    });
    await history.save();

    return res.json(tree);
  } catch (err) {
    console.error('updateNFCTag error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// Update GPS coords
exports.updateGPS = async (req, res) => {
  try {
    const { gps, updatedBy } = req.body;
    if (!gps || typeof gps.lat !== 'number' || typeof gps.lng !== 'number') {
      return res.status(400).json({ message: 'gps { lat, lng } required' });
    }

    const tree = await Tree.findOneAndUpdate(
      { treeId: req.params.treeId },
      { gps, lastUpdatedBy: updatedBy || null, updatedAt: new Date(), lastUpdatedAt: new Date() },
      { new: true }
    ).exec();

    if (!tree) return res.status(404).json({ message: 'Tree not found' });

    // Add to history
    const history = new TreeHistory({
      treeId: req.params.treeId,
      actionType: 'ManualEdit',
      newValue: { gps },
      changedBy: updatedBy,
      notes: 'GPS coordinates updated',
      timestamp: new Date(),
      device: 'web'
    });
    await history.save();

    return res.json(tree);
  } catch (err) {
    console.error('updateGPS error:', err);
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

// FIELD NOTES / OBSERVATIONS
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

    if (!notes || !observedBy) {
      return res.status(400).json({ message: 'Notes and observedBy are required' });
    }

    const observation = new Observation({
      observationId: `OBS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      treeId,
      notes,
      images: images || [],
      healthStatus: healthStatus || 'Healthy',
      observedBy,
      type: type || 'Routine',
      timestamp: new Date(),
      canEdit: true
    });

    await observation.save();

    // Add to tree history
    const history = new TreeHistory({
      treeId,
      actionType: 'NoteAdded',
      newValue: { 
        observationId: observation.observationId,
        notes: notes.substring(0, 100) + (notes.length > 100 ? '...' : ''),
        healthStatus: healthStatus || 'Healthy'
      },
      changedBy: observedBy,
      notes: 'Field note added',
      timestamp: new Date(),
      device: 'mobile'
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
    const { notes, images, lastUpdatedBy } = req.body;

    if (!lastUpdatedBy) {
      return res.status(400).json({ message: 'lastUpdatedBy is required' });
    }

    const observation = await Observation.findOne({ observationId });
    if (!observation) {
      return res.status(404).json({ message: 'Observation not found' });
    }

    // Check if user can edit (only original author)
    if (observation.observedBy !== lastUpdatedBy) {
      return res.status(403).json({ message: 'Cannot edit other users notes' });
    }

    const oldNotes = observation.notes;
    
    observation.notes = notes;
    if (images) observation.images = images;
    observation.lastUpdatedBy = lastUpdatedBy;
    observation.lastUpdatedAt = new Date();

    await observation.save();

    // Add to history if notes changed significantly
    if (oldNotes !== notes) {
      const history = new TreeHistory({
        treeId: observation.treeId,
        actionType: 'NoteAdded',
        oldValue: { notes: oldNotes.substring(0, 100) + (oldNotes.length > 100 ? '...' : '') },
        newValue: { notes: notes.substring(0, 100) + (notes.length > 100 ? '...' : '') },
        changedBy: lastUpdatedBy,
        notes: 'Field note updated',
        timestamp: new Date(),
        device: 'mobile'
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

    if (!deletedBy) {
      return res.status(400).json({ message: 'deletedBy is required' });
    }

    const observation = await Observation.findOne({ observationId });
    if (!observation) {
      return res.status(404).json({ message: 'Observation not found' });
    }

    // Check if user can delete (only original author)
    if (observation.observedBy !== deletedBy) {
      return res.status(403).json({ message: 'Cannot delete other users notes' });
    }

    await Observation.deleteOne({ observationId });

    // Add to history
    const history = new TreeHistory({
      treeId: observation.treeId,
      actionType: 'NoteAdded',
      oldValue: { 
        observationId,
        notes: observation.notes.substring(0, 100) + (observation.notes.length > 100 ? '...' : '')
      },
      changedBy: deletedBy,
      notes: 'Field note deleted',
      timestamp: new Date(),
      device: 'mobile'
    });
    await history.save();

    return res.json({ message: 'Observation deleted successfully' });
  } catch (err) {
    console.error('deleteObservation error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// TREE HISTORY
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