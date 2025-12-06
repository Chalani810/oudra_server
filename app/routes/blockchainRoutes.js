// routes/blockchainRoutes.js
const express = require('express');
const {
  getBlockchain,
  verifyBlockchain,
  getDetailedVerification,
  getAuditTrail,
  getBlockByIndex,
  verifyInvestorBlockchain, // Add this
  getBlockchainStats // Add this
} = require('../controllers/blockchainController');

const router = express.Router();

// Public routes
router.get('/chain', getBlockchain);
router.get('/verify', verifyBlockchain);
router.get('/detailed-verification', getDetailedVerification);
router.get('/stats', getBlockchainStats); // Add this

// Investor-specific routes
router.get('/investor/:investorId/verify', verifyInvestorBlockchain); // Add this
router.get('/investor/:investorId/audit', getAuditTrail);
router.get('/block/:index', getBlockByIndex);

module.exports = router;