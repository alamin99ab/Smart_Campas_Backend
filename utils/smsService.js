let twilioClient = null;
try {
    const twilio = require('twilio');
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (accountSid && accountSid.startsWith('AC') && authToken) {
        twilioClient = twilio(accountSid, authToken);
    }
} catch (_) {}

exports.sendSMS = async ({ to, message }) => {
    if (!twilioClient) {
        return { success: false, simulated: true };
    }
    try {
        const result = await twilioClient.messages.create({
            body: message,
            to,
            from: process.env.TWILIO_PHONE_NUMBER
        });
        return { success: true, sid: result.sid };
    } catch (error) {
        console.error('Failed to send SMS:', error.message);
        return { success: false, error: error.message };
    }
};