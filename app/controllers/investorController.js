// path: app/controllers/investorController.js
const Investor = require('../models/Investor');
const Tree = require('../models/TreeModel');
const mongoose = require('mongoose');

// ========================================
// INVESTOR CRUD OPERATIONS
// ========================================

exports.getAllInvestors = async (req, res) => {
  try {
    console.log('📡 GET /api/investors - Fetching all investors...');
    
    const investors = await Investor.find({ isDeleted: false })
      .populate({
        path: 'investedTrees.tree',
        select: 'treeId nfcTagId block healthStatus lifecycleStatus plantedDate inoculationCount gps'
      })
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${investors.length} investors`);

    // Format response to match frontend expectations
    const formattedInvestors = investors.map(investor => ({
      _id: investor._id,
      investorId: investor.investorId,
      name: investor.name,
      email: investor.email,
      phone: investor.phone,
      investment: investor.investment.totalInvestment,
      status: investor.status,
      investedTrees: investor.investedTrees,
      treeCount: investor.activeTreeCount,
      certificateCount: investor.activeCertificateCount,
      createdAt: investor.createdAt,
      updatedAt: investor.updatedAt
    }));

    res.status(200).json({
      success: true,
      count: formattedInvestors.length,
      data: formattedInvestors,
      investors: formattedInvestors // ALSO INCLUDE AS 'investors' FOR COMPATIBILITY
    });
  } catch (error) {
    console.error('❌ Error fetching investors:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch investors',
      error: error.message
    });
  }
};
/**
 * Get single investor by ID
 */
exports.getInvestorById = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📡 GET /api/investors/${id}`);

    const investor = await Investor.findById(id)
      .populate({
        path: 'investedTrees.tree',
        select: 'treeId nfcTagId block healthStatus lifecycleStatus plantedDate inoculationCount gps harvestData'
      });

    if (!investor || investor.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Investor not found'
      });
    }

    console.log(`✅ Found investor: ${investor.name}`);

    res.status(200).json({
      success: true,
      data: investor
    });
  } catch (error) {
    console.error('❌ Error fetching investor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch investor',
      error: error.message
    });
  }
};

/**
 * Create new investor with optional tree assignment
 */
exports.createInvestor = async (req, res) => {
  try {
    const { 
      name, 
      email, 
      phone, 
      investment, 
      status,
      selectedTreeIds // Array of tree IDs to assign
    } = req.body;

    console.log('📡 POST /api/investors - Creating new investor...');
    console.log('Data:', { name, email, phone, investment, selectedTreeIds });

    // Validation
    if (!name || !email || !phone || !investment) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: name, email, phone, investment'
      });
    }

    // Check if email already exists
    const existingInvestor = await Investor.findOne({ email, isDeleted: false });
    if (existingInvestor) {
      return res.status(400).json({
        success: false,
        message: 'An investor with this email already exists'
      });
    }

    // Create investor object
    const investorData = {
      name,
      email,
      phone,
      status: status || 'active',
      investment: {
        totalInvestment: parseFloat(investment),
        availableBalance: parseFloat(investment),
        investedAmount: 0
      }
    };

    // Create the investor
    const newInvestor = new Investor(investorData);
    await newInvestor.save();

    console.log(`✅ Created investor: ${newInvestor.investorId}`);

    // If trees are selected, assign them
    if (selectedTreeIds && Array.isArray(selectedTreeIds) && selectedTreeIds.length > 0) {
      console.log(`🌳 Assigning ${selectedTreeIds.length} trees...`);
      
      for (const treeId of selectedTreeIds) {
        try {
          const tree = await Tree.findById(treeId);
          
          if (!tree) {
            console.warn(`⚠️ Tree ${treeId} not found`);
            continue;
          }

          if (tree.investor) {
            console.warn(`⚠️ Tree ${tree.treeId} already assigned`);
            continue;
          }

          // Add tree to investor's investedTrees
          newInvestor.investedTrees.push({
            tree: tree._id,
            treeId: tree.treeId,
            investmentDate: new Date(),
            amountAllocated: 0,
            status: 'active'
          });

          // Update tree with investor info
          tree.investor = newInvestor._id;
          tree.investorId = newInvestor.investorId;
          tree.investorName = newInvestor.name;
          await tree.save();

          console.log(`✅ Assigned tree ${tree.treeId} to investor`);
        } catch (treeError) {
          console.error(`❌ Error assigning tree ${treeId}:`, treeError);
        }
      }

      await newInvestor.save();
    }

    // Populate trees before sending response
    await newInvestor.populate({
      path: 'investedTrees.tree',
      select: 'treeId nfcTagId block healthStatus lifecycleStatus plantedDate'
    });

    res.status(201).json({
      success: true,
      message: 'Investor created successfully',
      data: newInvestor
    });
  } catch (error) {
    console.error('❌ Error creating investor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create investor',
      error: error.message
    });
  }
};

