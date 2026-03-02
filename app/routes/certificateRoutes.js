const express = require('express');
const router = express.Router();
const certificateController = require('../controllers/certificateController');

router.get(
  '/harvestable/:investorId',
  certificateController.getHarvestableTreesByInvestor
);

router.post(
  '/generate-harvest',
  certificateController.generateHarvestCertificate
);

router.get(
  "/harvest/:certificateId",
  certificateController.getHarvestCertificate
);

router.get(
  '/investor/:investorId',
  certificateController.getInvestorCertificates
);

module.exports = router;