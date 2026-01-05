const express = require('express');
const router = express.Router();
const investorController = require('../controllers/investorController');

// ===============================
// INVESTOR STATISTICS
// ===============================
router.get('/stats/overview', investorController.getInvestorStats);

// ===============================
// TREE MANAGEMENT ROUTES
// ===============================

// Get available trees for assignment
router.get('/trees/available', investorController.getAvailableTrees);

// ✅ NEW: Get all trees for bulk assignment view
router.get('/trees/all-for-assignment', investorController.getTreesForBulkAssignment);

// Get specific investor's trees
router.get('/:id/trees', investorController.getInvestorTrees);

// Assign single tree to investor
router.post('/:id/assign-tree', investorController.assignTreeToInvestor);

// ✅ NEW: Bulk assign trees to investor
router.post('/:id/bulk-assign-trees', investorController.bulkAssignTrees);

// Unassign tree from investor
router.post('/:id/unassign-tree/:treeId', investorController.unassignTreeFromInvestor);

// ===============================
// INVESTOR CRUD ROUTES
// ===============================

// Get all investors with invested trees
router.get('/', investorController.getAllInvestors);

// Get investor by ID with details
router.get('/:id', investorController.getInvestorById);

// Create new investor
router.post('/', investorController.createInvestor);

// ✅ UPDATED: Update investor with tree management capability
router.put('/:id', investorController.updateInvestor);

// Delete investor
router.delete('/:id', investorController.deleteInvestor);

module.exports = router;