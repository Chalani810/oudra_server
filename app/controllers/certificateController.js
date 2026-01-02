// path: controllers/certificateController.js
const Tree = require('../models/TreeModel');
const Investor = require('../models/Investor');

/**
 * GENERATE HARVEST CERTIFICATE
 */
exports.generateHarvestCertificate = async (req, res) => {
  try {
    const { treeId } = req.body;

    // Get tree with all details
    const tree = await Tree.findOne({ treeId })
      .populate('investor', 'name email phone investment status');

    if (!tree) {
      return res.status(404).json({
        success: false,
        error: 'Tree not found'
      });
    }

    // Verify tree has investor
    if (!tree.investor) {
      return res.status(400).json({
        success: false,
        error: 'Tree is not assigned to any investor'
      });
    }

    // Verify tree is harvested
    if (tree.lifecycleStatus !== 'Harvested') {
      return res.status(400).json({
        success: false,
        error: 'Tree must be harvested before generating certificate'
      });
    }

    // Verify certificate not already generated
    if (tree.harvestData?.certificateGenerated) {
      return res.status(400).json({
        success: false,
        error: 'Certificate already generated for this tree'
      });
    }

    // Generate certificate data
    const certificateId = `CERT-${tree.treeId}-${Date.now().toString().slice(-6)}`;
    
    const certificateData = {
      certificateId,
      issueDate: new Date(),
      validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year validity
      type: 'HARVEST',
      status: 'ACTIVE',
      verificationUrl: `${process.env.BASE_URL}/verify/${certificateId}`,
      
      investor: {
        id: tree.investor._id,
        name: tree.investor.name,
        email: tree.investor.email,
        phone: tree.investor.phone,
        investment: tree.investor.investment
      },
      
      tree: {
        treeId: tree.treeId,
        nfcTagId: tree.nfcTagId,
        block: tree.block,
        plantedDate: tree.plantedDate,
        harvestedAt: tree.harvestData?.harvestedAt || new Date(),
        ageAtHarvest: calculateTreeAge(tree.plantedDate, tree.harvestData?.harvestedAt),
        healthStatus: tree.healthStatus,
        lifecycleStatus: tree.lifecycleStatus,
        inoculationCount: tree.inoculationCount,
        gps: tree.gps,
        lastInspection: tree.lastInspection,
        inspectedBy: tree.inspectedBy
      },
      
      harvestDetails: {
        harvestNotes: tree.harvestData?.harvestNotes,
        resinYield: tree.harvestData?.resinYield,
        qualityGrade: tree.harvestData?.qualityGrade,
        harvestedBy: tree.harvestData?.harvestedBy || 'System'
      },
      
      verification: {
        blockchainHash: generateBlockchainHash(certificateId),
        issuedBy: process.env.COMPANY_NAME || 'OUDRA System',
        inspectorSignature: generateDigitalSignature(),
        timestamp: new Date().toISOString()
      }
    };

    // Save certificate to investor
    const investor = await Investor.findById(tree.investor._id);
    investor.certificates.push({
      certificateId,
      treeId: tree.treeId,
      issueDate: new Date(),
      type: 'HARVEST',
      status: 'ACTIVE',
      data: certificateData
    });
    await investor.save();

    // Mark tree as certificate generated
    tree.harvestData = {
      ...tree.harvestData,
      certificateGenerated: true,
      certificateId,
      certificateGeneratedAt: new Date()
    };
    await tree.save();

    res.json({
      success: true,
      message: 'Certificate generated successfully',
      data: {
        certificate: certificateData,
        downloadUrl: `${API_URL}/certificates/${certificateId}/download`,
        previewUrl: `${API_URL}/certificates/${certificateId}/preview`
      }
    });

  } catch (error) {
    console.error('Generate certificate error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * GET CERTIFICATE BY ID
 */
exports.getCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;

    // Find investor with this certificate
    const investor = await Investor.findOne({
      'certificates.certificateId': certificateId
    });

    if (!investor) {
      return res.status(404).json({
        success: false,
        error: 'Certificate not found'
      });
    }

    const certificate = investor.certificates.find(
      cert => cert.certificateId === certificateId
    );

    res.json({
      success: true,
      data: certificate
    });
  } catch (error) {
    console.error('Get certificate error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Helper functions
function calculateTreeAge(plantedDate, harvestedDate) {
  const planted = new Date(plantedDate);
  const harvested = new Date(harvestedDate || new Date());
  
  let years = harvested.getFullYear() - planted.getFullYear();
  let months = harvested.getMonth() - planted.getMonth();
  
  if (months < 0) {
    years--;
    months += 12;
  }
  
  return `${years} years ${months} months`;
}

function generateBlockchainHash(data) {
  // In production, use a real blockchain library
  return `0x${Buffer.from(JSON.stringify(data)).toString('hex').slice(0, 64)}`;
}

function generateDigitalSignature() {
  // In production, use proper digital signature
  return `SIG-${Date.now().toString(36).toUpperCase()}`;
}