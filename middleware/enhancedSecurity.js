/**
 * 🔒 ENHANCED SECURITY MIDDLEWARE
 * Comprehensive security protection for Smart Campus SaaS
 */

const validator = require('validator');
const xss = require('xss');

/**
 * Sanitize input data to prevent XSS and injection attacks
 */
const sanitizeInput = (data) => {
    if (!data) return data;
    
    if (typeof data === 'string') {
        return xss(data.trim());
    }
    
    if (typeof data === 'object') {
        const sanitized = {};
        for (const key in data) {
            if (typeof data[key] === 'string') {
                sanitized[key] = xss(validator.escape(data[key].trim()));
            } else if (Array.isArray(data[key])) {
                sanitized[key] = data[key].map(item => 
                    typeof item === 'string' ? xss(validator.escape(item.trim())) : item
                );
            } else {
                sanitized[key] = data[key];
            }
        }
        return sanitized;
    }
    
    return data;
};

/**
 * Validate email format
 */
const validateEmail = (email) => {
    return validator.isEmail(email) ? email : false;
};

/**
 * Validate password strength
 */
const validatePassword = (password) => {
    if (!password || password.length < 6) {
        return { valid: false, message: 'Password must be at least 6 characters' };
    }
    
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
        return { valid: false, message: 'Password must contain uppercase, lowercase, and numbers' };
    }
    
    return { valid: true, message: 'Password is strong' };
};

/**
 * Enhanced security middleware
 */
const enhancedSecurity = (req, res, next) => {
    try {
        // Sanitize all incoming data
        if (req.body) {
            req.body = sanitizeInput(req.body);
        }
        
        if (req.query) {
            req.query = sanitizeInput(req.query);
        }
        
        if (req.params) {
            req.params = sanitizeInput(req.params);
        }
        
        // Add security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
        
        next();
    } catch (error) {
        console.error('Security middleware error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Security validation failed' 
        });
    }
};

module.exports = {
    enhancedSecurity,
    sanitizeInput,
    validateEmail,
    validatePassword
};
