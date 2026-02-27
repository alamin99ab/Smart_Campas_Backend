/**
 * 🔐 SUPER ADMIN AUTHENTICATION MIDDLEWARE
 * Enhanced security for Super Admin access
 */

const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

/**
 * Enhanced Super Admin Authentication
 * Includes additional security checks for super admin access
 */
exports.superAdminAuth = async (req, res, next) => {
    try {
        // Check if user is authenticated
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
        }

        // Verify super admin role
        if (req.user.role !== 'super_admin') {
            // Log unauthorized access attempt
            await AuditLog.create({
                userId: req.user._id,
                action: 'UNAUTHORIZED_SUPER_ADMIN_ACCESS',
                details: `User ${req.user.email} attempted to access super admin resources`,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });

            return res.status(403).json({
                success: false,
                message: 'Access denied. Super admin privileges required.'
            });
        }

        // Additional security checks for super admin
        const superAdmin = await User.findById(req.user._id)
            .select('+loginAttempts +isBlocked +lastLogin +lastLoginIP');

        if (!superAdmin) {
            return res.status(401).json({
                success: false,
                message: 'Super admin account not found'
            });
        }

        // Check if account is blocked
        if (superAdmin.isBlocked) {
            await AuditLog.create({
                userId: superAdmin._id,
                action: 'BLOCKED_ACCESS_ATTEMPT',
                details: 'Blocked super admin attempted to access system',
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });

            return res.status(403).json({
                success: false,
                message: 'Account is blocked. Contact system administrator.'
            });
        }

        // Check for suspicious activity (multiple failed logins)
        if (superAdmin.loginAttempts > 3) {
            await AuditLog.create({
                userId: superAdmin._id,
                action: 'SUSPICIOUS_ACTIVITY',
                details: `Super admin with ${superAdmin.loginAttempts} failed login attempts accessing system`,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });

            // Optional: Require additional verification for high-risk access
            req.requireAdditionalAuth = true;
        }

        // Add super admin specific data to request
        req.superAdmin = {
            id: superAdmin._id,
            email: superAdmin.email,
            lastLogin: superAdmin.lastLogin,
            lastLoginIP: superAdmin.lastLoginIP,
            loginAttempts: superAdmin.loginAttempts
        };

        // Log successful super admin access
        await AuditLog.create({
            userId: superAdmin._id,
            action: 'SUPER_ADMIN_ACCESS',
            details: `Super admin accessing ${req.method} ${req.originalUrl}`,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        next();
    } catch (error) {
        console.error('Super admin auth error:', error);
        res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};

/**
 * Super Admin Session Validation
 * Validates active session and device
 */
exports.validateSuperAdminSession = async (req, res, next) => {
    try {
        const deviceId = req.headers['x-device-id'];
        
        if (!deviceId) {
            return res.status(400).json({
                success: false,
                message: 'Device ID required for super admin access'
            });
        }

        const superAdmin = await User.findById(req.user._id).select('sessions devices');
        
        // Check if device is registered
        const deviceExists = superAdmin.devices?.some(device => 
            device.deviceId === deviceId
        );

        if (!deviceExists) {
            await AuditLog.create({
                userId: superAdmin._id,
                action: 'UNKNOWN_DEVICE_ACCESS',
                details: `Super admin access from unknown device: ${deviceId}`,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });

            return res.status(403).json({
                success: false,
                message: 'Unknown device. Please register this device first.'
            });
        }

        // Check for active session
        const activeSession = superAdmin.sessions?.find(session => 
            session.deviceId === deviceId
        );

        if (!activeSession) {
            return res.status(401).json({
                success: false,
                message: 'No active session found. Please login again.'
            });
        }

        // Update session activity
        activeSession.lastActive = new Date();
        await superAdmin.save();

        next();
    } catch (error) {
        console.error('Session validation error:', error);
        res.status(500).json({
            success: false,
            message: 'Session validation error'
        });
    }
};

/**
 * Super Admin Permission Check
 * Validates specific permissions for actions
 */
exports.requireSuperAdminPermission = (permission) => {
    return async (req, res, next) => {
        try {
            const superAdmin = await User.findById(req.user._id).select('permissions');
            
            if (!superAdmin.permissions.includes(permission)) {
                await AuditLog.create({
                    userId: superAdmin._id,
                    action: 'INSUFFICIENT_PERMISSIONS',
                    details: `Super admin attempted action requiring ${permission} permission`,
                    ip: req.ip,
                    userAgent: req.headers['user-agent']
                });

                return res.status(403).json({
                    success: false,
                    message: `Insufficient permissions. Required: ${permission}`
                });
            }

            next();
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({
                success: false,
                message: 'Permission validation error'
            });
        }
    };
};

/**
 * Rate Limiting for Super Admin Actions
 */
exports.superAdminRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
    const requests = new Map();

    return async (req, res, next) => {
        const key = `${req.user._id}-${req.ip}`;
        const now = Date.now();
        const windowStart = now - windowMs;

        // Clean old requests
        if (requests.has(key)) {
            const userRequests = requests.get(key).filter(time => time > windowStart);
            requests.set(key, userRequests);
        }

        const userRequests = requests.get(key) || [];

        if (userRequests.length >= maxRequests) {
            await AuditLog.create({
                userId: req.user._id,
                action: 'RATE_LIMIT_EXCEEDED',
                details: `Super admin exceeded rate limit: ${maxRequests} requests per ${windowMs}ms`,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });

            return res.status(429).json({
                success: false,
                message: 'Too many requests. Please try again later.'
            });
        }

        userRequests.push(now);
        requests.set(key, userRequests);

        next();
    };
};
