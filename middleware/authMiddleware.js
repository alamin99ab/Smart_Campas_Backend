// middleware/authMiddleware.js
// MODIFIED: Added Mock Database support with dynamic checking
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Validate JWT configuration at startup
const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    
    // In production, JWT_SECRET is required and validated before server starts
    // This is an additional safety check
    if (process.env.NODE_ENV === 'production') {
        if (!secret) {
            throw new Error('JWT_SECRET environment variable is required in production');
        }
        if (secret.includes('your_') || secret.length < 32) {
            throw new Error('JWT_SECRET must be a strong value (min 32 characters, no placeholder values) in production');
        }
    }
    
    // Development fallback - only used when NODE_ENV is not production
    if (!secret) {
        console.warn('⚠️  WARNING: Using development JWT_SECRET. Set JWT_SECRET in .env for production.');
        return 'dev_secret_key_32_chars_minimum_for_development_only';
    }
    
    return secret;
};

const protect = async (req, res, next) => {
    let token;

    // Check token in headers or cookies
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.token) {
        token = req.cookies.token;
    }

    if (!token) {
        return res.status(401).json({ success: false, message: 'Not authorized, no token' });
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret());
        
        // Get User from MongoDB
        const User = require('../models/User');
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }
        if (user.isActive === false) {
            return res.status(401).json({ success: false, message: 'Account is deactivated' });
        }

        // Remove password from user object before attaching to req
        // Convert to plain object to avoid Mongoose document issues
        const userObj = user.toObject ? user.toObject() : user;
        const { password, ...userWithoutPassword } = userObj;
        req.user = userWithoutPassword;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error.message);
        return res.status(401).json({ success: false, message: 'Not authorized, token invalid or expired' });
    }
};

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'Access denied. Insufficient permissions.'
            });
        }
        next();
    };
};

module.exports = { protect, authorize };