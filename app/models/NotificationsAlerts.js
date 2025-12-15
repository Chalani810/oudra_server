// models/NotificationsAlerts.js
const mongoose = require('mongoose');

const notificationAlertSchema = new mongoose.Schema({
    // Core Investor Information (from both models)
    investorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Investor',
        required: true,
        index: true
    },
    investorName: {
        type: String,
        required: true
    },
    investorEmail: {
        type: String,
        required: true
    },
    investorPhone: {
        type: String,
        required: true
    },
    
    // Action Information (enhanced from both)
    actionType: {
        type: String,
        enum: [
            'ACCOUNT_CREATED', 
            'DATA_UPDATED', 
            'ACCOUNT_DELETED',
            'CREATE',  // Legacy support
            'UPDATE',  // Legacy support
            'DELETE',  // Legacy support
            'DOCUMENT_UPLOADED',
            'STATUS_CHANGED',
            'PASSWORD_RESET',
            'LOGIN_ATTEMPT',
            'OTHER'
        ],
        required: true,
        index: true
    },
    
    // Category mapping (from NotificationsAlerts)
    actionCategory: {
        type: String,
        enum: ['CREATE', 'UPDATE', 'DELETE', 'SECURITY', 'SYSTEM'],
        required: true
    },
    
    // Modified By Information (enhanced)
    modifiedBy: {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        userName: String,
        userRole: String,
        userType: {
            type: String,
            enum: ['ADMIN', 'INVESTOR', 'SYSTEM', 'API'],
            default: 'SYSTEM'
        }
    },
    
    // Changes Tracking (enhanced hybrid approach)
    changes: {
        // Array of structured changes (from NotificationsAlerts)
        detailed: [{
            fieldName: String,
            fieldLabel: String,
            oldValue: mongoose.Schema.Types.Mixed,
            newValue: mongoose.Schema.Types.Mixed,
            changeType: {
                type: String,
                enum: ['ADDED', 'MODIFIED', 'REMOVED', 'UPDATED']
            },
            isSensitive: {
                type: Boolean,
                default: false
            }
        }],
        
        // Map format for quick lookups (from Notification)
        quickReference: {
            type: Map,
            of: {
                old: mongoose.Schema.Types.Mixed,
                new: mongoose.Schema.Types.Mixed
            }
        },
        
        // Summary
        summary: String,
        totalChanges: {
            type: Number,
            default: 0
        }
    },
    
    // Notification Delivery Status (from NotificationsAlerts)
    deliveryStatus: {
        email: {
            sent: Boolean,
            sentAt: Date,
            messageId: String,
            error: String,
            retryCount: {
                type: Number,
                default: 0
            }
        },
        sms: {
            sent: Boolean,
            sentAt: Date,
            messageId: String,
            error: String,
            retryCount: {
                type: Number,
                default: 0
            }
        },
        push: {
            sent: Boolean,
            sentAt: Date,
            deviceTokens: [String],
            error: String
        },
        webhook: {
            sent: Boolean,
            sentAt: Date,
            endpoint: String,
            responseCode: Number,
            error: String
        }
    },
    
    // Notification Content (from NotificationsAlerts)
    notificationContent: {
        emailSubject: String,
        emailBody: String,
        smsMessage: String,
        pushTitle: String,
        pushBody: String,
        language: {
            type: String,
            default: 'en'
        },
        templateId: String
    },
    
    // Communication History (from Notification - enhanced)
    notifications: [{
        type: {
            type: String,
            enum: ['email', 'sms', 'push', 'webhook', 'in-app']
        },
        recipient: String,
        status: {
            type: String,
            enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
            default: 'pending'
        },
        sentAt: {
            type: Date,
            default: Date.now
        },
        deliveredAt: Date,
        readAt: Date,
        messageId: String,
        error: String,
        retryAttempt: Number
    }],
    
    // Blockchain Integration (from Notification)
    blockchain: {
        hash: String,
        transactionId: String,
        blockNumber: Number,
        timestamp: Date,
        network: String,
        verified: {
            type: Boolean,
            default: false
        }
    },
    
    // Context Information (from NotificationsAlerts)
    context: {
        ipAddress: String,
        userAgent: String,
        location: String,
        deviceType: String,
        sessionId: String,
        requestId: String
    },
    
    // Status & Metadata
    status: {
        type: String,
        enum: ['active', 'archived', 'deleted'],
        default: 'active'
    },
    
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'critical'],
        default: 'medium'
    },
    
    readBy: [{
        userId: mongoose.Schema.Types.ObjectId,
        userName: String,
        readAt: Date
    }],
    
    // Timestamps
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    updatedAt: Date,
    archivedAt: Date
    
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for compatibility with old code
notificationAlertSchema.virtual('action').get(function() {
    // Map new actionType to old action enum
    const mapping = {
        'ACCOUNT_CREATED': 'CREATE',
        'DATA_UPDATED': 'UPDATE', 
        'ACCOUNT_DELETED': 'DELETE'
    };
    return mapping[this.actionType] || this.actionType;
});

