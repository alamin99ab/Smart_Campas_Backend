/**
 * Notification utility
 * Supports both new object payload and legacy positional signature.
 */

const Notification = require('../models/Notification');

const ALLOWED_TYPES = new Set(['notice', 'fee', 'attendance', 'result', 'event', 'approval', 'system', 'info']);

const normalizeType = (type) => {
    const raw = String(type || '').trim().toLowerCase();
    if (!raw) return 'info';
    if (ALLOWED_TYPES.has(raw)) return raw;
    if (raw.includes('fee') || raw.includes('payment')) return 'fee';
    if (raw.includes('attendance')) return 'attendance';
    if (raw.includes('result') || raw.includes('exam')) return 'result';
    if (raw.includes('notice')) return 'notice';
    if (raw.includes('event')) return 'event';
    if (raw.includes('approval')) return 'approval';
    return 'system';
};

const normalizeSingle = (payload) => {
    const title = String(payload?.title || payload?.subject || '').trim() || 'Notification';
    const body = String(payload?.body || payload?.message || payload?.description || '').trim();

    return {
        recipient: payload?.recipient,
        title,
        body,
        type: normalizeType(payload?.type),
        link: payload?.link || null,
        data: payload?.data || {},
        schoolId: payload?.schoolId || null,
        schoolCode: payload?.schoolCode || null,
        read: payload?.read === true,
        readAt: payload?.readAt || null
    };
};

const normalizePayload = (...args) => {
    // New signature: createNotification({ ... })
    if (args.length === 1 && args[0] && typeof args[0] === 'object' && !Array.isArray(args[0])) {
        const payload = args[0];
        const recipients = Array.isArray(payload.recipients) ? payload.recipients.filter(Boolean) : [];

        if (recipients.length > 0) {
            return recipients.map((recipient) => normalizeSingle({ ...payload, recipient }));
        }

        return [normalizeSingle(payload)];
    }

    // Legacy signature: createNotification(recipient, type, { title, message }, schoolCode)
    const [recipient, type, content, schoolCode] = args;
    const payload = {
        recipient,
        type,
        title: content?.title,
        body: content?.body || content?.message,
        data: content?.data || {},
        schoolCode
    };
    return [normalizeSingle(payload)];
};

/**
 * Create notification(s).
 * @returns {Promise<Object|Object[]|null>} One doc, many docs, or null on failure.
 */
const createNotification = async (...args) => {
    try {
        const rows = normalizePayload(...args).filter((row) => row.recipient);
        if (!rows.length) return null;

        if (rows.length === 1) {
            return await Notification.create(rows[0]);
        }

        return await Notification.insertMany(rows, { ordered: false });
    } catch (error) {
        console.error('Error creating notification:', error.message);
        return null;
    }
};

/**
 * Create multiple notifications from an array of payloads.
 */
const createBulkNotifications = async (notifications) => {
    try {
        if (!Array.isArray(notifications) || notifications.length === 0) return [];

        const rows = notifications
            .flatMap((payload) => normalizePayload(payload))
            .filter((row) => row.recipient);

        if (!rows.length) return [];

        return await Notification.insertMany(rows, { ordered: false });
    } catch (error) {
        console.error('Error creating bulk notifications:', error.message);
        return [];
    }
};

module.exports = { createNotification, createBulkNotifications };
