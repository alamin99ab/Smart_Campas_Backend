/**
 * 📝 Notification Utility
 * Creates notifications for users
 */

const Notification = require('../models/Notification');

/**
 * Create a notification for a user
 * @param {Object} options - Notification options
 * @param {string} options.recipient - Recipient user ID
 * @param {string} options.title - Notification title
 * @param {string} options.message - Notification message
 * @param {string} options.type - Notification type (info, warning, success, error)
 * @param {string} options.category - Notification category
 * @param {Object} options.data - Additional data
 * @returns {Promise<Object>} Created notification
 */
const createNotification = async ({
    recipient,
    title,
    message,
    type = 'info',
    category = 'general',
    data = {}
}) => {
    try {
        const notification = new Notification({
            recipient,
            title,
            message,
            type,
            category,
            data,
            read: false
        });

        await notification.save();
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error.message);
        // Don't throw - notification failure shouldn't break the main flow
        return null;
    }
};

/**
 * Create multiple notifications for multiple recipients
 * @param {Array} notifications - Array of notification objects
 */
const createBulkNotifications = async (notifications) => {
    try {
        if (!notifications || notifications.length === 0) return [];

        const notificationDocs = notifications.map(n => ({
            recipient: n.recipient,
            title: n.title,
            message: n.message,
            type: n.type || 'info',
            category: n.category || 'general',
            data: n.data || {},
            read: false
        }));

        return await Notification.insertMany(notificationDocs);
    } catch (error) {
        console.error('Error creating bulk notifications:', error.message);
        return [];
    }
};

module.exports = {
    createNotification,
    createBulkNotifications
};
