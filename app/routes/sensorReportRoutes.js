const express = require('express');
const router = express.Router();
const { generateSensorReport } = require('../controllers/sensorReportController');

// GET /api/reports/sensor
// Downloads a PDF report of the latest sensor readings for all trees
router.get('/sensor', generateSensorReport);

module.exports = router;