// Indexes for optimal querying
notificationAlertSchema.index({ investorId: 1, createdAt: -1 });
notificationAlertSchema.index({ 'modifiedBy.userId': 1 });
notificationAlertSchema.index({ 'deliveryStatus.email.sent': 1 });
notificationAlertSchema.index({ 'deliveryStatus.sms.sent': 1 });
notificationAlertSchema.index({ status: 1, priority: -1 });
notificationAlertSchema.index({ 'context.sessionId': 1 });
notificationAlertSchema.index({ 'blockchain.hash': 1 }, { sparse: true });
notificationAlertSchema.index({ 'notifications.status': 1 });

// Compound indexes for common queries
notificationAlertSchema.index({ 
    investorId: 1, 
    actionCategory: 1, 
    createdAt: -1 
});

notificationAlertSchema.index({
    createdAt: -1,
    priority: -1,
    status: 1
});

// Methods
notificationAlertSchema.methods.markAsRead = function(userId, userName) {
    this.readBy.push({
        userId,
        userName,
        readAt: new Date()
    });
    return this.save();
};

notificationAlertSchema.methods.addNotificationAttempt = function(type, recipient, status, messageId, error) {
    this.notifications.push({
        type,
        recipient,
        status,
        messageId,
        error,
        sentAt: new Date()
    });
    
    // Update delivery status
    if (type === 'email') {
        this.deliveryStatus.email = {
            sent: status === 'sent' || status === 'delivered',
            sentAt: new Date(),
            messageId,
            error
        };
    } else if (type === 'sms') {
        this.deliveryStatus.sms = {
            sent: status === 'sent' || status === 'delivered',
            sentAt: new Date(),
            messageId,
            error
        };
    }
    
    return this.save();
};

notificationAlertSchema.methods.addToBlockchain = function(hash, transactionId, blockNumber, network) {
    this.blockchain = {
        hash,
        transactionId,
        blockNumber,
        network,
        timestamp: new Date(),
        verified: false
    };
    return this.save();
};

// Static methods
notificationAlertSchema.statics.findByInvestor = function(investorId, limit = 50, skip = 0) {
    return this.find({ investorId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();
};

notificationAlertSchema.statics.findUnsentNotifications = function(type) {
    return this.find({
        [`deliveryStatus.${type}.sent`]: false,
        status: 'active',
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    }).limit(100);
};

// Pre-save middleware
notificationAlertSchema.pre('save', function(next) {
    if (this.isModified('changes.detailed')) {
        this.changes.totalChanges = this.changes.detailed?.length || 0;
        
        // Auto-generate summary
        if (this.changes.detailed?.length > 0) {
            this.changes.summary = `${this.changes.totalChanges} field(s) updated`;
        }
    }
    
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('NotificationAlert', notificationAlertSchema, 'notificationsAlerts');