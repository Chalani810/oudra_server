// services/emailService.js
const nodemailer = require('nodemailer');

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail', // or your email provider
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }

    // Send email to investor
    async sendInvestorAlert(investor, action, changes = null, modifiedBy = 'System') {
        let subject, html;
        const timestamp = new Date().toLocaleString();

        switch (action) {
            case 'CREATE':
                subject = '🎉 Your Investor Account Has Been Created';
                html = this.getCreationEmail(investor, timestamp, modifiedBy);
                break;
            case 'UPDATE':
                subject = '📝 Your Investor Account Has Been Updated';
                html = this.getUpdateEmail(investor, changes, timestamp, modifiedBy);
                break;
            case 'DELETE':
                subject = '⚠️ Your Investor Account Has Been Deleted';
                html = this.getDeletionEmail(investor, timestamp, modifiedBy);
                break;
        }

        const mailOptions = {
            from: `"Secure Investor System" <${process.env.EMAIL_USER}>`,
            to: investor.email,
            subject: subject,
            html: html
        };

        try {
            await this.transporter.sendMail(mailOptions);
            console.log(`✅ Email sent to ${investor.email}`);
            return true;
        } catch (error) {
            console.error('❌ Email sending failed:', error);
            return false;
        }
    }

    // Send notification to admin
    async sendAdminAlert(action, investor, modifiedBy, changes = null) {
        const mailOptions = {
            from: `"System Alert" <${process.env.EMAIL_USER}>`,
            to: process.env.ADMIN_EMAILS, // comma-separated emails
            subject: `🔔 Investor ${action} Alert`,
            html: this.getAdminAlertHTML(action, investor, modifiedBy, changes)
        };

        try {
            await this.transporter.sendMail(mailOptions);
            return true;
        } catch (error) {
            console.error('Admin email failed:', error);
            return false;
        }
    }

    // Email templates
    getCreationEmail(investor, timestamp, modifiedBy) {
        return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #4CAF50;">✅ Account Created Successfully</h2>
            <p>Dear ${investor.name},</p>
            <p>Your investor account has been created in our secure system.</p>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3>Account Details:</h3>
                <p><strong>Name:</strong> ${investor.name}</p>
                <p><strong>Email:</strong> ${investor.email}</p>
                <p><strong>Investment Amount:</strong> $${investor.investment.toLocaleString()}</p>
                <p><strong>Account ID:</strong> ${investor._id}</p>
            </div>
            
            <p><strong>Created By:</strong> ${modifiedBy}</p>
            <p><strong>Time:</strong> ${timestamp}</p>
            
            <hr>
            <p style="color: #666; font-size: 12px;">
                This is an automated message. Please do not reply to this email.<br>
                Your data is secured using blockchain technology.
            </p>
        </div>
        `;
    }

    getUpdateEmail(investor, changes, timestamp, modifiedBy) {
        let changesHTML = '';
        if (changes) {
            changesHTML = `
            <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3>📊 Changes Made:</h3>
                <ul>
                    ${Object.entries(changes).map(([field, values]) => `
                        <li><strong>${field}:</strong> ${values.old} → ${values.new}</li>
                    `).join('')}
                </ul>
            </div>
            `;
        }

        return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2196F3;">🔔 Account Updated</h2>
            <p>Dear ${investor.name},</p>
            <p>Your investor account has been updated in our secure system.</p>
            
            ${changesHTML}
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3>Current Account Details:</h3>
                <p><strong>Name:</strong> ${investor.name}</p>
                <p><strong>Email:</strong> ${investor.email}</p>
                <p><strong>Investment Amount:</strong> $${investor.investment.toLocaleString()}</p>
                <p><strong>Phone:</strong> ${investor.phone}</p>
            </div>
            
            <p><strong>Modified By:</strong> ${modifiedBy}</p>
            <p><strong>Time:</strong> ${timestamp}</p>
            <p><strong>Blockchain Hash:</strong> <small>${investor.blockchainHash || 'Pending'}</small></p>
            
            <hr>
            <p style="color: #666; font-size: 12px;">
                This update has been recorded in our immutable blockchain ledger.<br>
                If you did not authorize this change, please contact support immediately.
            </p>
        </div>
        `;
    }

    getDeletionEmail(investor, timestamp, modifiedBy) {
        return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #f44336;">⚠️ Account Deleted</h2>
            <p>Dear ${investor.name},</p>
            <p>Your investor account has been deleted from our system.</p>
            
            <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3>Deleted Account Details:</h3>
                <p><strong>Name:</strong> ${investor.name}</p>
                <p><strong>Email:</strong> ${investor.email}</p>
                <p><strong>Last Investment:</strong> $${investor.investment.toLocaleString()}</p>
                <p><strong>Deleted Time:</strong> ${timestamp}</p>
            </div>
            
            <p><strong>Deleted By:</strong> ${modifiedBy}</p>
            
            <hr>
            <p style="color: #666; font-size: 12px;">
                Note: A permanent record of this deletion exists in our blockchain.<br>
                For any inquiries, please contact our support team.
            </p>
        </div>
        `;
    }

    getAdminAlertHTML(action, investor, modifiedBy, changes) {
        return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #FF9800;">🔔 ADMIN ALERT: Investor ${action}</h2>
            
            <div style="background-color: #fff3e0; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h3>Investor Details:</h3>
                <p><strong>Name:</strong> ${investor.name}</p>
                <p><strong>ID:</strong> ${investor._id}</p>
                <p><strong>Action:</strong> ${action}</p>
                <p><strong>Modified By:</strong> ${modifiedBy}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                
                ${changes ? `
                <h4>Changes Made:</h4>
                <ul>
                    ${Object.entries(changes).map(([field, values]) => `
                        <li><strong>${field}:</strong> ${values.old} → ${values.new}</li>
                    `).join('')}
                </ul>
                ` : ''}
            </div>
            
            <p>This action has been recorded in the blockchain ledger.</p>
        </div>
        `;
    }
}

module.exports = new EmailService();