/**
 * Update investor
 */
exports.updateInvestor = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      name, 
      email, 
      phone, 
      investment, 
      status,
      selectedTreeIds 
    } = req.body;

    console.log(`📡 PUT /api/investors/${id}`);

    const investor = await Investor.findById(id);
    
    if (!investor || investor.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Investor not found'
      });
    }

    // Update basic fields
    if (name) investor.name = name;
    if (email) investor.email = email;
    if (phone) investor.phone = phone;
    if (status) investor.status = status;
    if (investment) {
      const newInvestment = parseFloat(investment);
      const difference = newInvestment - investor.investment.totalInvestment;
      investor.investment.totalInvestment = newInvestment;
      investor.investment.availableBalance += difference;
    }

    // Handle tree assignments if provided
    if (selectedTreeIds && Array.isArray(selectedTreeIds)) {
      // Get current tree IDs
      const currentTreeIds = investor.investedTrees
        .filter(inv => inv.status === 'active')
        .map(inv => inv.tree.toString());

      // Find trees to add and remove
      const treesToAdd = selectedTreeIds.filter(id => !currentTreeIds.includes(id));
      const treesToRemove = currentTreeIds.filter(id => !selectedTreeIds.includes(id));

      // Remove trees
      for (const treeId of treesToRemove) {
        const tree = await Tree.findById(treeId);
        if (tree) {
          tree.investor = null;
          tree.investorId = null;
          tree.investorName = null;
          await tree.save();
          
          // Mark investment as inactive
          const investment = investor.investedTrees.find(
            inv => inv.tree.toString() === treeId
          );
          if (investment) {
            investment.status = 'inactive';
          }
        }
      }

      // Add new trees
      for (const treeId of treesToAdd) {
        const tree = await Tree.findById(treeId);
        if (tree && !tree.investor) {
          investor.investedTrees.push({
            tree: tree._id,
            treeId: tree.treeId,
            investmentDate: new Date(),
            amountAllocated: 0,
            status: 'active'
          });

          tree.investor = investor._id;
          tree.investorId = investor.investorId;
          tree.investorName = investor.name;
          await tree.save();
        }
      }
    }

    await investor.save();

    // Populate trees
    await investor.populate({
      path: 'investedTrees.tree',
      select: 'treeId nfcTagId block healthStatus lifecycleStatus plantedDate'
    });

    console.log(`✅ Updated investor: ${investor.investorId}`);

    res.status(200).json({
      success: true,
      message: 'Investor updated successfully',
      data: investor
    });
  } catch (error) {
    console.error('❌ Error updating investor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update investor',
      error: error.message
    });
  }
};

/**
 * Delete investor (soft delete) and release all trees
 */
exports.deleteInvestor = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log(`📡 DELETE /api/investors/${id}`);

    const investor = await Investor.findById(id);
    
    if (!investor || investor.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Investor not found'
      });
    }

    // Release all trees
    const activeTrees = investor.investedTrees.filter(inv => inv.status === 'active');
    
    for (const investment of activeTrees) {
      const tree = await Tree.findById(investment.tree);
      if (tree) {
        tree.investor = null;
        tree.investorId = null;
        tree.investorName = null;
        await tree.save();
        console.log(`🌳 Released tree ${tree.treeId}`);
      }
    }

    // Soft delete
    investor.isDeleted = true;
    investor.deletedAt = new Date();
    await investor.save();

    console.log(`✅ Deleted investor: ${investor.investorId}`);

    res.status(200).json({
      success: true,
      message: 'Investor deleted successfully and all trees released'
    });
  } catch (error) {
    console.error('❌ Error deleting investor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete investor',
      error: error.message
    });
  }
};

