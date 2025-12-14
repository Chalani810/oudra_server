// services/notificationService.js (Simplified Version)
require('dotenv').config();
const nodemailer = require('nodemailer');

class NotificationService {
    constructor() {
        // Initialize email transporter
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
        
        console.log('🔔 Notification Service initialized');
    }

    // Main method to send all notifications
    async sendAllNotifications(investor, action, changes = null, modifiedBy = {}, context = {}) {
        console.log(`📧 Starting notifications for ${action} on investor: ${investor.email}`);
        
        try {
            const notificationResults = {
                email: { sent: false, error: null },
                sms: { sent: false, error: null },
                alertSaved: false
            };

            // 1. Save alert to database (NotificationsAlerts)
            try {
                const NotificationsAlerts = require('../models/NotificationsAlerts');
                
                const alertData = {
                    investorId: investor._id,
                    investorName: investor.name,
                    investorEmail: investor.email,
                    investorPhone: investor.phone,
                    actionType: this.mapActionType(action),
                    actionCategory: action,
                    modifiedBy: {
                        userId: modifiedBy.id || null,
                        userName: modifiedBy.name || 'System',
                        userRole: modifiedBy.role || 'ADMIN'
                    },
                    changes: changes ? this.formatChanges(changes) : [],
                    deliveryStatus: {
                        email: { sent: false },
                        sms: { sent: false }
                    },
                    notificationContent: {
                        emailSubject: this.generateEmailSubject(action, investor.name),
                        smsMessage: this.generateSMSMessage(action, investor.name, modifiedBy.name)
                    },
                    ipAddress: context.ipAddress,
                    userAgent: context.userAgent
                };

                const alert = new NotificationsAlerts(alertData);
                await alert.save();
                notificationResults.alertSaved = true;
                console.log(`📝 Alert saved: ${alert._id}`);
                
            } catch (alertError) {
                console.error('Failed to save alert:', alertError.message);
            }

            // 2. Send email to investor
            try {
                const emailResult = await this.sendInvestorEmail(investor, action, changes, modifiedBy);
                notificationResults.email = {
                    sent: emailResult.success,
                    messageId: emailResult.messageId,
                    error: emailResult.error
                };
                
                // Update alert status if saved
                if (notificationResults.alertSaved) {
                    await NotificationsAlerts.findByIdAndUpdate(alert._id, {
                        'deliveryStatus.email.sent': emailResult.success,
                        'deliveryStatus.email.sentAt': new Date(),
                        'deliveryStatus.email.messageId': emailResult.messageId,
                        'deliveryStatus.email.error': emailResult.error
                    });
                }
                
            } catch (emailError) {
                console.error('Email sending failed:', emailError.message);
                notificationResults.email.error = emailError.message;
            }

            // 3. Send admin notifications
            try {
                await this.sendAdminNotifications(investor, action, modifiedBy, changes);
            } catch (adminError) {
                console.error('Admin notifications failed:', adminError.message);
            }

            console.log(`✅ Notification process completed for ${investor.email}`);
            return {
                success: true,
                results: notificationResults,
                investor: investor.email,
                action: action
            };

        } catch (error) {
            console.error('❌ Notification service error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Send email to investor
    async sendInvestorEmail(investor, action, changes, modifiedBy) {
        const subject = this.generateEmailSubject(action, investor.name);
        const html = this.generateEmailHTML(investor, action, changes, modifiedBy);

        const mailOptions = {
            from: `"Secure Investor System" <${process.env.EMAIL_USER}>`,
            to: investor.email,
            subject: subject,
            html: html,
            text: this.generateEmailText(investor, action, changes, modifiedBy)
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`✅ Email sent to ${investor.email}: ${info.messageId}`);
            return {
                success: true,
                messageId: info.messageId
            };
        } catch (error) {
            console.error(`❌ Email failed for ${investor.email}:`, error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Send notifications to admins
    async sendAdminNotifications(investor, action, modifiedBy, changes) {
        const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
        
        if (adminEmails.length === 0) {
            console.log('⚠️ No admin emails configured');
            return;
        }

        const subject = `🔔 ADMIN: Investor ${action} - ${investor.name}`;
        const html = this.generateAdminEmailHTML(investor, action, modifiedBy, changes);

        const mailOptions = {
            from: `"System Alert" <${process.env.EMAIL_USER}>`,
            to: adminEmails.join(', '),
            subject: subject,
            html: html
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`📢 Admin notifications sent to ${adminEmails.length} admin(s)`);
        } catch (error) {
            console.error('Admin email failed:', error.message);
        }
    }

    // Helper methods
    mapActionType(action) {
        const map = {
            'CREATE': 'ACCOUNT_CREATED',
            'UPDATE': 'DATA_UPDATED',
            'DELETE': 'ACCOUNT_DELETED'
        };
        return map[action] || 'DATA_UPDATED';
    }

    formatChanges(changes) {
        return Object.entries(changes).map(([field, data]) => ({
            fieldName: field,
            fieldLabel: this.getFieldLabel(field),
            oldValue: data.old,
            newValue: data.new,
            changeType: data.old === null ? 'ADDED' : data.new === null ? 'REMOVED' : 'MODIFIED'
        }));
    }

    getFieldLabel(field) {
        const labels = {
            'name': 'Full Name',
            'email': 'Email Address',
            'phone': 'Phone Number',
            'investment': 'Investment Amount',
            'status': 'Account Status'
        };
        return labels[field] || field.charAt(0).toUpperCase() + field.slice(1);
    }

    generateEmailSubject(action, investorName) {
        const subjects = {
            'CREATE': `🎉 Welcome ${investorName}! Your Investor Account Created`,
            'UPDATE': `🔔 Important: Your Account Details Updated`,
            'DELETE': `⚠️ Account Deletion Notice`
        };
        return subjects[action] || 'Account Notification';
    }

    generateSMSMessage(action, investorName, modifiedBy) {
        const messages = {
            'CREATE': `Hi ${investorName}, your investor account created by ${modifiedBy}. Welcome!`,
            'UPDATE': `Hi ${investorName}, your account updated by ${modifiedBy}. Check email for details.`,
            'DELETE': `Hi ${investorName}, your investor account deleted by ${modifiedBy}. Contact support if unauthorized.`
        };
        return messages[action] || 'Your account has been modified.';
    }

    generateEmailHTML(investor, action, changes, modifiedBy) {
        const timestamp = new Date().toLocaleString();
        const changesHTML = changes ? this.generateChangesHTML(changes) : '';

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #4CAF50; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
                .content { padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
                .changes { background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; }
                .footer { margin-top: 20px; font-size: 12px; color: #666; }
                .action-icon { font-size: 24px; margin-right: 10px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>
                    ${action === 'CREATE' ? '🎉 Account Created' : ''}
                    ${action === 'UPDATE' ? '🔔 Account Updated' : ''}
                    ${action === 'DELETE' ? '⚠️ Account Deleted' : ''}
                </h2>
            </div>
            <div class="content">
                <p>Dear ${investor.name},</p>
                
                ${action === 'CREATE' ? '<p>Your investor account has been successfully created in our secure system.</p>' : ''}
                ${action === 'UPDATE' ? '<p>Your investor account has been updated in our secure system.</p>' : ''}
                ${action === 'DELETE' ? '<p>Your investor account has been deleted from our system.</p>' : ''}
                
                ${changesHTML}
                
                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <h3>Account Details:</h3>
                    <p><strong>Name:</strong> ${investor.name}</p>
                    <p><strong>Email:</strong> ${investor.email}</p>
                    <p><strong>Phone:</strong> ${investor.phone}</p>
                    ${action !== 'DELETE' ? `<p><strong>Investment:</strong> $${investor.investment?.toLocaleString() || '0'}</p>` : ''}
                </div>
                
                <p><strong>Action Performed By:</strong> ${modifiedBy.name || 'System Admin'}</p>
                <p><strong>Time:</strong> ${timestamp}</p>
                ${investor.blockchainHash ? `<p><strong>Blockchain Record:</strong> Created and verified</p>` : ''}
                
                <div class="footer">
                    <p>This is an automated notification from the Secure Investor System.</p>
                    <p>Your data is protected using blockchain technology for maximum security.</p>
                    <p>If you did not authorize this action, please contact support immediately.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    generateChangesHTML(changes) {
        if (Object.keys(changes).length === 0) return '';
        
        const items = Object.entries(changes).map(([field, data]) => `
            <li><strong>${this.getFieldLabel(field)}:</strong> 
                ${data.old !== null ? `<span style="color: #dc3545; text-decoration: line-through;">${data.old}</span>` : ''}
                ${data.old !== null && data.new !== null ? ' → ' : ''}
                ${data.new !== null ? `<span style="color: #28a745; font-weight: bold;">${data.new}</span>` : ''}
            </li>
        `).join('');
        
        return `
        <div class="changes">
            <h3>📊 Changes Made:</h3>
            <ul>${items}</ul>
        </div>
        `;
    }

    generateEmailText(investor, action, changes, modifiedBy) {
        const timestamp = new Date().toLocaleString();
        let text = `Dear ${investor.name},\n\n`;
        
        if (action === 'CREATE') text += 'Your investor account has been successfully created.\n\n';
        if (action === 'UPDATE') text += 'Your investor account has been updated.\n\n';
        if (action === 'DELETE') text += 'Your investor account has been deleted.\n\n';
        
        if (changes && Object.keys(changes).length > 0) {
            text += 'Changes made:\n';
            Object.entries(changes).forEach(([field, data]) => {
                text += `${this.getFieldLabel(field)}: ${data.old} → ${data.new}\n`;
            });
            text += '\n';
        }
        
        text += `Account Details:\n`;
        text += `Name: ${investor.name}\n`;
        text += `Email: ${investor.email}\n`;
        text += `Phone: ${investor.phone}\n`;
        if (action !== 'DELETE') text += `Investment: $${investor.investment?.toLocaleString() || '0'}\n`;
        
        text += `\nAction by: ${modifiedBy.name || 'System Admin'}\n`;
        text += `Time: ${timestamp}\n`;
        
        if (investor.blockchainHash) {
            text += `\nThis action has been recorded on the blockchain for security.\n`;
        }
        
        text += `\n---\nSecure Investor System\nThis is an automated notification.`;
        
        return text;
    }

    generateAdminEmailHTML(investor, action, modifiedBy, changes) {
        const timestamp = new Date().toLocaleString();
        const changesHTML = changes ? this.generateChangesHTML(changes) : '';
        
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #FF9800; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
                .content { padding: 20px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 5px 5px; }
                .investor-info { background-color: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="header">
                <h2>🔔 ADMIN ALERT: Investor ${action}</h2>
            </div>
            <div class="content">
                <div class="investor-info">
                    <h3>Investor Details:</h3>
                    <p><strong>Name:</strong> ${investor.name}</p>
                    <p><strong>Email:</strong> ${investor.email}</p>
                    <p><strong>Phone:</strong> ${investor.phone}</p>
                    <p><strong>Investor ID:</strong> ${investor._id}</p>
                    <p><strong>Action:</strong> ${action}</p>
                    <p><strong>Performed By:</strong> ${modifiedBy.name} (${modifiedBy.role})</p>
                    <p><strong>Time:</strong> ${timestamp}</p>
                </div>
                
                ${changesHTML}
                
                <p>This action has been recorded in the blockchain ledger.</p>
                
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee;">
                    <p><small>System: Secure Investor Blockchain</small></p>
                    <p><small>Timestamp: ${new Date().toISOString()}</small></p>
                </div>
            </div>
        </body>
        </html>
        `;
    }
}

// Create and export singleton instance
module.exports = new NotificationService();