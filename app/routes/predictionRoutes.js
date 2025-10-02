const express = require("express");
const router = express.Router();
const { predictRevenue } = require("../controllers/predictionController");

router.post("/predict", predictRevenue);

module.exports = router;
