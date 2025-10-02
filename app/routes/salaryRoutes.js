const express = require('express');
const router = express.Router();
const salaryController = require('../controllers/salaryController');

// Create a new salary record
router.post('/', salaryController.createSalary);

// Get all salary records
router.get('/', salaryController.getAllSalaries);

module.exports = router;