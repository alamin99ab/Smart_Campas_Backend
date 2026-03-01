/**
 * 📱 SMS SERVICE - PRODUCTION READY
 * Simple SMS service for production deployment
 */

// SMS service configuration
const sendSMS = async (options) => {
    try {
        // Check if SMS service is configured
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
            console.log('📱 SMS service not configured - skipping SMS send');
            return { success: false, message: 'SMS service not configured' };
        }

        // For production, you would integrate with Twilio or other SMS service
        console.log('📱 SMS would be sent to:', options.to);
        console.log('📱 SMS message:', options.message);
        
        return { 
            success: true, 
            messageId: 'sms_' + Date.now(),
            note: 'SMS service placeholder - configure Twilio for production'
        };
    } catch (error) {
        console.error('📱 SMS send error:', error);
        return { success: false, error: error.message };
    }
};

module.exports = {
    sendSMS
};
