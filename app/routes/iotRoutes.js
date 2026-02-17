const express = require('express');
const router = express.Router();
const iotController = require('../controllers/iotController');

router.post('/sensor/sync/:treeId', iotController.syncData);
router.get('/sensor/latest/:treeId', iotController.getLatest);
router.get('/sensor/all', iotController.getAll);

module.exports = router;