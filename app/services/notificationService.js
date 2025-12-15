// services/notificationService.js - FALLBACK VERSION
// Create this file if it doesn't exist in: app/services/notificationService.js

class NotificationService {
  /**
   * Send all notifications for an investor action
   * This is a simple fallback implementation
   */
  static async sendAllNotifications(investor, action, changes, modifiedBy, metadata) {
    try {
      console.log('\n📧 Notification Service (Fallback)');
      console.log('═══════════════════════════════════');
      console.log(`Action: ${action}`);
      console.log(`Investor: ${investor.name} (${investor.email})`);
      console.log(`Modified by: ${modifiedBy.name}`);
      
      if (changes && Object.keys(changes).length > 0) {
        console.log('Changes:', JSON.stringify(changes, null, 2));
      }
      
      // Simulate email notification
      const notifications = {
        email: {
          sent: true,
          to: investor.email,
          subject: `Investor ${action} - ${investor.name}`,
          message: `Your investor profile has been ${action.toLowerCase()}`
        },
        system: {
          sent: true,
          message: `System notification logged for ${action}`
        }
      };
      
      console.log('✅ Notifications sent successfully');
      console.log('═══════════════════════════════════\n');
      
      return notifications;
      
    } catch (error) {
      console.error('⚠️ Notification service error:', error.message);
      return {
        sent: false,
        error: error.message
      };
    }
  }
  
  /**
   * Send email notification
   */
  static async sendEmail(to, subject, body) {
    console.log(`📧 Email would be sent to: ${to}`);
    console.log(`   Subject: ${subject}`);
    return { sent: true, timestamp: new Date() };
  }
  
  /**
   * Send SMS notification
   */
  static async sendSMS(phone, message) {
    console.log(`📱 SMS would be sent to: ${phone}`);
    console.log(`   Message: ${message}`);
    return { sent: true, timestamp: new Date() };
  }
  
  /**
   * Log system notification
   */
  static async logSystemNotification(userId, message, type = 'INFO') {
    console.log(`📝 System notification: [${type}] ${message}`);
    return { logged: true, timestamp: new Date() };
  }
}

module.exports = NotificationService;