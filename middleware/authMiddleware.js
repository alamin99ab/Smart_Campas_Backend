const jwt = require('jsonwebtoken');

const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error('JWT_SECRET environment variable is required');
    }

    if (process.env.NODE_ENV === 'production' && (secret.includes('your_') || secret.length < 32)) {
        throw new Error('JWT_SECRET must be a strong value (min 32 characters, no placeholder values) in production');
    }

    return secret;
};

const protect = async (req, res, next) => {
    let token;

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

        if (decoded.isEnvBased && decoded.id === 'super_admin_env') {
            req.user = {
                _id: 'super_admin_env',
                id: 'super_admin_env',
                email: process.env.SUPER_ADMIN_EMAIL,
                name: process.env.SUPER_ADMIN_NAME || 'Super Admin',
                role: 'super_admin',
                schoolId: null,
                schoolCode: 'SUPER_ADMIN',
                isEnvBased: true,
                isActive: true,
                isApproved: true
            };
            req.isEnvUser = true;
            req.envUserEmail = process.env.SUPER_ADMIN_EMAIL;
            return next();
        }

        const User = require('../models/User');
        const user = await User.findById(decoded.id);

        if (!user) {
            return res.status(401).json({ success: false, message: 'User not found' });
        }
        if (user.isActive === false) {
            return res.status(401).json({ success: false, message: 'Account is deactivated' });
        }

        const userObj = user.toObject ? user.toObject({ virtuals: true }) : user;
        const { password, ...userWithoutPassword } = userObj;
        // Ensure id is set (alias for _id)
        if (!userWithoutPassword.id && userWithoutPassword._id) {
            userWithoutPassword.id = userWithoutPassword._id;
        }
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
