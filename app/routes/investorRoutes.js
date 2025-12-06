// routes/investorRoutes.js
const express = require('express');
const {
  createInvestor,
  getAllInvestors,
  getInvestorById,
  updateInvestor,
  deleteInvestor,
  getInvestorWithAuditTrail // Add this
} = require('../controllers/investorController');

const router = express.Router();

// CRUD routes
router.post('/', createInvestor);
router.get('/', getAllInvestors);
router.get('/:id', getInvestorById);
router.put('/:id', updateInvestor);
router.delete('/:id', deleteInvestor);

// Enhanced routes
router.get('/:id/audit-trail', getInvestorWithAuditTrail); // Add this

module.exports = router;