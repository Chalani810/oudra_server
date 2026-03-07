// app/controllers/investorController.js
const Investor = require('../models/Investor');
const Tree     = require('../models/TreeModel');

// ─── STATS ────────────────────────────────────────────────────────────────────
exports.getInvestorStats = async (req, res) => {
  try {
    const totalInvestors  = await Investor.countDocuments();
    const activeInvestors = await Investor.countDocuments({ status: 'active' });
    const investmentAgg   = await Investor.aggregate([
      { $group: { _id: null, totalInvestment: { $sum: '$investment' } } }
    ]);
    const assignedTrees  = await Tree.countDocuments({ investor: { $ne: null } });
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
    res.status(500).json({ success: false, message: error.message });
  }
};

// ─── GET ALL ──────────────────────────────────────────────────────────────────
exports.getAllInvestors = async (req, res) => {
  try {
    const investors = await Investor.find()
      .populate({
        path: 'investedTrees.tree',
        select: 'treeId block healthStatus lifecycleStatus plantedDate nfcTagId investorId investorName'
      })
      .sort({ createdAt: -1 });

    const formatted = investors.map(inv => ({
      _id:          inv._id,
      investorId:   inv.investorId,
      name:         inv.name,
      email:        inv.email,
      phone:        inv.phone,
      investment:   inv.investment ?? 0,
      status:       inv.status,
      treeCount:    inv.investedTrees.length,
      investedTrees: inv.investedTrees.map(t => ({
        _id:        t.tree?._id,
        treeId:     t.treeId,
        investedAt: t.investedAt,
        tree:       t.tree || null,
      })),
      certificates: inv.certificates,
      createdAt:    inv.createdAt
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET BY ID ────────────────────────────────────────────────────────────────
exports.getInvestorById = async (req, res) => {
  try {
    const investor = await Investor.findById(req.params.id)
      .populate({
        path: 'investedTrees.tree',
        select: 'treeId block healthStatus lifecycleStatus plantedDate nfcTagId investorId investorName gps harvestData'
      });

    if (!investor) return res.status(404).json({ success: false, message: 'Investor not found' });

    res.json({ success: true, data: investor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── CREATE ───────────────────────────────────────────────────────────────────
// ✅ Now handles treeIds — assigns trees on creation
exports.createInvestor = async (req, res) => {
  try {
    const { name, email, phone, investment, status, treeIds } = req.body;

    if (!name || !email || !phone || investment === '' || investment === undefined) {
      return res.status(400).json({ success: false, message: 'All fields including investment are required' });
    }

    const parsedInvestment = Number(investment);
    if (isNaN(parsedInvestment) || parsedInvestment < 0) {
      return res.status(400).json({ success: false, message: 'Investment must be a valid positive number' });
    }

    // Check email uniqueness
    const existing = await Investor.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An investor with this email already exists' });
    }

    // Create investor first to get _id and auto-generated investorId
    const investor = await Investor.create({
      name,
      email: email.toLowerCase().trim(),
      phone,
      investment: parsedInvestment,
      status: status || 'active'
    });

    // ✅ Assign trees if provided
    if (treeIds && treeIds.length > 0) {
      const trees = await Tree.find({ _id: { $in: treeIds } });

      for (const tree of trees) {
        if (tree.investor) continue; // Skip already assigned trees

        tree.investor     = investor._id;
        tree.investorId   = investor.investorId;
        tree.investorName = investor.name;
        await tree.save();

        investor.investedTrees.push({ tree: tree._id, treeId: tree.treeId });
      }

      await investor.save();
    }

    // Return populated result
    const populated = await Investor.findById(investor._id).populate({
      path: 'investedTrees.tree',
      select: 'treeId block healthStatus lifecycleStatus plantedDate'
    });

    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── UPDATE ───────────────────────────────────────────────────────────────────
exports.updateInvestor = async (req, res) => {
  try {
    const { name, email, phone, investment, status } = req.body;

    const investor = await Investor.findById(req.params.id);
    if (!investor) return res.status(404).json({ success: false, message: 'Investor not found' });

    // Check email uniqueness (exclude self)
    if (email && email.toLowerCase().trim() !== investor.email) {
      const dup = await Investor.findOne({
        email: email.toLowerCase().trim(),
        _id: { $ne: investor._id }
      });
      if (dup) return res.status(409).json({ success: false, message: 'Email already used by another investor' });
    }

    if (name)                     investor.name       = name;
    if (email)                    investor.email      = email.toLowerCase().trim();
    if (phone)                    investor.phone      = phone;
    if (investment !== undefined) investor.investment = Number(investment);
    if (status)                   investor.status     = status;

    await investor.save();
    res.json({ success: true, data: investor, message: 'Investor updated successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── DELETE ───────────────────────────────────────────────────────────────────
exports.deleteInvestor = async (req, res) => {
  try {
    const investor = await Investor.findById(req.params.id);
    if (!investor) return res.status(404).json({ success: false, message: 'Investor not found' });

    // Unassign all trees first
    for (const inv of investor.investedTrees) {
      const tree = await Tree.findById(inv.tree);
      if (tree) {
        tree.investor     = null;
        tree.investorName = null;
        tree.investorId   = null;
        await tree.save();
      }
    }

    await investor.deleteOne();
    res.json({ success: true, message: 'Investor deleted successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET AVAILABLE TREES (unassigned only) ────────────────────────────────────
exports.getAvailableTrees = async (req, res) => {
  try {
    const trees = await Tree.find({
      $or: [{ investor: null }, { investor: { $exists: false } }],
      healthStatus: { $nin: ['Dead'] }
    })
    .select('treeId block healthStatus lifecycleStatus plantedDate')
    .sort({ treeId: 1 });

    res.json({ success: true, data: trees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET ALL TREES FOR BULK ASSIGNMENT ───────────────────────────────────────
exports.getTreesForBulkAssignment = async (req, res) => {
  try {
    const trees = await Tree.find()
      .select('treeId block healthStatus lifecycleStatus investor investorId investorName plantedDate')
      .sort({ treeId: 1 });

    const formatted = trees.map(tree => ({
      _id:             tree._id,
      treeId:          tree.treeId,
      block:           tree.block,
      healthStatus:    tree.healthStatus,
      lifecycleStatus: tree.lifecycleStatus,
      plantedDate:     tree.plantedDate,
      currentInvestor: tree.investorId
        ? { investorId: tree.investorId, investorName: tree.investorName }
        : null,
      isAvailable: !tree.investorId
    }));

    res.json({ success: true, data: formatted });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET INVESTOR'S TREES ─────────────────────────────────────────────────────
exports.getInvestorTrees = async (req, res) => {
  try {
    const investor = await Investor.findById(req.params.id);
    if (!investor) return res.status(404).json({ success: false, message: 'Investor not found' });

    const trees = await Tree.find({ investor: investor._id })
      .select('treeId block healthStatus lifecycleStatus plantedDate investorId investorName gps blockchainStatus blockchainTxHash')
      .sort({ treeId: 1 });

    res.json({ success: true, data: trees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── ASSIGN SINGLE TREE ───────────────────────────────────────────────────────
exports.assignTree = async (req, res) => {
  try {
    const { treeId } = req.body;

    const investor = await Investor.findById(req.params.id);
    if (!investor) return res.status(404).json({ success: false, message: 'Investor not found' });

    const tree = await Tree.findById(treeId);
    if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

    if (tree.investor && tree.investor.toString() !== investor._id.toString()) {
      return res.status(400).json({ success: false, message: 'Tree is already assigned to another investor' });
    }

    const alreadyAssigned = investor.investedTrees.some(
      t => t.tree.toString() === tree._id.toString()
    );
    if (alreadyAssigned) return res.status(400).json({ success: false, message: 'Tree already assigned to this investor' });

    tree.investor     = investor._id;
    tree.investorId   = investor.investorId;
    tree.investorName = investor.name;
    await tree.save();

    investor.investedTrees.push({ tree: tree._id, treeId: tree.treeId });
    await investor.save();

    res.json({ success: true, message: `Tree ${tree.treeId} assigned successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── UNASSIGN TREE ────────────────────────────────────────────────────────────
exports.unassignTree = async (req, res) => {
  try {
    const { treeId } = req.params;

    const investor = await Investor.findById(req.params.id);
    if (!investor) return res.status(404).json({ success: false, message: 'Investor not found' });

    const tree = await Tree.findById(treeId);
    if (!tree) return res.status(404).json({ success: false, message: 'Tree not found' });

    tree.investor     = null;
    tree.investorId   = null;
    tree.investorName = null;
    await tree.save();

    investor.investedTrees = investor.investedTrees.filter(
      t => t.tree.toString() !== tree._id.toString()
    );
    await investor.save();

    res.json({ success: true, message: `Tree ${tree.treeId} unassigned successfully` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── BULK ASSIGN TREES ────────────────────────────────────────────────────────
exports.bulkAssignTrees = async (req, res) => {
  try {
    const { treeIds } = req.body;

    if (!treeIds || treeIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No tree IDs provided' });
    }

    const investor = await Investor.findById(req.params.id);
    if (!investor) return res.status(404).json({ success: false, message: 'Investor not found' });

    const trees = await Tree.find({ _id: { $in: treeIds } });

    let successCount = 0;
    let skippedCount = 0;

    for (const tree of trees) {
      if (tree.investor && tree.investor.toString() !== investor._id.toString()) {
        skippedCount++; continue;
      }

      const alreadyAssigned = investor.investedTrees.some(
        t => t.tree.toString() === tree._id.toString()
      );
      if (alreadyAssigned) { skippedCount++; continue; }

      tree.investor     = investor._id;
      tree.investorId   = investor.investorId;
      tree.investorName = investor.name;
      await tree.save();

      investor.investedTrees.push({ tree: tree._id, treeId: tree.treeId });
      successCount++;
    }

    await investor.save();

    res.json({
      success: true,
      message: `${successCount} trees assigned. ${skippedCount} skipped.`,
      data: { successCount, skippedCount }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};