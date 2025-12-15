// oudra-server/app/routes/certificateRoutes.js
const express = require('express');
const router = express.Router();
const SmartCertificate = require('../models/SmartCertificate');
const Investor = require('../models/Investor');
const Tree = require('../models/Tree'); // Make sure this matches your Tree model
const UnifiedBlockchainRecord = require('../models/UnifiedBlockchainRecord');

// Helper function to get investor trees
async function getInvestorTrees(investorId, specificTreeIds = null) {
  console.log('🔍 Getting trees for investor:', investorId);
  
  try {
    // If specific tree IDs provided
    if (specificTreeIds && Array.isArray(specificTreeIds) && specificTreeIds.length > 0) {
      console.log('📋 Looking for specific trees:', specificTreeIds);
      const trees = await Tree.find({
        treeId: { $in: specificTreeIds }
      }).lean();
      console.log(`✓ Found ${trees.length} specific trees`);
      return trees;
    }
    
    // Get all trees linked to investor
    const trees = await Tree.find({
      investorId: investorId.toString()
    }).lean();
    
    console.log(`✓ Found ${trees.length} trees linked to investor`);
    return trees;
  } catch (error) {
    console.error('❌ Error getting investor trees:', error);
    return [];
  }
}

// Calculate tree metrics
function calculateTreeMetrics(trees) {
  if (!trees || trees.length === 0) {
    return {
      total: 0,
      healthy: 0,
      warning: 0,
      damaged: 0,
      dead: 0,
      readyForHarvest: 0,
      inoculatedOnce: 0,
      inoculatedTwice: 0,
      totalCarbon: 0,
      averageAge: 0
    };
  }
  
  const metrics = {
    total: trees.length,
    healthy: trees.filter(t => t.healthStatus === 'Healthy').length,
    warning: trees.filter(t => t.healthStatus === 'Warning').length,
    damaged: trees.filter(t => t.healthStatus === 'Damaged').length,
    dead: trees.filter(t => t.healthStatus === 'Dead').length,
    readyForHarvest: trees.filter(t => t.readyForHarvest === true).length,
    inoculatedOnce: trees.filter(t => t.inoculationCount === 1).length,
    inoculatedTwice: trees.filter(t => t.inoculationCount === 2).length,
    totalCarbon: Math.round(trees.length * 8.33 * 100) / 100,
    averageAge: 0
  };
  
  // Calculate average age
  const treesWithAge = trees.filter(t => t.plantedDate);
  if (treesWithAge.length > 0) {
    const totalAge = treesWithAge.reduce((sum, t) => {
      const years = (new Date() - new Date(t.plantedDate)) / (1000 * 60 * 60 * 24 * 365);
      return sum + years;
    }, 0);
    metrics.averageAge = Math.round((totalAge / treesWithAge.length) * 10) / 10;
  }
  
  return metrics;
}

// Determine resin grade
function determineResinGrade(trees) {
  if (!trees || trees.length === 0) return 'Not Applicable';
  
  const healthyPercent = (trees.filter(t => t.healthStatus === 'Healthy').length / trees.length) * 100;
  const inoculatedPercent = (trees.filter(t => t.inoculationCount >= 1).length / trees.length) * 100;
  
  if (healthyPercent >= 95 && inoculatedPercent >= 80) return 'AAA+ Premium Quality';
  if (healthyPercent >= 90 && inoculatedPercent >= 60) return 'AAA Quality';
  if (healthyPercent >= 80 && inoculatedPercent >= 40) return 'AA Quality';
  if (healthyPercent >= 70) return 'A Quality';
  return 'B Quality';
}

// ============================================
// MAIN ENDPOINTS
// ============================================