// ========================================
// TREE ASSIGNMENT OPERATIONS
// ========================================

/**
 * Get available trees (not assigned to any investor)
 */
exports.getAvailableTrees = async (req, res) => {
  try {
    console.log('📡 GET /api/investors/trees/available');

    const availableTrees = await Tree.find({
      $or: [
        { investor: { $exists: false } },
        { investor: null }
      ],
      healthStatus: { $nin: ['Dead', 'Harvested'] },
      isDeleted: { $ne: true }
    }).sort({ treeId: 1 });

    console.log(`✅ Found ${availableTrees.length} available trees`);

    res.status(200).json({
      success: true,
      count: availableTrees.length,
      data: availableTrees,
      trees: availableTrees // Also include as 'trees' for compatibility
    });
  } catch (error) {
    console.error('❌ Error fetching available trees:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available trees',
      error: error.message
    });
  }
};

/**
 * Get investor for a specific tree
 */
exports.getInvestorByTree = async (req, res) => {
  try {
    const { treeId } = req.params;
    
    console.log(`📡 GET /api/investors/tree/${treeId}`);

    const tree = await Tree.findOne({ treeId }).populate('investor');

    if (!tree) {
      return res.status(404).json({
        success: false,
        message: 'Tree not found'
      });
    }

    if (!tree.investor) {
      return res.status(200).json({
        success: true,
        message: 'This tree is not assigned to any investor',
        data: null
      });
    }

    res.status(200).json({
      success: true,
      data: tree.investor
    });
  } catch (error) {
    console.error('❌ Error fetching investor by tree:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch investor',
      error: error.message
    });
  }
};

/**
 * Assign tree to investor
 */
exports.assignTreeToInvestor = async (req, res) => {
  try {
    const { id } = req.params;
    const { treeId, amountAllocated } = req.body;

    console.log(`📡 POST /api/investors/${id}/assign-tree`);

    const investor = await Investor.findById(id);
    if (!investor || investor.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Investor not found'
      });
    }

    const tree = await Tree.findById(treeId);
    if (!tree) {
      return res.status(404).json({
        success: false,
        message: 'Tree not found'
      });
    }

    if (tree.investor) {
      return res.status(400).json({
        success: false,
        message: 'Tree is already assigned to another investor'
      });
    }

    // Add to investor's investedTrees
    investor.investedTrees.push({
      tree: tree._id,
      treeId: tree.treeId,
      investmentDate: new Date(),
      amountAllocated: amountAllocated || 0,
      status: 'active'
    });

    // Update tree
    tree.investor = investor._id;
    tree.investorId = investor.investorId;
    tree.investorName = investor.name;

    await investor.save();
    await tree.save();

    console.log(`✅ Assigned tree ${tree.treeId} to investor ${investor.investorId}`);

    res.status(200).json({
      success: true,
      message: 'Tree assigned successfully',
      data: { investor, tree }
    });
  } catch (error) {
    console.error('❌ Error assigning tree:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign tree',
      error: error.message
    });
  }
};

/**
 * Unassign tree from investor
 */
