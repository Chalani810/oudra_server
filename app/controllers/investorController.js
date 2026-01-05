// path: app/controllers/investorController.js
const Investor = require('../models/Investor');
const Tree = require('../models/TreeModel');

// ========================================
// GET ALL INVESTORS WITH INVESTED TREES
// ========================================
exports.getAllInvestors = async (req, res) => {
  try {
    const investors = await Investor.find()
      .populate({
        path: 'investedTrees.tree',
        select: 'treeId block healthStatus lifecycleStatus plantedDate investorId investorName'
      })
      .sort({ createdAt: -1 });

    // ✅ FIX #1: Format with tree details
    const formatted = investors.map(inv => ({
      _id: inv._id,
      investorId: inv.investorId,
      name: inv.name,
      email: inv.email,
      phone: inv.phone,
      investment: inv.investment ?? 0,
      status: inv.status,
      treeCount: inv.investedTrees.length,
      investedTrees: inv.investedTrees.map(treeItem => ({
        _id: treeItem.tree?._id,
        treeId: treeItem.treeId,
        treeDetails: treeItem.tree ? {
          treeId: treeItem.tree.treeId,
          block: treeItem.tree.block,
          healthStatus: treeItem.tree.healthStatus,
          lifecycleStatus: treeItem.tree.lifecycleStatus,
          plantedDate: treeItem.tree.plantedDate,
          investorId: treeItem.tree.investorId,
          investorName: treeItem.tree.investorName
        } : null
      })),
      createdAt: inv.createdAt
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ========================================
// GET INVESTOR BY ID WITH DETAILS
// ========================================
exports.getInvestorById = async (req, res) => {
  try {
    const investor = await Investor.findById(req.params.id)
      .populate({
        path: 'investedTrees.tree',
        select: 'treeId block healthStatus lifecycleStatus plantedDate investorId investorName gps harvestData'
      });

    if (!investor) {
      return res.status(404).json({ success: false, message: 'Investor not found' });
    }

    // ✅ FIX #1: Format tree details
    const formattedInvestor = {
      ...investor.toObject(),
      investedTrees: investor.investedTrees.map(treeItem => ({
        ...treeItem.toObject(),
        treeDetails: treeItem.tree ? {
          treeId: treeItem.tree.treeId,
          block: treeItem.tree.block,
          healthStatus: treeItem.tree.healthStatus,
          lifecycleStatus: treeItem.tree.lifecycleStatus,
          plantedDate: treeItem.tree.plantedDate,
          investorId: treeItem.tree.investorId,
          investorName: treeItem.tree.investorName,
          gps: treeItem.tree.gps,
          harvestData: treeItem.tree.harvestData
        } : null
      }))
    };

    res.json({ success: true, data: formattedInvestor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ========================================
// CREATE INVESTOR (FIXED INVESTMENT)
// ========================================
exports.createInvestor = async (req, res) => {
  try {
    const { name, email, phone, investment, status } = req.body;

    if (!name || !email || !phone || investment === '' || investment === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All fields including investment are required'
      });
    }

    const parsedInvestment = Number(investment);
    if (isNaN(parsedInvestment) || parsedInvestment < 0) {
      return res.status(400).json({
        success: false,
        message: 'Investment must be a valid positive number'
      });
    }

    const investor = await Investor.create({
      name,
      email,
      phone,
      investment: parsedInvestment,
      status: status || 'active'
    });

    res.status(201).json({ success: true, data: investor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ========================================
// ✅ FIX #2: UPDATE INVESTOR WITH TREE MANAGEMENT
// ========================================
exports.updateInvestor = async (req, res) => {
  try {
    const investor = await Investor.findById(req.params.id);
    if (!investor) {
      return res.status(404).json({ success: false, message: 'Investor not found' });
    }

    const { name, email, phone, investment, status, treesToAdd, treesToRemove } = req.body;

    // Update basic info
    if (name) investor.name = name;
    if (email) investor.email = email;
    if (phone) investor.phone = phone;
    if (status) investor.status = status;

    if (investment !== undefined) {
      const parsedInvestment = Number(investment);
      if (isNaN(parsedInvestment) || parsedInvestment < 0) {
        return res.status(400).json({
          success: false,
          message: 'Investment must be a valid positive number'
        });
      }
      investor.investment = parsedInvestment;
    }

    // ✅ FIX #2: Add trees to investor
    if (treesToAdd && Array.isArray(treesToAdd) && treesToAdd.length > 0) {
      for (const treeId of treesToAdd) {
        const tree = await Tree.findById(treeId);
        if (tree && !tree.investor) {
          // Update tree
          tree.investor = investor._id;
          tree.investorName = investor.name;
          tree.investorId = investor.investorId;
          await tree.save();

          // Add to investor's invested trees
          if (!investor.investedTrees.some(t => t.tree.toString() === treeId)) {
            investor.investedTrees.push({
              tree: tree._id,
              treeId: tree.treeId
            });
          }
        }
      }
    }

    // ✅ FIX #2: Remove trees from investor
    if (treesToRemove && Array.isArray(treesToRemove) && treesToRemove.length > 0) {
      for (const treeId of treesToRemove) {
        const tree = await Tree.findById(treeId);
        if (tree && tree.investor && tree.investor.toString() === investor._id.toString()) {
          // Update tree
          tree.investor = null;
          tree.investorName = null;
          tree.investorId = null;
          await tree.save();

          // Remove from investor's invested trees
          investor.investedTrees = investor.investedTrees.filter(
            t => t.tree.toString() !== treeId
          );
        }
      }
    }

    await investor.save();
    
    // Get updated investor with populated trees
    const updatedInvestor = await Investor.findById(investor._id)
      .populate({
        path: 'investedTrees.tree',
        select: 'treeId block healthStatus lifecycleStatus plantedDate investorId investorName'
      });

    res.json({ 
      success: true, 
      data: updatedInvestor,
      message: 'Investor updated successfully' 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ========================================
// DELETE INVESTOR
// ========================================
exports.deleteInvestor = async (req, res) => {
  try {
    const investor = await Investor.findById(req.params.id);
    if (!investor) {
      return res.status(404).json({ success: false, message: 'Investor not found' });
    }

    // Unassign all trees
    for (const inv of investor.investedTrees) {
      const tree = await Tree.findById(inv.tree);
      if (tree) {
        tree.investor = null;
        tree.investorName = null;
        tree.investorId = null;
        await tree.save();
      }
    }

    await investor.deleteOne();
    res.json({ success: true, message: 'Investor deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ========================================
// GET AVAILABLE TREES
// ========================================
exports.getAvailableTrees = async (req, res) => {
  try {
    const trees = await Tree.find({
      $or: [{ investor: null }, { investor: { $exists: false } }],
      healthStatus: { $nin: ['Dead', 'Harvested'] }
    })
    .select('treeId block healthStatus lifecycleStatus plantedDate')
    .sort({ treeId: 1 });

    res.json({ success: true, data: trees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ========================================
// GET INVESTOR'S TREES
// ========================================
exports.getInvestorTrees = async (req, res) => {
  try {
    const investor = await Investor.findById(req.params.id);
    if (!investor) {
      return res.status(404).json({ success: false, message: 'Investor not found' });
    }

    const trees = await Tree.find({ investor: investor._id })
      .select('treeId block healthStatus lifecycleStatus plantedDate investorId investorName gps')
      .sort({ treeId: 1 });

    res.json({ success: true, data: trees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ========================================
// ASSIGN TREE TO INVESTOR
// ========================================
exports.assignTreeToInvestor = async (req, res) => {
  try {
    const { treeId } = req.body;
    const investor = await Investor.findById(req.params.id);
    const tree = await Tree.findById(treeId);

    if (!investor || !tree) {
      return res.status(404).json({ success: false, message: 'Investor or Tree not found' });
    }

    if (tree.investor) {
      return res.status(400).json({ success: false, message: 'Tree already assigned' });
    }

    // Update tree
    tree.investor = investor._id;
    tree.investorName = investor.name;
    tree.investorId = investor.investorId;
    await tree.save();

    // Update investor
    if (!investor.investedTrees.some(t => t.tree.toString() === treeId)) {
      investor.investedTrees.push({
        tree: tree._id,
        treeId: tree.treeId
      });
      await investor.save();
    }

    res.json({ 
      success: true, 
      message: 'Tree assigned successfully',
      data: { treeId: tree.treeId, investorId: investor.investorId }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ========================================
// UNASSIGN TREE
// ========================================
exports.unassignTreeFromInvestor = async (req, res) => {
  try {
    const { treeId } = req.params;
    const investor = await Investor.findById(req.params.id);
    const tree = await Tree.findById(treeId);

    if (!investor || !tree) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    // Remove from investor
    investor.investedTrees = investor.investedTrees.filter(
      t => t.tree.toString() !== treeId
    );
    await investor.save();

    // Update tree
    tree.investor = null;
    tree.investorName = null;
    tree.investorId = null;
    await tree.save();

    res.json({ 
      success: true, 
      message: 'Tree unassigned successfully' 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ========================================
// ✅ NEW: GET TREES FOR BULK ASSIGNMENT
// ========================================
exports.getTreesForBulkAssignment = async (req, res) => {
  try {
    const trees = await Tree.find()
      .select('treeId block healthStatus lifecycleStatus investor investorId investorName')
      .sort({ treeId: 1 });

    const formatted = trees.map(tree => ({
      _id: tree._id,
      treeId: tree.treeId,
      block: tree.block,
      healthStatus: tree.healthStatus,
      lifecycleStatus: tree.lifecycleStatus,
      currentInvestor: tree.investorId ? {
        investorId: tree.investorId,
        investorName: tree.investorName
      } : null,
      isAvailable: !tree.investorId
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ========================================
// ✅ NEW: BULK ASSIGN TREES
// ========================================
exports.bulkAssignTrees = async (req, res) => {
  try {
    const { treeIds } = req.body;
    const investor = await Investor.findById(req.params.id);

    if (!investor) {
      return res.status(404).json({ success: false, message: 'Investor not found' });
    }

    if (!Array.isArray(treeIds) || treeIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No trees selected' });
    }

    const results = {
      assigned: [],
      alreadyAssigned: [],
      notFound: []
    };

    for (const treeId of treeIds) {
      const tree = await Tree.findById(treeId);
      
      if (!tree) {
        results.notFound.push(treeId);
        continue;
      }

      if (tree.investor) {
        results.alreadyAssigned.push(tree.treeId);
        continue;
      }

      // Assign tree
      tree.investor = investor._id;
      tree.investorName = investor.name;
      tree.investorId = investor.investorId;
      await tree.save();

      // Add to investor
      if (!investor.investedTrees.some(t => t.tree.toString() === treeId)) {
        investor.investedTrees.push({
          tree: tree._id,
          treeId: tree.treeId
        });
      }

      results.assigned.push(tree.treeId);
    }

    await investor.save();

    res.json({
      success: true,
      message: `Assigned ${results.assigned.length} trees successfully`,
      data: results
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ========================================
// INVESTOR STATISTICS
// ========================================
exports.getInvestorStats = async (req, res) => {
  try {
    const totalInvestors = await Investor.countDocuments();
    const activeInvestors = await Investor.countDocuments({ status: 'active' });

    const investmentAgg = await Investor.aggregate([
      {
        $group: {
          _id: null,
          totalInvestment: { $sum: '$investment' }
        }
      }
    ]);

    const assignedTrees = await Tree.countDocuments({ investor: { $ne: null } });
    const availableTrees = await Tree.countDocuments({
      $or: [{ investor: null }, { investor: { $exists: false } }]
    });

    res.status(200).json({
      success: true,
      data: {
        totalInvestors,
        activeInvestors,
        inactiveInvestors: totalInvestors - activeInvestors,
        totalInvestment: investmentAgg[0]?.totalInvestment || 0,
        assignedTrees,
        availableTrees
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};