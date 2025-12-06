// models/NotificationsAlerts.js
const mongoose = require('mongoose');

const notificationsAlertsSchema = new mongoose.Schema({
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
    actionType: {
        type: String,
        enum: ['ACCOUNT_CREATED', 'DATA_UPDATED', 'ACCOUNT_DELETED'],
        required: true
    },
    actionCategory: {
        type: String,
        enum: ['CREATE', 'UPDATE', 'DELETE'],
        required: true
    },
    modifiedBy: {
        userId: mongoose.Schema.Types.ObjectId,
        userName: String,
        userRole: String
    },
    changes: [{
        fieldName: String,
        fieldLabel: String,
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed,
        changeType: String
    }],
    deliveryStatus: {
        email: {
            sent: Boolean,
            sentAt: Date,
            messageId: String,
            error: String
        },
        sms: {
            sent: Boolean,
            sentAt: Date,
            messageId: String,
            error: String
        }
    },
    notificationContent: {
        emailSubject: String,
        smsMessage: String
    },
    ipAddress: String,
    userAgent: String,
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('NotificationsAlerts', notificationsAlertsSchema);