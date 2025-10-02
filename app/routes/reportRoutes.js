const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');

// Simple PDF download
router.get('/employee', reportController.generateEmployeeReport);

module.exports = router;