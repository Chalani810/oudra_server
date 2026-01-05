const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');

// 🌾 Harvested trees only
router.get(
  '/harvestable/:investorId',
  certificateController.getHarvestableTreesByInvestor
);

// 👤 Investor certificates
router.get(
  '/investor/:investorId',
  certificateController.getInvestorCertificates
);

// 📄 Get single certificate
router.get(
  '/:certificateId',
  certificateController.getCertificate
);

// 🌾 Generate HARVEST certificate (includes blockchain registration)
router.post(
  '/generate-harvest',
  certificateController.generateHarvestCertificate
);

router.get(
  "/harvest/:certificateId",
  certificateController.getHarvestCertificate
);

// ✅ Verify certificate
router.get(
  '/verify/:certificateId',
  certificateController.verifyCertificate
);

router.get(
  '/certificates/:certificateId/details',
  certificateController.getHarvestCertificateDetails
);

module.exports = router;
