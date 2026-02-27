
/**
 * 🔒 ENHANCED SECURITY MIDDLEWARE
 * Comprehensive security features for API protection
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// Rate limiting configurations
const rateLimiters = {
    general: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        message: {
            success: false,
            message: 'Too many requests from this IP, please try again later',
            retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false
    }),
    
    auth: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // limit each IP to 5 auth requests per windowMs
        message: {
            success: false,
            message: 'Too many authentication attempts, please try again later',
            retryAfter: '15 minutes'
        },
        skipSuccessfulRequests: true
    }),
    
    upload: rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10, // limit each IP to 10 uploads per hour
        message: {
            success: false,
            message: 'Too many upload attempts, please try again later',
            retryAfter: '1 hour'
        }
    })
};

// Security headers configuration
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
});

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
    // Sanitize request body
    if (req.body) {
        req.body = mongoSanitize(req.body);
        req.body = xss(req.body);
    }
    
    // Sanitize query parameters
    if (req.query) {
        req.query = mongoSanitize(req.query);
        req.query = xss(req.query);
    }
    
    // Sanitize URL parameters
    if (req.params) {
        req.params = mongoSanitize(req.params);
        req.params = xss(req.params);
    }
    
    next();
};

// CORS configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com'] 
        : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    optionsSuccessStatus: 200
};

module.exports = {
    rateLimiters,
    securityHeaders,
    sanitizeInput,
    corsOptions
};
