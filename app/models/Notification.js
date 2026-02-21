// models/Notification.js
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    investorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Investor',
        required: true
    },
    investorName: {
        type: String,
        required: true
    },
    action: {
        type: String,
        enum: ['CREATE', 'UPDATE', 'DELETE'],
        required: true
    },
    modifiedBy: {
        type: String,
        required: true,
        default: 'System'
    },
    changes: {
        type: Map,
        of: {
            old: mongoose.Schema.Types.Mixed,
            new: mongoose.Schema.Types.Mixed
        }
    },
    notifications: [{
        type: {
            type: String,
            enum: ['email', 'sms']
        },
        recipient: String,
        status: {
            type: String,
            enum: ['sent', 'failed'],
            default: 'sent'
        },
        sentAt: {
            type: Date,
            default: Date.now
        }
    }],
    blockchainHash: {
        type: String,
        sparse: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Index for faster queries
notificationSchema.index({ investorId: 1, timestamp: -1 });
notificationSchema.index({ action: 1 });
notificationSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Notification', notificationSchema);