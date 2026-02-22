/**
 * Security middleware for Smart Campus API
 * - MongoDB operator injection prevention
 * - Prototype pollution prevention (__proto__, constructor, prototype)
 */
const mongoSanitize = require('express-mongo-sanitize');

const sanitize = mongoSanitize({ replaceWith: '_' });

const forbiddenKeys = ['__proto__', 'constructor', 'prototype'];
function hasForbiddenKey(obj) {
    if (obj === null || typeof obj !== 'object') return false;
    for (const key of Object.keys(obj)) {
        if (forbiddenKeys.includes(key)) return true;
        if (hasForbiddenKey(obj[key])) return true;
    }
    return false;
}

function noPrototypePollution(req, res, next) {
    if ((req.body && hasForbiddenKey(req.body)) || (req.query && hasForbiddenKey(req.query))) {
        return res.status(400).json({ success: false, message: 'Invalid request' });
    }
    next();
}

module.exports = { sanitize, noPrototypePollution };
