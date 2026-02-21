// services/smsService.js
const twilio = require('twilio');

class SMSService {
    constructor() {
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
            this.client = twilio(
                process.env.TWILIO_ACCOUNT_SID,
                process.env.TWILIO_AUTH_TOKEN
            );
            this.enabled = true;
        } else {
            this.enabled = false;
            console.warn('⚠️ Twilio credentials not found. SMS notifications disabled.');
        }
    }

    // Send SMS to investor
    async sendInvestorSMS(phone, investorName, action, modifiedBy = 'System') {
        if (!this.enabled || !phone) return false;

        let message;
        const timestamp = new Date().toLocaleTimeString();

        switch (action) {
            case 'CREATE':
                message = `✅ Hi ${investorName}, your investor account created by ${modifiedBy} at ${timestamp}. Welcome!`;
                break;
            case 'UPDATE':
                message = `🔔 Hi ${investorName}, your account updated by ${modifiedBy} at ${timestamp}. Check email for details.`;
                break;
            case 'DELETE':
                message = `⚠️ Hi ${investorName}, your investor account deleted by ${modifiedBy} at ${timestamp}. Contact support if unauthorized.`;
                break;
            default:
                message = `ℹ️ Hi ${investorName}, your investor account modified by ${modifiedBy}.`;
        }

        try {
            // Format phone number (Sri Lanka: +94XXXXXXXXX)
            const formattedPhone = this.formatPhoneNumber(phone);
            
            const response = await this.client.messages.create({
                body: message,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: formattedPhone
            });

            console.log(`✅ SMS sent to ${formattedPhone}: ${response.sid}`);
            return true;
        } catch (error) {
            console.error('❌ SMS sending failed:', error.message);
            return false;
        }
    }

    // Send SMS to admin
    async sendAdminSMS(adminPhone, investorName, action, modifiedBy) {
        if (!this.enabled || !adminPhone) return false;

        const message = `🔔 ADMIN: Investor ${investorName} ${action.toLowerCase()} by ${modifiedBy} at ${new Date().toLocaleTimeString()}`;

        try {
            const response = await this.client.messages.create({
                body: message,
                from: process.env.TWILIO_PHONE_NUMBER,
                to: this.formatPhoneNumber(adminPhone)
            });

            return true;
        } catch (error) {
            console.error('Admin SMS failed:', error);
            return false;
        }
    }

    // Format Sri Lankan phone numbers
    formatPhoneNumber(phone) {
        // Remove all non-digit characters
        const digits = phone.replace(/\D/g, '');
        
        // If number starts with 0, replace with +94
        if (digits.startsWith('0')) {
            return '+94' + digits.substring(1);
        }
        
        // If number doesn't have country code, add +94
        if (digits.length === 9) {
            return '+94' + digits;
        }
        
        // If already has +94, return as is
        if (digits.startsWith('94')) {
            return '+' + digits;
        }
        
        return phone;
    }
}

module.exports = new SMSService(); 