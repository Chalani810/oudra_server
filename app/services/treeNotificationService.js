// app/services/treeNotificationService.js - FIXED VERSION
require('dotenv').config();
const nodemailer = require('nodemailer');

class TreeNotificationService {
    constructor() {
        // Initialize email transporter ONLY if credentials exist
        this.transporter = null;
        this.initializeTransporter();
        
        console.log('🌲 Tree Notification Service initialized');
    }

    initializeTransporter() {
        try {
            if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
                this.transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASSWORD
                    }
                });
                console.log('✅ Email transporter configured');
            } else {
                console.warn('⚠️ Email credentials not configured - notifications will be logged only');
            }
        } catch (error) {
            console.error('❌ Failed to initialize email transporter:', error.message);
            this.transporter = null;
        }
    }

    /**
     * Main method to send tree change notifications
     */
    async sendTreeNotifications(treeData, action, changes = null, modifiedBy = {}, context = {}) {
        console.log(`🌲 Starting tree notifications for ${action} on tree: ${treeData.treeId}`);
        
        try {
            const notificationResults = {
                investorEmail: { sent: false, error: null },
                adminEmail: { sent: false, error: null },
                alertSaved: false
            };

            // 1. Save alert to database (TreeNotificationsAlerts)
            try {
                const TreeNotificationsAlerts = require('../models/TreeNotificationsAlerts');
                
                const alertData = {
                    treeId: treeData.treeId,
                    investorId: treeData.investorId,
                    investorName: treeData.investorName,
                    investorEmail: treeData.investorEmail,
                    actionType: this.mapActionType(action),
                    actionCategory: action,
                    modifiedBy: {
                        userId: modifiedBy.id || null,
                        userName: modifiedBy.name || 'System',
                        userRole: modifiedBy.role || 'ADMIN'
                    },
                    changes: changes ? this.formatChanges(changes) : [],
                    treeDetails: {
                        healthStatus: treeData.healthStatus,
                        lifecycleStatus: treeData.lifecycleStatus,
                        block: treeData.block,
                        plantedDate: treeData.plantedDate
                    },
                    deliveryStatus: {
                        email: { sent: false },
                        sms: { sent: false }
                    },
                    notificationContent: {
                        emailSubject: this.generateEmailSubject(action, treeData.treeId),
                        smsMessage: this.generateSMSMessage(action, treeData.treeId, modifiedBy.name)
                    },
                    ipAddress: context.ipAddress,
                    userAgent: context.userAgent,
                    timestamp: new Date()
                };

                const alert = new TreeNotificationsAlerts(alertData);
                await alert.save();
                notificationResults.alertSaved = true;
                console.log(`📝 Tree alert saved: ${alert._id}`);
                
                // 2. Send email to investor (if email provided and transporter available)
                if (treeData.investorEmail && this.transporter) {
                    try {
                        const emailResult = await this.sendInvestorEmail(treeData, action, changes, modifiedBy);
                        notificationResults.investorEmail = {
                            sent: emailResult.success,
                            messageId: emailResult.messageId,
                            error: emailResult.error
                        };
                        
                        // Update alert status
                        await TreeNotificationsAlerts.findByIdAndUpdate(alert._id, {
                            'deliveryStatus.email.sent': emailResult.success,
                            'deliveryStatus.email.sentAt': new Date(),
                            'deliveryStatus.email.messageId': emailResult.messageId,
                            'deliveryStatus.email.error': emailResult.error
                        });
                        
                    } catch (emailError) {
                        console.error('Investor email failed:', emailError.message);
                        notificationResults.investorEmail.error = emailError.message;
                    }
                } else if (!treeData.investorEmail) {
                    console.log('ℹ️  No investor email provided for tree', treeData.treeId);
                } else if (!this.transporter) {
                    console.log('ℹ️  Email transporter not configured - skipping email');
                }

                // 3. Send admin notifications
                if (this.transporter) {
                    try {
                        const adminResult = await this.sendAdminNotifications(treeData, action, modifiedBy, changes);
                        notificationResults.adminEmail = adminResult;
                    } catch (adminError) {
                        console.error('Admin notifications failed:', adminError.message);
                    }
                }
                
            } catch (alertError) {
                console.error('Failed to save tree alert:', alertError.message);
                // Continue even if alert save fails
            }

            console.log(`✅ Tree notification process completed for ${treeData.treeId}`);
            return {
                success: true,
                results: notificationResults,
                treeId: treeData.treeId,
                action: action
            };

        } catch (error) {
            console.error('❌ Tree notification service error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send email to investor about tree changes
     */
    async sendInvestorEmail(treeData, action, changes, modifiedBy) {
        if (!this.transporter) {
            return { success: false, error: 'Email transporter not configured' };
        }

        const subject = this.generateEmailSubject(action, treeData.treeId);
        const html = this.generateEmailHTML(treeData, action, changes, modifiedBy);

        const mailOptions = {
            from: `"Tree Management System" <${process.env.EMAIL_USER}>`,
            to: treeData.investorEmail,
            subject: subject,
            html: html,
            text: this.generateEmailText(treeData, action, changes, modifiedBy)
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Tree email sent to ${treeData.investorEmail}: ${info.messageId}`);
            return {
                success: true,
                messageId: info.messageId
            };
        } catch (error) {
            console.error(`❌ Tree email failed for ${treeData.investorEmail}:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Send notifications to admins
     */
    async sendAdminNotifications(treeData, action, modifiedBy, changes) {
        if (!this.transporter) {
            return { sent: false, reason: 'Email transporter not configured' };
        }

        const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(e => e.trim()).filter(Boolean) || [];
        
        if (adminEmails.length === 0) {
            console.log('⚠️ No admin emails configured');
            return { sent: false, reason: 'No admin emails' };
        }

        const subject = `🌲 ADMIN: Tree ${action} - ${treeData.treeId}`;
        const html = this.generateAdminEmailHTML(treeData, action, modifiedBy, changes);

        const mailOptions = {
            from: `"Tree Management Alert" <${process.env.EMAIL_USER}>`,
            to: adminEmails.join(', '),
            subject: subject,
            html: html
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`📢 Tree admin notifications sent to ${adminEmails.length} admin(s)`);
            return { sent: true, messageId: info.messageId };
        } catch (error) {
            console.error('Admin tree email failed:', error.message);
            return { sent: false, error: error.message };
        }
    }

    // Helper methods
    mapActionType(action) {
        const map = {
            'CREATE': 'TREE_CREATED',
            'UPDATE': 'TREE_UPDATED',
            'DELETE': 'TREE_DELETED',
            'HEALTH_UPDATE': 'HEALTH_STATUS_CHANGED',
            'LIFECYCLE_UPDATE': 'LIFECYCLE_CHANGED',
            'INOCULATION': 'TREE_INOCULATED',
            'INSPECTION': 'TREE_INSPECTED',
            'GPS_UPDATE': 'LOCATION_UPDATED'
        };
        return map[action] || 'TREE_UPDATED';
    }

    formatChanges(changes) {
        if (!changes || typeof changes !== 'object') return [];
        
        if (Array.isArray(changes)) return changes;
        
        return Object.entries(changes).map(([field, data]) => ({
            fieldName: field,
            fieldLabel: this.getFieldLabel(field),
            oldValue: typeof data === 'object' && data.old !== undefined ? data.old : null,
            newValue: typeof data === 'object' && data.new !== undefined ? data.new : data,
            changeType: this.determineChangeType(data)
        }));
    }

    determineChangeType(data) {
        if (typeof data === 'object' && data.old !== undefined && data.new !== undefined) {
            if (data.old === null) return 'ADDED';
            if (data.new === null) return 'REMOVED';
            return 'MODIFIED';
        }
        return 'UPDATED';
    }

    getFieldLabel(field) {
        const labels = {
            'healthStatus': 'Health Status',
            'lifecycleStatus': 'Lifecycle Status',
            'block': 'Block Location',
            'gps': 'GPS Coordinates',
            'lastInspection': 'Last Inspection',
            'inoculationCount': 'Inoculation Count',
            'investorName': 'Investor Name',
            'nfcTagId': 'NFC Tag ID'
        };
        return labels[field] || field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1');
    }

    generateEmailSubject(action, treeId) {
        const subjects = {
            'CREATE': `🌱 New Tree Added: ${treeId}`,
            'UPDATE': `🌲 Tree Update: ${treeId}`,
            'DELETE': `⚠️ Tree Removed: ${treeId}`,
            'HEALTH_UPDATE': `🏥 Health Status Changed: ${treeId}`,
            'LIFECYCLE_UPDATE': `🔄 Lifecycle Update: ${treeId}`,
            'INOCULATION': `💉 Tree Inoculated: ${treeId}`,
            'INSPECTION': `🔍 Inspection Completed: ${treeId}`,
            'GPS_UPDATE': `📍 Location Updated: ${treeId}`
        };
        return subjects[action] || `Tree Notification: ${treeId}`;
    }

    generateSMSMessage(action, treeId, modifiedBy) {
        const messages = {
            'CREATE': `New tree ${treeId} added to your portfolio by ${modifiedBy}.`,
            'UPDATE': `Your tree ${treeId} updated by ${modifiedBy}. Check email for details.`,
            'DELETE': `Tree ${treeId} removed by ${modifiedBy}. Contact support if unauthorized.`,
            'HEALTH_UPDATE': `Tree ${treeId} health status changed. Check email for details.`,
            'INOCULATION': `Tree ${treeId} has been inoculated. Growth milestone reached!`
        };
        return messages[action] || `Tree ${treeId} has been modified.`;
    }

    generateEmailHTML(treeData, action, changes, modifiedBy) {
        const timestamp = new Date().toLocaleString();
        const changesHTML = changes ? this.generateChangesHTML(changes) : '';

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5; }
                .container { background-color: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .header { background: linear-gradient(135deg, #2d5016 0%, #4a7c2a 100%); color: white; padding: 30px; text-align: center; }
                .header h2 { margin: 0; font-size: 24px; }
                .content { padding: 30px; }
                .tree-info { background-color: #f0f8f0; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #4a7c2a; }
                .changes { background-color: #fff9e6; padding: 15px; border-radius: 5px; margin: 20px 0; }
                .change-item { padding: 10px; border-bottom: 1px solid #eee; }
                .change-item:last-child { border-bottom: none; }
                .old-value { color: #dc3545; text-decoration: line-through; }
                .new-value { color: #28a745; font-weight: bold; }
                .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center; }
                .icon { font-size: 40px; margin-bottom: 10px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="icon">
                        ${action === 'CREATE' ? '🌱' : ''}
                        ${action === 'UPDATE' ? '🌲' : ''}
                        ${action === 'DELETE' ? '⚠️' : ''}
                        ${action === 'HEALTH_UPDATE' ? '🏥' : ''}
                        ${action === 'INOCULATION' ? '💉' : ''}
                        ${action === 'INSPECTION' ? '🔍' : ''}
                    </div>
                    <h2>${this.generateEmailSubject(action, treeData.treeId)}</h2>
                </div>
                
                <div class="content">
                    <p>Dear ${treeData.investorName || 'Valued Investor'},</p>
                    
                    ${this.getActionMessage(action)}
                    
                    <div class="tree-info">
                        <h3 style="color: #2d5016; margin-top: 0;">🌲 Tree Details</h3>
                        <p><strong>Tree ID:</strong> ${treeData.treeId}</p>
                        <p><strong>Block Location:</strong> ${treeData.block || 'Not specified'}</p>
                        <p><strong>Health Status:</strong> 
                            <span style="color: ${this.getHealthColor(treeData.healthStatus)}; font-weight: bold;">
                                ${treeData.healthStatus || 'Unknown'}
                            </span>
                        </p>
                        <p><strong>Lifecycle Status:</strong> ${treeData.lifecycleStatus || 'Growing'}</p>
                        ${treeData.plantedDate ? `<p><strong>Planted:</strong> ${new Date(treeData.plantedDate).toLocaleDateString()}</p>` : ''}
                        ${treeData.inoculationCount !== undefined ? `<p><strong>Inoculations:</strong> ${treeData.inoculationCount}</p>` : ''}
                    </div>
                    
                    ${changesHTML}
                    
                    <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <p style="margin: 0;"><strong>Modified By:</strong> ${modifiedBy.name || 'System Admin'} ${modifiedBy.role ? `(${modifiedBy.role})` : ''}</p>
                        <p style="margin: 10px 0 0 0;"><strong>Timestamp:</strong> ${timestamp}</p>
                    </div>
                    
                    ${treeData.blockchainHash ? `
                        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; border-left: 4px solid #2196f3;">
                            <p style="margin: 0;">🔐 <strong>Blockchain Security:</strong></p>
                            <p style="margin: 5px 0 0 0; font-size: 12px; color: #555;">This change has been permanently recorded and verified on the blockchain.</p>
                        </div>
                    ` : ''}
                    
                    <div class="footer">
                        <p>🌲 Tree Management System - Blockchain Protected</p>
                        <p>This is an automated notification. Please do not reply to this email.</p>
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    getActionMessage(action) {
        const messages = {
            'CREATE': '<p>A new tree has been added to your portfolio!</p>',
            'UPDATE': '<p>Important information about your tree has been updated.</p>',
            'DELETE': '<p><strong>Notice:</strong> A tree has been removed from your portfolio.</p>',
            'HEALTH_UPDATE': '<p>The health status of your tree has been updated.</p>',
            'INOCULATION': '<p><strong>Milestone!</strong> Your tree has been inoculated.</p>',
            'INSPECTION': '<p>A routine inspection has been completed.</p>'
        };
        return messages[action] || '<p>Your tree information has been updated.</p>';
    }

    getHealthColor(healthStatus) {
        const colors = {
            'Healthy': '#28a745',
            'Warning': '#ffc107',
            'Damaged': '#fd7e14',
            'Dead': '#dc3545'
        };
        return colors[healthStatus] || '#6c757d';
    }

    generateChangesHTML(changes) {
        if (!changes || changes.length === 0) return '';
        
        const items = changes.map(change => `
            <div class="change-item">
                <strong>${change.fieldLabel || change.fieldName}:</strong><br>
                ${change.oldValue !== null && change.oldValue !== undefined ? `<span class="old-value">${JSON.stringify(change.oldValue)}</span>` : ''}
                ${(change.oldValue !== null && change.oldValue !== undefined) && (change.newValue !== null && change.newValue !== undefined) ? ' → ' : ''}
                ${change.newValue !== null && change.newValue !== undefined ? `<span class="new-value">${JSON.stringify(change.newValue)}</span>` : ''}
            </div>
        `).join('');
        
        return `
        <div class="changes">
            <h3 style="margin-top: 0;">📊 Changes Made:</h3>
            ${items}
        </div>
        `;
    }

    generateEmailText(treeData, action, changes, modifiedBy) {
        let text = `Dear ${treeData.investorName || 'Valued Investor'},\n\n`;
        text += `Tree ${treeData.treeId} - ${action}\n\n`;
        text += `Health: ${treeData.healthStatus || 'Unknown'}\n`;
        text += `Lifecycle: ${treeData.lifecycleStatus || 'Growing'}\n`;
        text += `\nModified by: ${modifiedBy.name || 'System'}\n`;
        return text;
    }

    generateAdminEmailHTML(treeData, action, modifiedBy, changes) {
        return `
        <html>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #FF9800;">🌲 ADMIN ALERT: Tree ${action}</h2>
            <div style="background-color: #fff3e0; padding: 15px; border-radius: 5px;">
                <p><strong>Tree ID:</strong> ${treeData.treeId}</p>
                <p><strong>Investor:</strong> ${treeData.investorName}</p>
                <p><strong>Action:</strong> ${action}</p>
                <p><strong>By:</strong> ${modifiedBy.name} (${modifiedBy.role})</p>
            </div>
        </body>
        </html>
        `;
    }
}

// Export class, NOT instance
module.exports = TreeNotificationService;