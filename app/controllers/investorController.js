// controllers/investorController.js
const Investor = require('../models/Investor');
const Blockchain = require('../blockchain/Blockchain');
const NotificationService = require('../services/notificationService'); // Add this

const blockchain = new Blockchain();

// Initialize blockchain on startup
(async () => {
  await blockchain.initialize();
})();

const createInvestor = async (req, res) => {
  try {
    const { name, email, investment, phone } = req.body;
    
    // Get user info (from auth middleware if you have it)
    const modifiedBy = {
      id: req.user?._id || null,
      name: req.user?.name || 'System Admin',
      role: req.user?.role || 'ADMIN',
      email: req.user?.email || 'admin@system.com'
    };
    
    const investor = await Investor.create({
      name,
      email,
      investment: parseFloat(investment),
      phone,
      createdBy: modifiedBy.id
    });

    console.log(`✅ Investor created: ${investor._id}`);

    // Create block data with proper structure
    const blockData = {
      investorId: investor._id.toString(),
      action: 'CREATE',
      data: {
        name: investor.name,
        email: investor.email,
        investment: investor.investment,
        phone: investor.phone
      },
      modifiedBy: modifiedBy.name
    };

    const block = await blockchain.addBlock(blockData);

    // Update investor with blockchain hash
    investor.blockchainHash = block.hash;
    investor.blockchainBlockIndex = block.index;
    investor.lastBlockchainVerification = new Date();
    await investor.save();

    console.log(`⛓ Block created: ${block.hash}`);

    // 🔔 SEND NOTIFICATIONS
    const notificationResult = await NotificationService.sendAllNotifications(
      investor,
      'CREATE',
      null, // No changes for creation
      modifiedBy,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        sessionId: req.session?.id,
        requestId: Date.now().toString()
      }
    ).catch(err => {
      console.error('⚠️ Notification error (non-critical):', err.message);
    });

    res.status(201).json({
      success: true,
      message: 'Investor created successfully',
      data: { 
        investor, 
        block: { index: block.index, hash: block.hash },
        notification: notificationResult || { sent: true, message: 'Notifications processed' }
      },
    });
  } catch (error) {
    console.error('Create investor error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getAllInvestors = async (req, res) => {
  try {
    const investors = await Investor.find().sort({ createdAt: -1 });
    
    // Add blockchain verification status
    const enhancedInvestors = investors.map(investor => ({
      ...investor.toObject(),
      blockchainVerified: !!investor.blockchainHash,
      blockchainStatus: investor.blockchainHash ? 'VERIFIED' : 'PENDING'
    }));
    
    res.json({ 
      success: true, 
      count: investors.length, 
      data: enhancedInvestors 
    });
  } catch (error) {
    console.error('Get all investors error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getInvestorById = async (req, res) => {
  try {
    const investor = await Investor.findById(req.params.id);
    if (!investor) {
      return res.status(404).json({ success: false, error: 'Investor not found' });
    }
    
    // Get blockchain verification status
    const blockchainVerified = !!investor.blockchainHash;
    
    res.json({ 
      success: true, 
      data: {
        ...investor.toObject(),
        blockchainVerified,
        verificationStatus: blockchainVerified ? '✅ Verified' : '⚠️ Pending'
      }
    });
  } catch (error) {
    console.error('Get investor by ID error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateInvestor = async (req, res) => {
  try {
    const investorId = req.params.id;
    
    // Get user info
    const modifiedBy = {
      id: req.user?._id || null,
      name: req.user?.name || 'System Admin',
      role: req.user?.role || 'ADMIN',
      email: req.user?.email || 'admin@system.com'
    };
    
    // Get old investor data to track changes
    const oldInvestor = await Investor.findById(investorId);
    if (!oldInvestor) {
      return res.status(404).json({ success: false, error: 'Investor not found' });
    }
    
    // Calculate changes
    const changes = {};
    Object.keys(req.body).forEach(key => {
      const oldValue = oldInvestor[key];
      const newValue = req.body[key];
      
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes[key] = {
          old: oldValue,
          new: newValue
        };
      }
    });
    
    // Update investor
    const investor = await Investor.findByIdAndUpdate(
      investorId,
      { 
        ...req.body,
        updatedBy: modifiedBy.id,
        updatedAt: Date.now()
      },
      { new: true, runValidators: true }
    );

    if (!investor) {
      return res.status(404).json({ success: false, error: 'Investor not found' });
    }

    // Create blockchain block
    const blockData = {
      investorId: investorId,
      action: 'UPDATE',
      data: {
        changes: Object.keys(changes),
        oldData: {
          name: oldInvestor.name,
          email: oldInvestor.email,
          investment: oldInvestor.investment,
          phone: oldInvestor.phone
        },
        newData: {
          name: investor.name,
          email: investor.email,
          investment: investor.investment,
          phone: investor.phone
        }
      },
      modifiedBy: modifiedBy.name
    };

    const block = await blockchain.addBlock(blockData);

    // Update investor with new blockchain hash
    investor.blockchainHash = block.hash;
    investor.blockchainBlockIndex = block.index;
    investor.lastBlockchainVerification = new Date();
    await investor.save();

    console.log(`✅ Investor updated: ${investorId}`);
    console.log(`⛓ Update block created: ${block.hash}`);

    // 🔔 SEND NOTIFICATIONS
    const notificationResult = await NotificationService.sendAllNotifications(
      investor,
      'UPDATE',
      changes,
      modifiedBy,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        sessionId: req.session?.id,
        requestId: Date.now().toString()
      }
    ).catch(err => {
      console.error('⚠️ Notification error (non-critical):', err.message);
    });

    res.json({
      success: true,
      message: 'Investor updated successfully',
      data: { 
        investor, 
        block: { index: block.index, hash: block.hash },
        changes: changes,
        notification: notificationResult || { sent: true, message: 'Notifications processed' }
      },
    });
  } catch (error) {
    console.error('Update investor error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const deleteInvestor = async (req, res) => {
  try {
    const investorId = req.params.id;
    
    // Get user info
    const modifiedBy = {
      id: req.user?._id || null,
      name: req.user?.name || 'System Admin',
      role: req.user?.role || 'ADMIN',
      email: req.user?.email || 'admin@system.com'
    };
    
    // Get investor data before deletion
    const investor = await Investor.findById(investorId);
    if (!investor) {
      return res.status(404).json({ success: false, error: 'Investor not found' });
    }

    // Create blockchain block BEFORE deletion
    const blockData = {
      investorId: investorId,
      action: 'DELETE',
      data: {
        deletedInvestor: {
          name: investor.name,
          email: investor.email,
          investment: investor.investment,
          phone: investor.phone
        }
      },
      modifiedBy: modifiedBy.name
    };

    const block = await blockchain.addBlock(blockData);
    console.log(`⛓ Deletion block created: ${block.hash}`);

    // 🔔 SEND NOTIFICATIONS (BEFORE deletion)
    const notificationResult = await NotificationService.sendAllNotifications(
      investor,
      'DELETE',
      null,
      modifiedBy,
      {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        sessionId: req.session?.id,
        requestId: Date.now().toString()
      }
    ).catch(err => {
      console.error('⚠️ Notification error (non-critical):', err.message);
    });

    // Delete investor
    await Investor.findByIdAndDelete(investorId);
    console.log(`🗑️ Investor deleted: ${investorId}`);

    res.json({
      success: true,
      message: 'Investor deleted successfully',
      data: { 
        deletedInvestor: {
          id: investor._id,
          name: investor.name,
          email: investor.email
        }, 
        block: { index: block.index, hash: block.hash },
        notification: notificationResult || { sent: true, message: 'Deletion notifications sent' }
      },
    });
  } catch (error) {
    console.error('Delete investor error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// 🔍 NEW FUNCTION: Get investor with complete audit trail
const getInvestorWithAuditTrail = async (req, res) => {
  try {
    const investorId = req.params.id;
    
    // Get investor
    const investor = await Investor.findById(investorId);
    if (!investor) {
      return res.status(404).json({ success: false, error: 'Investor not found' });
    }
    
    // Get blockchain audit trail
    const BlockchainRecord = require('../models/BlockchainRecord');
    const auditTrail = await BlockchainRecord.find({
      'data.investorId': investorId,
    }).sort({ timestamp: -1 });
    
    // Get notifications
    const NotificationsAlerts = require('../models/NotificationsAlerts');
    const notifications = await NotificationsAlerts.find({ investorId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    
    // Get blockchain verification status
    const isValid = blockchain.isChainValid();
    
    res.json({ 
      success: true, 
      data: {
        investor: {
          ...investor.toObject(),
          blockchainVerified: !!investor.blockchainHash
        },
        auditTrail: {
          blockchain: auditTrail,
          notifications: notifications
        },
        verification: {
          isValid: isValid,
          message: isValid ? 'Blockchain integrity verified ✓' : 'Blockchain tampered ✗',
          lastVerified: investor.lastBlockchainVerification
        },
        summary: {
          totalBlocks: auditTrail.length,
          totalNotifications: notifications.length,
          lastActivity: auditTrail[0]?.timestamp || notifications[0]?.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Get investor audit trail error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  createInvestor,
  getAllInvestors,
  getInvestorById,
  updateInvestor,
  deleteInvestor,
  getInvestorWithAuditTrail // Add this new function
};