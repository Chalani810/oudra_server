const Investor = require('../models/Investor');
const { blockchain } = require('./blockchainController');
const SmartCertificate = require('../models/SmartCertificate');
const NotificationService = require('../services/notificationService');
const UnifiedBlockchainRecord = require('../models/UnifiedBlockchainRecord');

// Helper function to generate smart certificate
const generateSmartCertificateForInvestor = async (investor, certifiedBy) => {
  try {
    const investorBlock = await UnifiedBlockchainRecord.findOne({
      entityType: 'INVESTOR',
      entityId: investor._id.toString()
    }).sort({ index: -1 });

    if (!investorBlock) {
      throw new Error('Investor blockchain block not found');
    }

    const anchors = [{
      blockHash: investorBlock.hash,
      blockNumber: investorBlock.index,
      entityType: 'INVESTOR',
      timestamp: new Date(investorBlock.timestamp)
    }];

    const certificate = new SmartCertificate({
      type: 'INVESTOR_AUTH',
      investorId: investor._id,
      blockchainAnchors: anchors,
      certificationData: {
        investorName: investor.name,
        totalInvestment: investor.investment,
        certificationDate: new Date(),
        certifiedBy: certifiedBy.name || 'SYSTEM',
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      },
      verificationMetadata: {
        totalBlocksVerified: anchors.length,
        chainIntegrityScore: 100,
        lastVerificationDate: new Date(),
        verificationType: 'AUTOMATIC',
        verificationStatus: 'VALID'
      },
      smartFeatures: {
        autoRenewal: true,
        autoUpdate: true,
        notifyOnChanges: true,
        publiclyViewable: false
      }
    });

    await certificate.save();

    const certBlock = await blockchain.addBlockWithConsensus(
      'CERTIFICATE',
      {
        id: certificate.certificateId,
        investorId: investor._id.toString(),
        type: certificate.type,
        blockchainAnchors: anchors.map(a => a.blockHash),
        action: 'ISSUE'
      },
      {
        investorBlockHash: investorBlock.hash,
        investorBlockNumber: investorBlock.index
      }
    );

    console.log(`📜 Smart certificate generated: ${certificate.certificateId}`);
    console.log(`⛓ Certificate block: #${certBlock.block.index}`);

    return certificate;
  } catch (error) {
    console.error('Error generating certificate:', error);
    throw error;
  }
};

const createInvestor = async (req, res) => {
  try {
    const { name, email, investment, phone } = req.body;
    
    // Validation
    if (!name || !email || !investment) {
      return res.status(400).json({ 
        success: false, 
        error: 'Name, email, and investment are required' 
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid email format' 
      });
    }

    // Check for duplicate email
    const existingInvestor = await Investor.findOne({ email });
    if (existingInvestor) {
      return res.status(400).json({ 
        success: false, 
        error: 'An investor with this email already exists' 
      });
    }

    // Investment validation
    const investmentAmount = parseFloat(investment);
    if (isNaN(investmentAmount) || investmentAmount <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Investment must be a positive number' 
      });
    }

    // Get user info (with fallback if no auth middleware)
    const modifiedBy = {
      id: req.user?._id || null,
      name: req.user?.name || 'System Admin',
      role: req.user?.role || 'ADMIN',
      email: req.user?.email || 'admin@system.com'
    };
    
    // 1. Create investor in database
    const investor = await Investor.create({
      name,
      email,
      investment: investmentAmount,
      phone: phone || 'N/A',
      status: 'active',
      createdBy: modifiedBy.id
    });

    console.log(`✅ Investor created: ${investor._id}`);

    // 2. Add investor to blockchain WITH CONSENSUS
    const blockResult = await blockchain.addBlockWithConsensus(
      'INVESTOR',
      {
        id: investor._id.toString(),
        name: investor.name,
        email: investor.email,
        phone: investor.phone,
        investment: investor.investment,
        status: investor.status,
        action: 'CREATE'
      },
      {},
      '0xSYSTEM123'
    );

    // 3. Update investor with blockchain info
    investor.blockchainHash = blockResult.block.hash;
    investor.blockchainBlockIndex = blockResult.block.index;
    investor.lastBlockchainVerification = new Date();
    await investor.save();

    console.log(`⛓ Blockchain block created: #${blockResult.block.index}`);
    console.log(`✅ Consensus: ${blockResult.consensus.approvals}/${blockResult.consensus.total} validators approved`);

    // 4. GENERATE SMART CERTIFICATE FOR INVESTOR
    const certificate = await generateSmartCertificateForInvestor(investor, modifiedBy);

    // 5. Send notifications (optional - don't fail if notification service doesn't exist)
    let notificationResult = null;
    try {
      if (NotificationService && typeof NotificationService.sendAllNotifications === 'function') {
        notificationResult = await NotificationService.sendAllNotifications(
          investor,
          'CREATE',
          null,
          modifiedBy,
          {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            sessionId: req.session?.id,
            requestId: Date.now().toString()
          }
        );
      }
    } catch (notifError) {
      console.warn('⚠️ Notification error (non-critical):', notifError.message);
    }

    res.status(201).json({
      success: true,
      message: 'Investor created and certificate generated successfully',
      data: { 
        investor: {
          id: investor._id,
          name: investor.name,
          email: investor.email,
          investment: investor.investment,
          blockchain: {
            blockHash: blockResult.block.hash,
            blockNumber: blockResult.block.index,
            consensusApprovals: blockResult.consensus.approvals
          }
        },
        certificate: {
          id: certificate.certificateId,
          type: certificate.type,
          verificationScore: certificate.verificationMetadata.chainIntegrityScore,
          qrCodeUrl: certificate.qrCode?.data
        },
        notification: notificationResult || { sent: true, message: 'Notifications processed' }
      },
    });

  } catch (error) {
    console.error('❌ Create investor error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to create investor' 
    });
  }
};

