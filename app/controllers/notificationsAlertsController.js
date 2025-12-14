// controllers/notificationsAlertsController.js
const NotificationsAlerts = require('../models/NotificationsAlerts');
const NotificationService = require('../services/notificationService');

// Get all alerts with filters
exports.getAllAlerts = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            investorId,
            actionType,
            priority,
            readStatus,
            startDate,
            endDate,
            search
        } = req.query;

        const filters = {
            investorId,
            actionType,
            priority,
            readStatus,
            startDate,
            endDate,
            search
        };

        const result = await NotificationService.getAlerts(
            parseInt(page),
            parseInt(limit),
            filters
        );

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json({
            success: true,
            message: 'Alerts retrieved successfully',
            data: result.data
        });
        
    } catch (error) {
        console.error('Get alerts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve alerts',
            error: error.message
        });
    }
};

// Get single alert by ID
exports.getAlertById = async (req, res) => {
    try {
        const { id } = req.params;
        
        const alert = await NotificationsAlerts.findById(id)
            .populate('investorId', 'name email phone profileImage')
            .populate('modifiedBy.userId', 'name email role profileImage')
            .lean();

        if (!alert) {
            return res.status(404).json({
                success: false,
                message: 'Alert not found'
            });
        }

        res.json({
            success: true,
            data: alert
        });
        
    } catch (error) {
        console.error('Get alert error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve alert',
            error: error.message
        });
    }
};

// Get investor's alerts
exports.getInvestorAlerts = async (req, res) => {
    try {
        const { investorId } = req.params;
        const { limit = 50, unreadOnly = false } = req.query;

        let query = { investorId };
        
        if (unreadOnly === 'true') {
            query['readStatus.byInvestor.read'] = false;
        }

        const alerts = await NotificationsAlerts.find(query)
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('modifiedBy.userId', 'name email role')
            .lean();

        // Get unread count
        const unreadCount = await NotificationsAlerts.countDocuments({
            investorId,
            'readStatus.byInvestor.read': false
        });

        res.json({
            success: true,
            data: {
                alerts,
                unreadCount,
                total: alerts.length
            }
        });
        
    } catch (error) {
        console.error('Get investor alerts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve investor alerts',
            error: error.message
        });
    }
};

// Mark alert as read
exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const ip = req.ip;
        const device = req.headers['user-agent'];

        const result = await NotificationService.markAlertAsRead(id, ip, device);

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json({
            success: true,
            message: 'Alert marked as read'
        });
        
    } catch (error) {
        console.error('Mark as read error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark alert as read',
            error: error.message
        });
    }
};

// Acknowledge alert (for critical actions)
exports.acknowledgeAlert = async (req, res) => {
    try {
        const { id } = req.params;
        
        const alert = await NotificationsAlerts.findById(id);
        
        if (!alert) {
            return res.status(404).json({
                success: false,
                message: 'Alert not found'
            });
        }

        if (!alert.requiresAcknowledgement) {
            return res.status(400).json({
                success: false,
                message: 'This alert does not require acknowledgement'
            });
        }

        alert.acknowledgedByInvestor = true;
        alert.acknowledgedAt = new Date();
        await alert.save();

        res.json({
            success: true,
            message: 'Alert acknowledged successfully'
        });
        
    } catch (error) {
        console.error('Acknowledge alert error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to acknowledge alert',
            error: error.message
        });
    }
};

// Get alert statistics
exports.getAlertStatistics = async (req, res) => {
    try {
        const result = await NotificationService.getAlertStats();

        if (!result.success) {
            return res.status(400).json(result);
        }

        res.json({
            success: true,
            data: result.data
        });
        
    } catch (error) {
        console.error('Get statistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get alert statistics',
            error: error.message
        });
    }
};

// Get alerts by date range
exports.getAlertsByDateRange = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: 'Start date and end date are required'
            });
        }

        const alerts = await NotificationsAlerts.getAlertsByDateRange(startDate, endDate);

        res.json({
            success: true,
            data: {
                alerts,
                count: alerts.length
            }
        });
        
    } catch (error) {
        console.error('Get alerts by date range error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to retrieve alerts',
            error: error.message
        });
    }
};

// Delete old alerts (admin only)
exports.deleteOldAlerts = async (req, res) => {
    try {
        const { days = 90 } = req.query;
        
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));
        
        const result = await NotificationsAlerts.deleteMany({
            createdAt: { $lt: cutoffDate },
            priority: { $ne: 'CRITICAL' }
        });

        res.json({
            success: true,
            message: `Deleted ${result.deletedCount} old alerts`,
            data: {
                deletedCount: result.deletedCount,
                cutoffDate: cutoffDate.toISOString()
            }
        });
        
    } catch (error) {
        console.error('Delete old alerts error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete old alerts',
            error: error.message
        });
    }
};

// Resend failed notifications
exports.resendNotifications = async (req, res) => {
    try {
        const { alertId, notificationType } = req.body;
        
        const alert = await NotificationsAlerts.findById(alertId)
            .populate('investorId');
        
        if (!alert) {
            return res.status(404).json({
                success: false,
                message: 'Alert not found'
            });
        }

        let result;
        const investor = alert.investorId;
        const modifiedBy = alert.modifiedBy.userName;
        
        // Resend based on type
        if (notificationType === 'email' || notificationType === 'all') {
            const emailResult = await EmailService.sendInvestorAlert(
                investor,
                alert.actionCategory,
                alert.changes.reduce((acc, change) => {
                    acc[change.fieldName] = {
                        old: change.oldValue,
                        new: change.newValue
                    };
                    return acc;
                }, {}),
                modifiedBy
            );
            
            if (emailResult.success) {
                await alert.updateDeliveryStatus('email', true, emailResult.messageId);
            }
        }
        
        if (notificationType === 'sms' || notificationType === 'all') {
            const smsResult = await SMSService.sendInvestorSMS(
                investor.phone,
                investor.name,
                alert.actionCategory,
                modifiedBy
            );
            
            if (smsResult.success) {
                await alert.updateDeliveryStatus('sms', true, smsResult.messageId);
            }
        }

        await alert.save();

        res.json({
            success: true,
            message: 'Notifications resent successfully'
        });
        
    } catch (error) {
        console.error('Resend notifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resend notifications',
            error: error.message
        });
    }
};