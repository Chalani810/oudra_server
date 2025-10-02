const express = require('express');
const router = express.Router();
const productReportController = require('../controllers/productreport_controller');

// Product PDF download
router.get('/products', productReportController.generateProductReport);

module.exports = router;