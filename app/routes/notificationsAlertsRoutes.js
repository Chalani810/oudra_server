// routes/notificationsAlertsRoutes.js
const express = require('express');
const router = express.Router();
const {
    getAllAlerts,
    getAlertById,
    getInvestorAlerts,
    markAsRead,
    acknowledgeAlert,
    getAlertStatistics,
    getAlertsByDateRange,
    deleteOldAlerts,
    resendNotifications
} = require('../controllers/notificationsAlertsController');

// Import middleware
const { authenticate, authorize } = require('../middleware/auth');

// Public routes (for investors)
router.get('/investor/:investorId', getInvestorAlerts);
router.put('/:id/read', markAsRead);
router.put('/:id/acknowledge', acknowledgeAlert);

// Admin routes
router.get('/', authenticate, authorize(['ADMIN', 'MANAGER']), getAllAlerts);
router.get('/stats', authenticate, authorize(['ADMIN', 'MANAGER']), getAlertStatistics);
router.get('/date-range', authenticate, authorize(['ADMIN', 'MANAGER']), getAlertsByDateRange);
router.get('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), getAlertById);
router.delete('/cleanup', authenticate, authorize(['ADMIN']), deleteOldAlerts);
router.post('/resend', authenticate, authorize(['ADMIN']), resendNotifications);

module.exports = router;