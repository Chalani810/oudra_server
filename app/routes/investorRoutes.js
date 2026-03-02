const express = require('express');
const router = express.Router();
const investorController = require('../controllers/investorController');

// ===============================
// INVESTOR STATISTICS
// ===============================
router.get('/stats/overview', investorController.getInvestorStats);
router.get('/', investorController.getAllInvestors);
router.get('/trees/available', investorController.getAvailableTrees);
router.post('/', investorController.createInvestor);
router.get('/:id', investorController.getInvestorById);
router.get('/trees/all-for-assignment', investorController.getTreesForBulkAssignment);
router.get('/:id/trees', investorController.getInvestorTrees);
router.delete('/:id', investorController.deleteInvestor);


module.exports = router;