const Notification = require('../models/Notification');

/**
 * Create in-app notification for a user (or multiple users).
 * @param {Object} options
 * @param {string} options.title - Notification title
 * @param {string} [options.body] - Optional body text
 * @param {string} [options.type] - notice|fee|attendance|result|event|approval|system|info
 * @param {string} [options.link] - Optional deep link or URL
 * @param {Object} [options.data] - Optional payload
 * @param {string} [options.schoolCode] - School code
 * @param {ObjectId|ObjectId[]} options.recipients - Single user id or array of user ids
 */
async function createNotification({ title, body, type = 'info', link, data, schoolCode, recipients }) {
    const recs = Array.isArray(recipients) ? recipients : [recipients];
    if (!title || recs.length === 0) return;
    const docs = recs.map(recipient => ({
        recipient,
        title,
        body: body || '',
        type,
        link: link || '',
        data: data || {},
        schoolCode: schoolCode || null
    }));
    try {
        await Notification.insertMany(docs);
    } catch (err) {
        console.error('Create notification error:', err);
    }
}

module.exports = { createNotification };
