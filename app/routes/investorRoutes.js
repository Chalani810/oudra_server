// app/routes/investorRoutes.js
const express  = require('express');
const router   = express.Router();
const investorController = require('../controllers/investorController');

// ── Stats & special routes FIRST (before /:id to avoid conflicts) ─────────────
router.get('/stats/overview',           investorController.getInvestorStats);
router.get('/trees/available',          investorController.getAvailableTrees);
router.get('/trees/all-for-assignment', investorController.getTreesForBulkAssignment);

// ── CRUD ──────────────────────────────────────────────────────────────────────
router.get('/',    investorController.getAllInvestors);
router.post('/',   investorController.createInvestor);
router.get('/:id', investorController.getInvestorById);
router.put('/:id', investorController.updateInvestor);        // ✅ Added
router.delete('/:id', investorController.deleteInvestor);

// ── Tree assignment ───────────────────────────────────────────────────────────
router.get('/:id/trees',                      investorController.getInvestorTrees);
router.post('/:id/assign-tree',               investorController.assignTree);         // ✅ Added
router.post('/:id/unassign-tree/:treeId',     investorController.unassignTree);       // ✅ Added
router.post('/:id/bulk-assign-trees',         investorController.bulkAssignTrees);    // ✅ Added

module.exports = router;