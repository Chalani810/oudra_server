//path: oudra-server(same backend for web & mobile apps)/app/routes/syncRoutes.js
const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');

// Batch sync endpoint
router.post('/sync/batch', syncController.batchSync);

// Test endpoint
router.get('/sync/test', syncController.testSync);

module.exports = router;