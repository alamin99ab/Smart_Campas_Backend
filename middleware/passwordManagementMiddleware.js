/**
 * 🔐 PASSWORD MANAGEMENT MIDDLEWARE
 * Handles RBAC and security checks for password operations
 */

const User = require('../models/User');

/**
 * Middleware to verify if requester can reset target user's password
 * Implements strict RBAC hierarchy
 */
exports.canResetPasswordFor = async (req, res, next) => {
    try {
        const requester = req.user;
        const { userId } = req.params;

        // Fetch target user
        const targetUser = await User.findById(userId);
        if (!targetUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Attach target user to request for later use
        req.targetUser = targetUser;

        // SUPER ADMIN: Can reset anyone EXCEPT other super admins
        if (requester.role === 'super_admin') {
            if (targetUser.role === 'super_admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Super Admin cannot reset another Super Admin password'
                });
            }
            // Super Admin can reset anyone
            return next();
        }

        // PRINCIPAL: Can only reset specific roles within their school
        if (requester.role === 'principal') {
            // Check school isolation
            if (requester.schoolCode !== targetUser.schoolCode) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only manage users in your own school'
                });
            }

            // Check if target role is manageable by principal
            const manageable = ['teacher', 'student', 'parent', 'accountant'];
            if (!manageable.includes(targetUser.role)) {
                return res.status(403).json({
                    success: false,
                    message: `You cannot reset ${targetUser.role} password`
                });
            }

            return next();
        }

        // All other roles: Cannot reset anyone
        return res.status(403).json({
            success: false,
            message: 'You do not have permission to reset passwords'
        });

    } catch (error) {
        console.error('Password reset permission check error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during authorization check'
        });
    }
};

/**
 * Middleware to validate password strength
 */
exports.validatePasswordStrength = (req, res, next) => {
    const { newPassword, confirmPassword } = req.body;

    if (!newPassword) {
        return res.status(400).json({
            success: false,
            message: 'New password is required'
        });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({
            success: false,
            message: 'Password must be at least 6 characters'
        });
    }

    if (newPassword.length > 128) {
        return res.status(400).json({
            success: false,
            message: 'Password must be less than 128 characters'
        });
    }

    // For self-change, confirm password must be provided
    if (req.path.includes('/change-password') && !confirmPassword) {
        return res.status(400).json({
            success: false,
            message: 'Confirm password is required'
        });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
        return res.status(400).json({
            success: false,
            message: 'New password and confirmation do not match'
        });
    }

    next();
};

/**
 * Middleware to check if current password is different from new password
 */
exports.checkPasswordChange = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id).select('+password');
        const { currentPassword, newPassword } = req.body;

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Check if new password is same as current
        const isSamePassword = await user.comparePassword(newPassword);
        if (isSamePassword) {
            return res.status(400).json({
                success: false,
                message: 'New password must be different from current password'
            });
        }

        next();
    } catch (error) {
        console.error('Password change validation error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during password validation'
        });
    }
};

/**
 * Middleware to create audit log for password operations
 */
exports.auditPasswordOperation = async (req, res, next) => {
    req.auditPasswordOp = {
        action: req.path.includes('/reset-password') ? 'PASSWORD_RESET_BY_ADMIN' : 'PASSWORD_CHANGED_SELF',
        userId: req.user._id || req.user.id,
        role: req.user.role,
        schoolCode: req.user.schoolCode,
        targetUserId: req.targetUser?._id,
        targetRole: req.targetUser?.role,
        forceChangeRequired: req.body.forceChangeOnNextLogin || false,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    };
    next();
};

module.exports = exports;