exports.unassignTreeFromInvestor = async (req, res) => {
  try {
    const { id, treeId } = req.params;

    console.log(`📡 POST /api/investors/${id}/unassign-tree/${treeId}`);

    const investor = await Investor.findById(id);
    if (!investor || investor.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Investor not found'
      });
    }

    const tree = await Tree.findById(treeId);
    if (!tree) {
      return res.status(404).json({
        success: false,
        message: 'Tree not found'
      });
    }

    // Mark investment as inactive
    const investment = investor.investedTrees.find(
      inv => inv.tree.toString() === treeId && inv.status === 'active'
    );

    if (investment) {
      investment.status = 'inactive';
    }

    // Clear tree's investor info
    tree.investor = null;
    tree.investorId = null;
    tree.investorName = null;

    await investor.save();
    await tree.save();

    console.log(`✅ Unassigned tree ${tree.treeId} from investor ${investor.investorId}`);

    res.status(200).json({
      success: true,
      message: 'Tree unassigned successfully',
      data: { investor, tree }
    });
  } catch (error) {
    console.error('❌ Error unassigning tree:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unassign tree',
      error: error.message
    });
  }
};

// ========================================
// STATISTICS & ANALYTICS
// ========================================

/**
 * Get investor statistics
 */
exports.getInvestorStats = async (req, res) => {
  try {
    console.log('📡 GET /api/investors/stats/overview');

    const totalInvestors = await Investor.countDocuments({ isDeleted: false });
    const activeInvestors = await Investor.countDocuments({ status: 'active', isDeleted: false });
    
    const investorData = await Investor.aggregate([
      { $match: { isDeleted: false } },
      {
        $group: {
          _id: null,
          totalInvestment: { $sum: '$investment.totalInvestment' },
          totalInvested: { $sum: '$investment.investedAmount' },
          totalAvailable: { $sum: '$investment.availableBalance' }
        }
      }
    ]);

    const assignedTrees = await Tree.countDocuments({ investor: { $ne: null } });
    const availableTrees = await Tree.countDocuments({ investor: null });

    res.status(200).json({
      success: true,
      data: {
        totalInvestors,
        activeInvestors,
        inactiveInvestors: totalInvestors - activeInvestors,
        totalInvestment: investorData[0]?.totalInvestment || 0,
        totalInvested: investorData[0]?.totalInvested || 0,
        totalAvailable: investorData[0]?.totalAvailable || 0,
        assignedTrees,
        availableTrees
      }
    });
  } catch (error) {
    console.error('❌ Error fetching investor stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch investor statistics',
      error: error.message
    });
  }
};

/**
 * Get investor performance metrics
 */
exports.getInvestorPerformance = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`📡 GET /api/investors/${id}/performance`);

    const investor = await Investor.findById(id)
      .populate({
        path: 'investedTrees.tree',
        select: 'treeId healthStatus lifecycleStatus inoculationCount harvestData'
      });

    if (!investor || investor.isDeleted) {
      return res.status(404).json({
        success: false,
        message: 'Investor not found'
      });
    }

    const activeTrees = investor.investedTrees.filter(inv => inv.status === 'active');
    
    const performance = {
      totalTrees: activeTrees.length,
      healthyTrees: activeTrees.filter(inv => inv.tree?.healthStatus === 'Healthy').length,
      harvestedTrees: activeTrees.filter(inv => inv.tree?.lifecycleStatus === 'Harvested').length,
      readyForHarvest: activeTrees.filter(inv => inv.tree?.lifecycleStatus === 'Ready for Harvest').length,
      totalResinYield: activeTrees.reduce((sum, inv) => {
        return sum + (inv.tree?.harvestData?.resinYield || 0);
      }, 0),
      averageTreeAge: calculateAverageAge(activeTrees),
      investmentUtilization: (investor.investment.investedAmount / investor.investment.totalInvestment * 100).toFixed(2)
    };

    res.status(200).json({
      success: true,
      data: performance
    });
  } catch (error) {
    console.error('❌ Error fetching investor performance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch investor performance',
      error: error.message
    });
  }
};

// Helper function to calculate average tree age
function calculateAverageAge(investments) {
  if (investments.length === 0) return 0;
  
  const totalMonths = investments.reduce((sum, inv) => {
    if (!inv.tree?.plantedDate) return sum;
    const planted = new Date(inv.tree.plantedDate);
    const now = new Date();
    const months = (now.getFullYear() - planted.getFullYear()) * 12 + 
                   (now.getMonth() - planted.getMonth());
    return sum + months;
  }, 0);
  
  return Math.round(totalMonths / investments.length);
}