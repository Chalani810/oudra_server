// path: oudra-server/app/routes/certificateRoutes.js
const express    = require("express");
const router     = express.Router();
const ctrl       = require("../controllers/certificateController");

// ── Investor & Admin shared ───────────────────────────────────────────────────

// GET /api/certificates/harvest/:investorId
// → Generates PDF and streams it — called by investor dashboard + admin panel
router.get("/harvest/:investorId", ctrl.downloadHarvestCertificate);

// GET /api/certificates/harvestable/:investorId
// → Returns list of verified trees for an investor
router.get("/harvestable/:investorId", ctrl.getHarvestableTreesByInvestor);

// GET /api/certificates/investor/:investorId
// → Returns certificate metadata for an investor
router.get("/investor/:investorId", ctrl.getInvestorCertificates);

// ── Admin only ────────────────────────────────────────────────────────────────

// GET /api/certificates/all
// → Returns all certificates (admin overview)
router.get("/all", ctrl.getAllCertificates);

// GET /api/certificates/stats
// → Returns certificate stats (admin dashboard)
router.get("/stats", ctrl.getCertificateStats);

module.exports = router;