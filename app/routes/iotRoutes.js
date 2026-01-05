const express = require('express');
const router = express.Router();
const iotController = require('../controllers/iotController');

// Route to Sync (Triggered by Mobile Sync Button)
router.post('/sensor/sync/:treeId', iotController.syncData);

// Route to get Live Values (To refresh screen)
router.get('/sensor/latest/:treeId', iotController.getLatest);

module.exports = router;