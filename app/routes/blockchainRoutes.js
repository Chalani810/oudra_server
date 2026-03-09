// path: oudra-server/app/routes/blockchainRoutes.js
const express = require('express');
const {
    syncTreesToPolygon,      // The NEW Polygon Sync function
    getBlockchain,
    verifyBlockchain,
    getDetailedVerification,
    getAuditTrail,
    getBlockByIndex,
    verifyInvestorBlockchain, 
    getBlockchainStats 
} = require('../controllers/blockchainController');

const router = express.Router();

// ==========================================
// 1. POLYGON PUBLIC BLOCKCHAIN ROUTES
// ==========================================

/**
 * @route   POST /api/blockchain/sync-polygon
 * @desc    Triggers the synchronization of MongoDB trees to the Polygon Network
 * @access  Admin Only (Recommended to add auth middleware here)
 */
router.post('/sync-polygon', syncTreesToPolygon);


// ==========================================
// 2. LOCAL SIMULATION & AUDIT ROUTES
// ==========================================

// Public & General Stats
router.get('/chain', getBlockchain);
router.get('/verify', verifyBlockchain);
router.get('/detailed-verification', getDetailedVerification);
router.get('/stats', getBlockchainStats);

// Investor-specific routes
router.get('/investor/:investorId/verify', verifyInvestorBlockchain);
router.get('/investor/:investorId/audit', getAuditTrail);
router.get('/block/:index', getBlockByIndex);

module.exports = router;