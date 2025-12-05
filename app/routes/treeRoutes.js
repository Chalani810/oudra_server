//path: oudra-server(same backend for web & mobile apps)/app/routes/treeRoutes.js
const express = require('express');
const router = express.Router();
const treeController = require('../controllers/treeController');

// ===== TREE CRUD OPERATIONS =====
router.post('/trees', treeController.createTree);
router.get('/trees', treeController.getAllTrees);
router.get('/trees/:treeId', treeController.getTreeById);
router.put('/trees/:treeId', treeController.updateTree);
router.delete('/trees/:treeId', treeController.deleteTree);
router.put('/trees/:treeId/profile', treeController.updateTreeProfile);

// ===== SPECIALIZED UPDATES =====
router.put('/trees/:treeId/inspection', treeController.updateInspection);
router.put('/trees/:treeId/lifecycle', treeController.updateLifecycle);
router.put('/trees/:treeId/nfc', treeController.updateNFCTag);
router.put('/trees/:treeId/gps', treeController.updateGPS);
router.put('/trees/:treeId/archive', treeController.archiveTree);

// ===== FIELD NOTES / OBSERVATIONS =====
router.get('/trees/:treeId/observations', treeController.getTreeObservations);
router.post('/trees/:treeId/observations', treeController.addObservation);
router.put('/observations/:observationId', treeController.updateObservation);
router.delete('/observations/:observationId', treeController.deleteObservation);

router.put('/observations/:observationId', treeController.updateObservation);
router.delete('/observations/:observationId', treeController.deleteObservation);

// ===== TREE HISTORY =====
router.get('/trees/:treeId/history', treeController.getTreeHistory);
router.get('/trees/:treeId/history/filtered', treeController.getAllTreeHistory);

module.exports = router;