const getAllInvestors = async (req, res) => {
  try {
    const investors = await Investor.find().sort({ createdAt: -1 });
    
    res.json({
      success: true,
      data: investors,
      count: investors.length
    });
  } catch (error) {
    console.error('Get investors error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch investors' 
    });
  }
};

const getInvestorById = async (req, res) => {
  try {
    const investor = await Investor.findById(req.params.id);
    
    if (!investor) {
      return res.status(404).json({ 
        success: false, 
        error: 'Investor not found' 
      });
    }
    
    res.json({
      success: true,
      data: investor
    });
  } catch (error) {
    console.error('Get investor by ID error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to fetch investor' 
    });
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
    
    // Get old investor data
    const oldInvestor = await Investor.findById(investorId);
    if (!oldInvestor) {
      return res.status(404).json({ success: false, error: 'Investor not found' });
    }
    
    // Track changes
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
    
    // Check for email duplicate if email is being changed
    if (req.body.email && req.body.email !== oldInvestor.email) {
      const existingInvestor = await Investor.findOne({ 
        email: req.body.email,
        _id: { $ne: investorId }
      });
      if (existingInvestor) {
        return res.status(400).json({ 
          success: false, 
          error: 'An investor with this email already exists' 
        });
      }
    }
    
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

    // Add UPDATE to blockchain WITH CONSENSUS
    const blockResult = await blockchain.addBlockWithConsensus(
      'INVESTOR',
      {
        id: investorId,
        name: investor.name,
        email: investor.email,
        phone: investor.phone,
        investment: investor.investment,
        status: investor.status,
        action: 'UPDATE',
        changes: Object.keys(changes)
      },
      {
        previousBlockHash: oldInvestor.blockchainHash,
        previousBlockNumber: oldInvestor.blockchainBlockIndex
      }
    );

    // Update investor with new blockchain hash
    investor.blockchainHash = blockResult.block.hash;
    investor.blockchainBlockIndex = blockResult.block.index;
    investor.lastBlockchainVerification = new Date();
    await investor.save();

    // Update all related certificates
    await updateRelatedCertificates(investorId, changes, modifiedBy);

    // Send notifications (optional)
    let notificationResult = null;
    try {
      if (NotificationService && typeof NotificationService.sendAllNotifications === 'function') {
        notificationResult = await NotificationService.sendAllNotifications(
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
        );
      }
    } catch (notifError) {
      console.warn('⚠️ Notification error (non-critical):', notifError.message);
    }

    res.json({
      success: true,
      message: 'Investor updated and blockchain updated',
      data: { 
        investor: {
          id: investor._id,
          name: investor.name,
          blockchain: {
            blockHash: blockResult.block.hash,
            blockNumber: blockResult.block.index,
            consensusApprovals: blockResult.consensus.approvals
          }
        },
        changes: changes,
        notification: notificationResult || { sent: true, message: 'Notifications processed' }
      },
    });
  } catch (error) {
    console.error('❌ Update investor error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const updateRelatedCertificates = async (investorId, changes, modifiedBy) => {
  try {
    const certificates = await SmartCertificate.find({ investorId, status: 'ACTIVE' });
    
    for (const cert of certificates) {
      if (cert.smartFeatures.autoUpdate) {
        cert.addVersion(
          'Investor data updated',
          { investorChanges: changes },
          null
        );
        
        await cert.verify();
        await cert.save();
        
        console.log(`📜 Certificate ${cert.certificateId} auto-updated for investor ${investorId}`);
      }
    }
  } catch (error) {
    console.error('Error updating related certificates:', error);
  }
};

const deleteInvestor = async (req, res) => {
  try {
    const investorId = req.params.id;
    
    const investor = await Investor.findById(investorId);
    if (!investor) {
      return res.status(404).json({ success: false, error: 'Investor not found' });
    }
    
    // Add DELETE to blockchain before deleting
    await blockchain.addBlockWithConsensus(
      'INVESTOR',
      {
        id: investorId,
        name: investor.name,
        email: investor.email,
        action: 'DELETE'
      },
      {
        previousBlockHash: investor.blockchainHash,
        previousBlockNumber: investor.blockchainBlockIndex
      }
    );
    
    // Revoke all certificates
    await SmartCertificate.updateMany(
      { investorId, status: 'ACTIVE' },
      { 
        status: 'REVOKED',
        'verificationMetadata.verificationStatus': 'REVOKED'
      }
    );
    
    // Delete investor
    await Investor.findByIdAndDelete(investorId);
    
    res.json({
      success: true,
      message: 'Investor and related certificates deleted/revoked successfully'
    });
  } catch (error) {
    console.error('❌ Delete investor error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getInvestorWithCertificate = async (req, res) => {
  try {
    const investorId = req.params.id;
    
    const investor = await Investor.findById(investorId);
    if (!investor) {
      return res.status(404).json({ success: false, error: 'Investor not found' });
    }
    
    const certificates = await SmartCertificate.find({ 
      investorId,
      type: 'INVESTOR_AUTH'
    }).sort({ createdAt: -1 });
    
    const blockchainHistory = await UnifiedBlockchainRecord.find({
      entityType: 'INVESTOR',
      entityId: investorId.toString()
    }).sort({ index: 1 });
    
    const chainVerification = await blockchain.verifyChainIntegrity();
    
    res.json({ 
      success: true, 
      data: {
        investor: {
          ...investor.toObject(),
          blockchainVerified: !!investor.blockchainHash,
          verificationStatus: investor.blockchainHash ? '✅ Verified' : '⚠️ Pending'
        },
        certificates: certificates.map(cert => ({
          id: cert.certificateId,
          type: cert.type,
          verificationScore: cert.verificationMetadata.chainIntegrityScore,
          status: cert.status,
          issuedDate: cert.createdAt,
          qrCodeUrl: cert.qrCode?.data
        })),
        blockchain: {
          blocks: blockchainHistory.map(block => ({
            index: block.index,
            action: block.entityData.action,
            hash: block.hash.substring(0, 20) + '...',
            timestamp: block.timestamp,
            verified: block.verified
          })),
          integrity: chainVerification.isValid ? '✅ Valid' : '❌ Tampered',
          totalBlocks: blockchainHistory.length
        },
        latestCertificate: certificates[0] || null
      }
    });
  } catch (error) {
    console.error('❌ Get investor with certificate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const verifyInvestorCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;
    
    const certificate = await SmartCertificate.findOne({ certificateId });
    if (!certificate) {
      return res.status(404).json({ success: false, error: 'Certificate not found' });
    }
    
    const verificationResult = await certificate.verify();
    const investor = await Investor.findById(certificate.investorId);
    
    res.json({
      success: true,
      data: {
        certificate: {
          id: certificate.certificateId,
          type: certificate.type,
          investorName: investor?.name || 'Unknown',
          status: certificate.status,
          verification: verificationResult
        },
        blockchainAnchors: certificate.blockchainAnchors.map(anchor => ({
          blockNumber: anchor.blockNumber,
          entityType: anchor.entityType,
          hash: anchor.blockHash.substring(0, 20) + '...'
        })),
        qrCode: certificate.qrCode?.data
      }
    });
  } catch (error) {
    console.error('❌ Verify certificate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const getInvestorWithAuditTrail = async (req, res) => {
  try {
    const investorId = req.params.id;
    
    const investor = await Investor.findById(investorId);
    if (!investor) {
      return res.status(404).json({ success: false, error: 'Investor not found' });
    }
    
    const blockchainHistory = await UnifiedBlockchainRecord.find({
      entityType: 'INVESTOR',
      entityId: investorId.toString()
    }).sort({ index: 1 });
    
    res.json({
      success: true,
      data: {
        investor,
        auditTrail: blockchainHistory.map(block => ({
          blockNumber: block.index,
          timestamp: block.timestamp,
          action: block.entityData.action,
          hash: block.hash,
          verified: block.verified
        }))
      }
    });
  } catch (error) {
    console.error('❌ Get audit trail error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  createInvestor,
  getAllInvestors,
  getInvestorById,
  updateInvestor,
  deleteInvestor,
  getInvestorWithAuditTrail,
  getInvestorWithCertificate,
  verifyInvestorCertificate
};