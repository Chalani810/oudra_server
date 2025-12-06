// controllers/blockchainController.js
const Blockchain = require('../blockchain/Blockchain');
const BlockchainRecord = require('../models/BlockchainRecord');
const Investor = require('../models/Investor'); // Add this

const blockchain = new Blockchain();

// Initialize blockchain on startup
(async () => {
  await blockchain.initialize();
})();

const getBlockchain = async (req, res) => {
  try {
    res.json({
      success: true,
      data: { chain: blockchain.getChainData(), length: blockchain.chain.length },
    });
  } catch (error) {
    console.error('Get blockchain error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const verifyBlockchain = async (req, res) => {
  try {
    const isValid = blockchain.isChainValid();
    res.json({
      success: true,
      data: {
        isValid,
        message: isValid ? 'Blockchain integrity verified ✓' : 'Blockchain tampered ✗',
        chainLength: blockchain.chain.length,
      },
    });
  } catch (error) {
    console.error('Verify blockchain error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ⭐ ENHANCED: Detailed Verification with Investor Info
const getDetailedVerification = async (req, res) => {
  try {
    const results = [];
    let isValid = true;
    let tamperingDetails = [];

    // Verify each block
    for (let i = 1; i < blockchain.chain.length; i++) {
      const currentBlock = blockchain.chain[i];
      const previousBlock = blockchain.chain[i - 1];

      // Check 1: Recalculate hash and compare
      const recalculatedHash = currentBlock.calculateHash();
      const hashValid = currentBlock.hash === recalculatedHash;

      // Check 2: Verify chain link
      const linkValid = currentBlock.previousHash === previousBlock.hash;

      // Get investor info for this block
      let investorInfo = null;
      if (currentBlock.data && currentBlock.data.investorId) {
        try {
          const investor = await Investor.findById(currentBlock.data.investorId)
            .select('name email')
            .lean();
          investorInfo = investor;
        } catch (err) {
          console.error(`Could not fetch investor for block ${i}:`, err.message);
        }
      }

      const blockResult = {
        blockIndex: i,
        blockData: currentBlock.data,
        investor: investorInfo,
        timestamp: new Date(currentBlock.timestamp).toLocaleString(),
        checks: {
          hashIntegrity: {
            passed: hashValid,
            storedHash: currentBlock.hash,
            recalculatedHash: recalculatedHash,
            message: hashValid 
              ? '✓ Block data is untampered' 
              : '✗ Block data has been modified!'
          },
          chainLink: {
            passed: linkValid,
            expectedPreviousHash: previousBlock.hash,
            actualPreviousHash: currentBlock.previousHash,
            message: linkValid 
              ? '✓ Chain link is intact' 
              : '✗ Previous block was modified, breaking the chain!'
          }
        },
        isValid: hashValid && linkValid
      };

      results.push(blockResult);

      if (!hashValid || !linkValid) {
        isValid = false;
        tamperingDetails.push({
          blockIndex: i,
          investor: investorInfo,
          issues: [
            !hashValid ? 'Block data was modified' : null,
            !linkValid ? 'Chain link was broken' : null
          ].filter(Boolean),
          timestamp: new Date(currentBlock.timestamp).toISOString()
        });
      }
    }

    res.json({
      success: true,
      data: {
        overallValid: isValid,
        chainLength: blockchain.chain.length,
        totalBlocksChecked: results.length,
        message: isValid 
          ? '✓ All blocks verified successfully - No tampering detected' 
          : '✗ TAMPERING DETECTED - Blockchain integrity compromised',
        results: results,
        tamperingDetails: tamperingDetails.length > 0 ? tamperingDetails : null,
        verificationTimestamp: new Date().toISOString(),
        statistics: {
          totalInvestors: await Investor.countDocuments(),
          investorsWithBlocks: await BlockchainRecord.distinct('data.investorId').count(),
          recentActivity: await BlockchainRecord.countDocuments({
            timestamp: { $gte: Date.now() - 24 * 60 * 60 * 1000 } // Last 24 hours
          })
        }
      }
    });
  } catch (error) {
    console.error('Detailed verification error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ⭐ NEW: Verify specific investor's blockchain
const verifyInvestorBlockchain = async (req, res) => {
  try {
    const investorId = req.params.investorId;
    
    // Get investor
    const investor = await Investor.findById(investorId);
    if (!investor) {
      return res.status(404).json({ success: false, error: 'Investor not found' });
    }
    
    // Get all blocks for this investor
    const investorBlocks = await BlockchainRecord.find({
      'data.investorId': investorId
    }).sort({ index: 1 });
    
    if (investorBlocks.length === 0) {
      return res.json({
        success: true,
        data: {
          investor: {
            id: investor._id,
            name: investor.name,
            email: investor.email
          },
          hasBlockchain: false,
          message: 'No blockchain records found for this investor'
        }
      });
    }
    
    // Verify each block
    let isValid = true;
    const verificationResults = [];
    
    for (let i = 0; i < investorBlocks.length; i++) {
      const block = investorBlocks[i];
      const previousBlock = i > 0 ? investorBlocks[i - 1] : null;
      
      // Check if this block exists in the main chain
      const mainChainBlock = blockchain.chain.find(b => b.hash === block.hash);
      const inMainChain = !!mainChainBlock;
      
      // Check chain linkage
      let linkValid = true;
      if (previousBlock) {
        linkValid = block.previousHash === previousBlock.hash;
      }
      
      const blockValid = inMainChain && linkValid;
      if (!blockValid) isValid = false;
      
      verificationResults.push({
        blockIndex: block.index,
        action: block.data.action,
        timestamp: new Date(block.timestamp).toLocaleString(),
        hash: block.hash,
        previousHash: block.previousHash,
        checks: {
          inMainChain: {
            passed: inMainChain,
            message: inMainChain ? '✓ Block is in main chain' : '✗ Block not found in main chain'
          },
          chainLink: {
            passed: linkValid,
            message: linkValid ? '✓ Linked to previous block' : '✗ Broken link to previous block'
          }
        },
        valid: blockValid
      });
    }
    
    // Update investor's last verification timestamp
    investor.lastBlockchainVerification = new Date();
    await investor.save();
    
    res.json({
      success: true,
      data: {
        investor: {
          id: investor._id,
          name: investor.name,
          email: investor.email,
          blockchainHash: investor.blockchainHash,
          lastVerified: investor.lastBlockchainVerification
        },
        verification: {
          isValid: isValid,
          totalBlocks: investorBlocks.length,
          results: verificationResults,
          message: isValid 
            ? '✓ Investor blockchain integrity verified' 
            : '✗ Investor blockchain tampering detected'
        }
      }
    });
    
  } catch (error) {
    console.error('Verify investor blockchain error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getAuditTrail = async (req, res) => {
  try {
    const auditTrail = await BlockchainRecord.find({
      'data.investorId': req.params.investorId,
    }).sort({ timestamp: -1 });

    // Get investor info
    const investor = await Investor.findById(req.params.investorId)
      .select('name email phone')
      .lean();
    
    // Get notification history
    const NotificationsAlerts = require('../models/NotificationsAlerts');
    const notifications = await NotificationsAlerts.find({ 
      investorId: req.params.investorId 
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();
    
    res.json({ 
      success: true, 
      data: {
        investor: investor,
        blockchain: {
          count: auditTrail.length,
          records: auditTrail
        },
        notifications: {
          count: notifications.length,
          records: notifications
        },
        summary: {
          totalActivities: auditTrail.length + notifications.length,
          lastBlockchainActivity: auditTrail[0]?.timestamp,
          lastNotification: notifications[0]?.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Get audit trail error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getBlockByIndex = async (req, res) => {
  try {
    const block = await BlockchainRecord.findOne({ index: parseInt(req.params.index) });
    if (!block) {
      return res.status(404).json({ success: false, error: 'Block not found' });
    }
    
    // Get investor info if available
    let investorInfo = null;
    if (block.data && block.data.investorId) {
      investorInfo = await Investor.findById(block.data.investorId)
        .select('name email phone')
        .lean();
    }
    
    // Get related notifications
    let notifications = [];
    if (block.data && block.data.investorId) {
      const NotificationsAlerts = require('../models/NotificationsAlerts');
      notifications = await NotificationsAlerts.find({
        investorId: block.data.investorId,
        createdAt: {
          $gte: new Date(block.timestamp - 60000), // ±1 minute
          $lte: new Date(block.timestamp + 60000)
        }
      }).lean();
    }
    
    res.json({ 
      success: true, 
      data: {
        block: block,
        investor: investorInfo,
        relatedNotifications: notifications,
        context: {
          totalBlocks: await BlockchainRecord.countDocuments(),
          blockPosition: `${block.index + 1}/${await BlockchainRecord.countDocuments()}`
        }
      }
    });
  } catch (error) {
    console.error('Get block by index error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ⭐ NEW: Get blockchain statistics
const getBlockchainStats = async (req, res) => {
  try {
    // Blockchain stats
    const totalBlocks = await BlockchainRecord.countDocuments();
    const lastBlock = await BlockchainRecord.findOne().sort({ index: -1 });
    
    // Investor stats
    const totalInvestors = await Investor.countDocuments();
    const investorsWithBlocks = await Investor.countDocuments({ blockchainHash: { $exists: true, $ne: null } });
    
    // Activity stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayBlocks = await BlockchainRecord.countDocuments({
      timestamp: { $gte: today.getTime() }
    });
    
    const todayInvestors = await Investor.countDocuments({
      createdAt: { $gte: today }
    });
    
    // Notification stats
    const NotificationsAlerts = require('../models/NotificationsAlerts');
    const totalNotifications = await NotificationsAlerts.countDocuments();
    const todayNotifications = await NotificationsAlerts.countDocuments({
      createdAt: { $gte: today }
    });
    
    res.json({
      success: true,
      data: {
        blockchain: {
          totalBlocks: totalBlocks,
          chainLength: blockchain.chain.length,
          lastBlockIndex: lastBlock?.index || 0,
          lastBlockHash: lastBlock?.hash,
          isValid: blockchain.isChainValid()
        },
        investors: {
          total: totalInvestors,
          withBlockchain: investorsWithBlocks,
          withoutBlockchain: totalInvestors - investorsWithBlocks,
          percentageWithBlockchain: totalInvestors > 0 ? Math.round((investorsWithBlocks / totalInvestors) * 100) : 0
        },
        activity: {
          today: {
            blocks: todayBlocks,
            investors: todayInvestors,
            notifications: todayNotifications
          },
          verification: {
            lastVerification: new Date().toISOString(),
            chainValid: blockchain.isChainValid()
          }
        },
        notifications: {
          total: totalNotifications,
          today: todayNotifications
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Get blockchain stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getBlockchain,
  verifyBlockchain,
  getDetailedVerification,
  getAuditTrail,
  getBlockByIndex,
  verifyInvestorBlockchain, // Add this
  getBlockchainStats // Add this
};