//path: oudra-server(same backend for web & mobile apps)/app/routes/treeRoutes.js
const express = require('express');
const router = express.Router();
const treeController = require('../controllers/treeController');
const authMiddleware = require('../middleware/authMiddleware');
const { platformMiddleware, roleMiddleware } = authMiddleware;

// ===== TREE CRUD OPERATIONS =====
router.post('/trees',               authMiddleware, platformMiddleware('web'),    roleMiddleware('manager'), treeController.createTree);
router.get('/trees',                authMiddleware,                                                          treeController.getAllTrees);
router.get('/trees/:treeId',        authMiddleware,                                                          treeController.getTreeById);
router.put('/trees/:treeId',        authMiddleware, platformMiddleware('web'),    roleMiddleware('manager'), treeController.updateTree);
router.delete('/trees/:treeId',     authMiddleware, platformMiddleware('web'),    roleMiddleware('manager'), treeController.deleteTree);
router.put('/trees/:treeId/profile',authMiddleware, platformMiddleware('web'),    roleMiddleware('manager'), treeController.updateTreeProfile);

// ===== SPECIALIZED UPDATES =====
router.put('/trees/:treeId/inspection',     authMiddleware, platformMiddleware('mobile'), treeController.updateInspection);
router.put('/trees/:treeId/lifecycle',      authMiddleware, platformMiddleware('mobile'), treeController.updateLifecycle);
router.put('/trees/:treeId/nfc',            authMiddleware, platformMiddleware('mobile'), treeController.updateNFCTag);
router.put('/trees/:treeId/gps',            authMiddleware, platformMiddleware('mobile'), treeController.updateGPS);
router.put('/trees/:treeId/archive',        authMiddleware, platformMiddleware('web'),    roleMiddleware('manager'), treeController.archiveTree);
router.put('/trees/:treeId/mobile-update',  authMiddleware, platformMiddleware('mobile'), treeController.mobileUpdateTree);
router.put('/trees/:treeId/mobile-profile', authMiddleware, platformMiddleware('mobile'), treeController.mobileUpdateTreeProfile);

// ===== FIELD NOTES / OBSERVATIONS =====
router.get('/trees/:treeId/observations',     authMiddleware,                            treeController.getTreeObservations);
router.post('/trees/:treeId/observations',    authMiddleware, platformMiddleware('mobile'), treeController.addObservation);
router.put('/observations/:observationId',    authMiddleware, platformMiddleware('mobile'), treeController.updateObservation);
router.delete('/observations/:observationId', authMiddleware, platformMiddleware('mobile'), treeController.deleteObservation);

// ===== TREE HISTORY =====
router.get('/trees/:treeId/history',          authMiddleware, treeController.getTreeHistory);
router.get('/trees/:treeId/history/filtered', authMiddleware, treeController.getAllTreeHistory);

module.exports = router;