let admin = null;
let messaging = null;

try {
    admin = require('firebase-admin');
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        messaging = admin.messaging();
    }
} catch (error) {
    // Firebase not configured or not available
}

exports.sendPushNotification = async ({ tokens, title, body, data = {} }) => {
    if (!messaging) {
        return { success: false, simulated: true };
    }
    try {
        const message = {
            notification: { title, body },
            data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
            tokens: Array.isArray(tokens) ? tokens : [tokens]
        };
        const response = await messaging.sendEachForMulticast(message);
        return { success: true, response };
    } catch (error) {
        console.error('Push notification error:', error);
        return { success: false, error: error.message };
    }
};