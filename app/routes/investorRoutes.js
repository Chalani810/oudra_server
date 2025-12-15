const express = require('express');
const router = express.Router();
const investorController = require('../controllers/investorController');

// Investor routes
router.post('/', investorController.createInvestor);
router.get('/', investorController.getAllInvestors);
router.get('/:id', investorController.getInvestorById);
router.put('/:id', investorController.updateInvestor);
router.delete('/:id', investorController.deleteInvestor);

// NEW: Certificate-related routes
router.get('/:id/certificate', investorController.getInvestorWithCertificate);
router.get('/certificate/verify/:certificateId', investorController.verifyInvestorCertificate);
router.get('/:id/audit', investorController.getInvestorWithAuditTrail);

module.exports = router;