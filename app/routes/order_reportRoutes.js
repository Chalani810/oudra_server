const express = require('express');
const router = express.Router();
const order_report_Controller = require('../controllers/order_report_Controller');

// Order report route
router.get('/orders', order_report_Controller.generateOrderReport);

module.exports = router;