// Generate certificate
router.post('/generate', async (req, res) => {
  console.log('\n=== 🎓 CERTIFICATE GENERATION STARTED ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  try {
    const { 
      investorId, 
      treeIds = [],
      certificateType = 'INVESTOR_AUTH',
      autoDetectTrees = true
    } = req.body;
    
    // Validate investorId
    if (!investorId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Investor ID is required'
      });
    }
    
    // Find investor
    const investor = await Investor.findById(investorId);
    if (!investor) {
      return res.status(404).json({ 
        success: false, 
        error: 'Investor not found'
      });
    }
    
    // Get trees
    let trees = [];
    let finalTreeIds = [];
    
    if (treeIds && Array.isArray(treeIds) && treeIds.length > 0) {
      trees = await getInvestorTrees(investorId, treeIds);
      finalTreeIds = trees.map(t => t.treeId);
    } else if (autoDetectTrees) {
      trees = await getInvestorTrees(investorId);
      finalTreeIds = trees.map(t => t.treeId);
    }
    
    // Calculate metrics
    const treeMetrics = calculateTreeMetrics(trees);
    
    // Create certificate data
    const certificationData = {
      investorName: investor.name,
      investorEmail: investor.email,
      investorPhone: investor.phone,
      treesOwned: treeMetrics.total,
      totalInvestment: investor.investment || 0,
      certifiedResinGrade: determineResinGrade(trees),
      carbonCredits: treeMetrics.totalCarbon,
      certificationDate: new Date(),
      expiryDate: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
      certifiedBy: 'Dr. Sarah Mitchell',
      location: trees[0]?.block || 'Sustainable Forestry Plantation Zone'
    };
    
    // Get blockchain anchors
    const anchors = [];
    
    const investorBlock = await UnifiedBlockchainRecord.findOne({
      entityType: 'INVESTOR',
      entityId: investorId.toString()
    }).sort({ index: -1 });
    
    if (investorBlock) {
      anchors.push({
        blockHash: investorBlock.hash,
        blockNumber: investorBlock.index,
        entityType: 'INVESTOR',
        timestamp: new Date(investorBlock.timestamp)
      });
    }
    
    // Add tree blocks if available
    if (finalTreeIds.length > 0) {
      const treeBlocks = await UnifiedBlockchainRecord.find({
        entityType: 'TREE',
        entityId: { $in: finalTreeIds }
      }).sort({ index: -1 }).limit(10);
      
      treeBlocks.forEach(tb => {
        anchors.push({
          blockHash: tb.hash,
          blockNumber: tb.index,
          entityType: 'TREE',
          timestamp: new Date(tb.timestamp)
        });
      });
    }
    
    // Create certificate
    const certificateId = `CERT-${certificateType}-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    
    const certificate = new SmartCertificate({
      certificateId,
      type: certificateType,
      investorId,
      treeIds: finalTreeIds,
      blockchainAnchors: anchors,
      certificationData,
      verificationMetadata: {
        totalBlocksVerified: anchors.length,
        chainIntegrityScore: 100,
        lastVerificationDate: new Date(),
        verificationType: 'AUTOMATIC',
        verificationStatus: 'VALID'
      },
      smartFeatures: {
        autoUpdate: true,
        notifyOnChanges: true,
        publiclyViewable: true
      },
      qrCode: {
        data: `${req.headers.origin || 'http://localhost:3000'}/smart-certificate/${certificateId}`,
        generatedAt: new Date()
      },
      status: 'ACTIVE',
      versionHistory: [{
        version: 1,
        updatedAt: new Date(),
        reason: `${certificateType} certificate issued`,
        changes: {
          issuedTo: investor.name,
          trees: treeMetrics.total,
          investment: investor.investment,
          type: certificateType
        }
      }]
    });
    
    await certificate.save();
    
    // Return response
    res.json({
      success: true,
      message: `${certificateType} certificate generated successfully`,
      certificate: {
        _id: certificate._id,
        certificateId: certificate.certificateId,
        type: certificate.type,
        status: certificate.status,
        certificationData: certificate.certificationData,
        verificationMetadata: certificate.verificationMetadata,
        blockchainAnchors: certificate.blockchainAnchors.length,
        treeCount: treeMetrics.total,
        qrCode: certificate.qrCode.data,
        createdAt: certificate.createdAt
      },
      metrics: treeMetrics
    });
    
  } catch (error) {
    console.error('Certificate generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message
    });
  }
});

// Get all certificates
router.get('/', async (req, res) => {
  try {
    const certificates = await SmartCertificate.find()
      .sort({ createdAt: -1 })
      .populate('investorId', 'name email phone investment status')
      .select('-__v');
    
    res.json({
      success: true,
      data: certificates,
      count: certificates.length
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get certificate by ID
router.get('/:certificateId', async (req, res) => {
  try {
    const certificate = await SmartCertificate.findOne({ 
      certificateId: req.params.certificateId 
    })
    .populate('investorId', 'name email phone investment status createdAt')
    .select('-__v');
    
    if (!certificate) {
      return res.status(404).json({ 
        success: false, 
        error: 'Certificate not found' 
      });
    }
    
    // Get tree details
    let treeDetails = [];
    if (certificate.treeIds && certificate.treeIds.length > 0) {
      treeDetails = await Tree.find({ 
        treeId: { $in: certificate.treeIds } 
      }).select('treeId healthStatus lifecycleStatus plantedDate block gps inoculationCount readyForHarvest -_id');
    }
    
    res.json({
      success: true,
      certificate: {
        ...certificate.toObject(),
        treeDetails
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Verify certificate
router.get('/:certificateId/verify', async (req, res) => {
  try {
    const certificate = await SmartCertificate.findOne({ 
      certificateId: req.params.certificateId 
    });
    
    if (!certificate) {
      return res.status(404).json({ 
        success: false, 
        error: 'Certificate not found' 
      });
    }
    
    const verificationResult = await certificate.verify();
    
    // Check if expired
    const isExpired = certificate.certificationData?.expiryDate && 
      new Date(certificate.certificationData.expiryDate) < new Date();
    
    if (isExpired && certificate.status === 'ACTIVE') {
      certificate.status = 'EXPIRED';
      certificate.verificationMetadata.verificationStatus = 'EXPIRED';
      await certificate.save();
    }
    
    const investor = await Investor.findById(certificate.investorId);
    
    res.json({
      success: true,
      verification: {
        ...verificationResult,
        certificateId: certificate.certificateId,
        certificateType: certificate.type,
        certificateStatus: certificate.status,
        isExpired
      },
      certificate: {
        id: certificate.certificateId,
        type: certificate.type,
        status: certificate.status,
        investorName: investor?.name || 'Unknown',
        certificationData: certificate.certificationData,
        blockchainAnchors: certificate.blockchainAnchors?.length || 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;