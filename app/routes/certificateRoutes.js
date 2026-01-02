const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');

// Generate harvest certificate
router.post('/harvest', certificateController.generateHarvestCertificate);

// Get certificate by ID
router.get('/:certificateId', certificateController.getCertificate);

// Get certificates by investor
router.get('/investor/:investorId', async (req, res) => {
  try {
    const { investorId } = req.params;
    
    // Find the investor with certificates
    const investor = await require('../models/Investor').findById(investorId);
    
    if (!investor) {
      return res.status(404).json({
        success: false,
        message: 'Investor not found'
      });
    }
    
    res.json({
      success: true,
      count: investor.certificates?.length || 0,
      data: investor.certificates || []
    });
  } catch (error) {
    console.error('Get certificates by investor error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Download certificate
router.get('/:certificateId/download', async (req, res) => {
  try {
    const { certificateId } = req.params;
    
    // Find investor with this certificate
    const investor = await require('../models/Investor').findOne({
      'certificates.certificateId': certificateId
    });
    
    if (!investor) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }
    
    const certificate = investor.certificates.find(
      cert => cert.certificateId === certificateId
    );
    
    // In a real implementation, you'd generate a PDF here
    // For now, return the certificate data
    res.json({
      success: true,
      message: 'Certificate download endpoint',
      data: certificate
    });
  } catch (error) {
    console.error('Download certificate error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Preview certificate
router.get('/:certificateId/preview', async (req, res) => {
  try {
    const { certificateId } = req.params;
    
    // Find investor with this certificate
    const investor = await require('../models/Investor').findOne({
      'certificates.certificateId': certificateId
    });
    
    if (!investor) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found'
      });
    }
    
    const certificate = investor.certificates.find(
      cert => cert.certificateId === certificateId
    );
    
    res.json({
      success: true,
      message: 'Certificate preview endpoint',
      data: certificate
    });
  } catch (error) {
    console.error('Preview certificate error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;