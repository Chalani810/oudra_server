// path: app/routes/investorRoutes.js
const express = require('express');
const router = express.Router();
const investorController = require('../controllers/investorController');

// ========================================
// INVESTOR CRUD OPERATIONS
// ========================================

// Get all investors with their trees
router.get('/', investorController.getAllInvestors);

// Get single investor by ID
router.get('/:id', investorController.getInvestorById);

// Create new investor with tree assignment
router.post('/', investorController.createInvestor);

// Update investor
router.put('/:id', investorController.updateInvestor);

// Delete investor (soft delete)
router.delete('/:id', investorController.deleteInvestor);

// ========================================
// TREE ASSIGNMENT OPERATIONS
// ========================================

// Get available trees for assignment
router.get('/trees/available', investorController.getAvailableTrees);

// Get investor for a specific tree
router.get('/tree/:treeId', investorController.getInvestorByTree);

// Assign tree to investor
router.post('/:id/assign-tree', investorController.assignTreeToInvestor);

// Unassign tree from investor
router.post('/:id/unassign-tree/:treeId', investorController.unassignTreeFromInvestor);

// ========================================
// STATISTICS & ANALYTICS
// ========================================

// Get investor statistics
router.get('/stats/overview', investorController.getInvestorStats);

// Get investor performance
router.get('/:id/performance', investorController.getInvestorPerformance);

module.exports = router;