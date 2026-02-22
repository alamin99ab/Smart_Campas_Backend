const rateLimit = require('express-rate-limit');

// General API limiter
exports.apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Auth routes limiter (stricter)
exports.authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    skipSuccessfulRequests: true,
    message: { message: 'Too many authentication attempts, try again later.' }
});

// Login specific limiter
exports.loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // 10 login attempts per 15 minutes per IP
    skipSuccessfulRequests: true,
    message: { message: 'Too many authentication attempts, try again later.' }
});

// Registration limiter
exports.registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 registrations per hour per IP
    message: { message: 'Too many registrations from this IP.' }
});