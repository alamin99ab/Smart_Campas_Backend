// middleware/authMiddleware.js
// MODIFIED: Added Mock Database support
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

// Determine if we should use mock database
const useMockDB = mongoose.connection.readyState !== 1;

// Import User model (real or mock)
let User;
if (useMockDB) {
  const mockDB = require('../mock-db-controller');
  User = mockDB.User;
} else {
  User = require('../models/User');
}

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
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }
        if (user.isActive === false) {
            return res.status(401).json({ success: false, message: 'Account is deactivated' });
        }

        // Remove password from user object before attaching to req
        const { password, ...userWithoutPassword } = user;
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