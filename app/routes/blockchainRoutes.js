// routes/blockchainRoutes.js - COMPLETE
const express = require('express');
const router = express.Router();
const {
  createInvestorBlock,
  createTreeBlock,
  generateSmartCertificate,
  verifyCertificate,
  getValidatorStats,
  verifyBlockchain,
  getBlockchainInfo,
  getEntityHistory,
  blockchain
} = require('../controllers/blockchainController');

// ========== BLOCKCHAIN INFO & VERIFICATION ==========

// Get entire blockchain
router.get('/chain', async (req, res) => {
  try {
    if (!blockchain || !blockchain.chain) {
      return res.json({
        success: true,
        data: {
          chain: [],
          length: 0
        },
        message: 'Blockchain not initialized'
      });
    }

    res.json({
      success: true,
      data: {
        chain: blockchain.chain.map(block => ({
          index: block.index,
          timestamp: block.timestamp,
          entityType: block.entityType,
          entityId: block.entityId,
          entityData: block.entityData,
          references: block.references,
          hash: block.hash,
          previousHash: block.previousHash,
          merkleRoot: block.merkleRoot,
          nonce: block.nonce
        })),
        length: blockchain.chain.length
      }
    });
  } catch (error) {
    console.error('Get chain error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get blockchain info/stats
router.get('/info', getBlockchainInfo);

// Verify blockchain integrity
router.get('/verify', verifyBlockchain);

// Cross-verify blockchain
router.get('/cross-verify', async (req, res) => {
  try {
    const verification = await blockchain.verifyChainIntegrity();
    
    res.json({
      success: true,
      data: {
        isValid: verification.isValid,
        totalBlocks: verification.totalBlocks,
        issues: verification.issues || [],
        message: verification.isValid 
          ? 'Blockchain integrity verified across all entity types' 
          : 'Blockchain integrity issues detected'
      }
    });
  } catch (error) {
    console.error('Cross-verify error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========== VALIDATOR NETWORK ==========

router.get('/validators', getValidatorStats);

// ========== ENTITY-SPECIFIC ROUTES ==========

// Get audit trail for investor
router.get('/investor/:id/audit', async (req, res) => {
  try {
    const history = await blockchain.getChainHistory('INVESTOR', req.params.id);
    
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    console.error('Get investor audit trail error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get audit trail for tree
router.get('/tree/:id/audit', async (req, res) => {
  try {
    const history = await blockchain.getChainHistory('TREE', req.params.id);
    
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    console.error('Get tree audit trail error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get entity history (generic)
router.get('/audit/:entityType/:entityId', getEntityHistory);

// ========== BLOCK CREATION (INTERNAL USE) ==========

router.post('/investor', createInvestorBlock);
router.post('/tree', createTreeBlock);

// ========== CERTIFICATE ROUTES ==========

router.post('/certificate/generate', generateSmartCertificate);
router.get('/certificate/:id/verify', verifyCertificate);

module.exports = router;