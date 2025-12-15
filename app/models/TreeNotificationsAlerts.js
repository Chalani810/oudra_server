// app/models/TreeNotificationsAlerts.js
const mongoose = require('mongoose');

const TreeNotificationsAlertsSchema = new mongoose.Schema({
    // Tree Information
    treeId: { 
        type: String, 
        required: true,
        index: true
    },
    investorId: { 
        type: String,
        index: true
    },
    investorName: String,
    investorEmail: String,
    
    // Action Details
    actionType: {
        type: String,
        enum: [
            'TREE_CREATED',
            'TREE_UPDATED',
            'TREE_DELETED',
            'HEALTH_STATUS_CHANGED',
            'LIFECYCLE_CHANGED',
            'TREE_INOCULATED',
            'TREE_INSPECTED',
            'LOCATION_UPDATED',
            'NFC_TAG_ASSIGNED'
        ],
        required: true
    },
    actionCategory: {
        type: String,
        enum: ['CREATE', 'UPDATE', 'DELETE', 'HEALTH_UPDATE', 'LIFECYCLE_UPDATE', 'INOCULATION', 'INSPECTION', 'GPS_UPDATE'],
        required: true
    },
    
    // Who made the change
    modifiedBy: {
        userId: String,
        userName: { type: String, required: true },
        userRole: {
            type: String,
            enum: ['ADMIN', 'MANAGER', 'INSPECTOR', 'SYSTEM'],
            default: 'ADMIN'
        }
    },
    
    // What changed
    changes: [{
        fieldName: String,
        fieldLabel: String,
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed,
        changeType: {
            type: String,
            enum: ['ADDED', 'MODIFIED', 'REMOVED', 'UPDATED']
        }
    }],
    
    // Tree details snapshot
    treeDetails: {
        healthStatus: String,
        lifecycleStatus: String,
        block: String,
        plantedDate: Date,
        inoculationCount: Number
    },
    
    // Delivery Status
    deliveryStatus: {
        email: {
            sent: { type: Boolean, default: false },
            sentAt: Date,
            messageId: String,
            error: String
        },
        sms: {
            sent: { type: Boolean, default: false },
            sentAt: Date,
            messageId: String,
            error: String
        }
    },
    
    // Notification Content
    notificationContent: {
        emailSubject: String,
        emailBody: String,
        smsMessage: String
    },
    
    // Metadata
    ipAddress: String,
    userAgent: String,
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    // Read status
    read: {
        type: Boolean,
        default: false
    },
    readAt: Date
    
}, { 
    timestamps: true 
});

// Indexes for efficient querying
TreeNotificationsAlertsSchema.index({ treeId: 1, timestamp: -1 });
TreeNotificationsAlertsSchema.index({ investorId: 1, timestamp: -1 });
TreeNotificationsAlertsSchema.index({ actionType: 1 });
TreeNotificationsAlertsSchema.index({ 'modifiedBy.userId': 1 });
TreeNotificationsAlertsSchema.index({ read: 1 });

// Method to mark as read
TreeNotificationsAlertsSchema.methods.markAsRead = async function() {
    this.read = true;
    this.readAt = new Date();
    await this.save();
};

// Static method to get unread count for investor
TreeNotificationsAlertsSchema.statics.getUnreadCountByInvestor = async function(investorId) {
    return await this.countDocuments({ investorId, read: false });
};

// Static method to get recent alerts for tree
TreeNotificationsAlertsSchema.statics.getRecentAlertsForTree = async function(treeId, limit = 10) {
    return await this.find({ treeId })
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
};

module.exports = mongoose.model('TreeNotificationsAlerts', TreeNotificationsAlertsSchema);