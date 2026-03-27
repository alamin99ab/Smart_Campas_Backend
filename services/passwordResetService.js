/**
 * 🔐 PASSWORD RESET SERVICE
 * Handles all password reset operations with proper logging and security
 */

const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const bcrypt = require('bcryptjs');
const { sendEmail } = require('../utils/emailService');

/**
 * Reset a user's password (admin operation)
 * @param {Object} params
 * @param {String} params.targetUserId - User ID whose password to reset
 * @param {String} params.newPassword - New password to set
 * @param {String} params.requesterId - Admin user ID making the reset
 * @param {String} params.requesterRole - Admin user role
 * @param {String} params.requesterSchoolCode - Admin user school code
 * @param {Boolean} params.forceChangeOnNextLogin - Force password change at next login
 * @param {Object} params.req - Express request object (for audit data)
 * @returns {Promise<Object>} Result with success status and user data
 */
exports.resetUserPassword = async (params) => {
    const {
        targetUserId,
        newPassword,
        requesterId,
        requesterRole,
        requesterSchoolCode,
        forceChangeOnNextLogin = false,
        req = null
    } = params;

    try {
        // Fetch target user
        const targetUser = await User.findById(targetUserId);
        if (!targetUser) {
            throw new Error('User not found');
        }

        // Verify requester can reset this user (already done by middleware, but double-check)
        if (requesterRole === 'principal') {
            if (requesterSchoolCode !== targetUser.schoolCode) {
                throw new Error('Cross-school reset not allowed');
            }
            const manageable = ['teacher', 'student', 'parent', 'accountant'];
            if (!manageable.includes(targetUser.role)) {
                throw new Error(`Cannot reset ${targetUser.role} password`);
            }
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update user password
        targetUser.password = hashedPassword;
        targetUser.passwordChangedAt = new Date();

        // Optionally force password change at next login
        if (forceChangeOnNextLogin) {
            targetUser.forcedPasswordChangeAt = new Date();
        }

        // Invalidate all existing sessions/tokens
        targetUser.sessions = [];
        targetUser.refreshToken = null;

        // Reset login attempts
        targetUser.loginAttempts = 0;
        targetUser.isBlocked = false;

        await targetUser.save();

        // Create audit log
        try {
            await AuditLog.create({
                userId: requesterId,
                targetUserId: targetUser._id,
                action: 'PASSWORD_RESET_BY_ADMIN',
                details: {
                    targetRole: targetUser.role,
                    targetEmail: targetUser.email,
                    requesterRole: requesterRole,
                    forceChangeOnNextLogin: forceChangeOnNextLogin
                },
                schoolCode: // Use requester's school code or target's
                    requesterRole === 'super_admin' ? (targetUser.schoolCode || 'SUPER_ADMIN') : requesterSchoolCode,
                ip: req?.ip || 'unknown',
                userAgent: req?.get?.('User-Agent') || 'unknown'
            });
        } catch (auditError) {
            console.error('Audit log creation error:', auditError);
            // Don't fail the operation if audit log fails
        }

        // Send email notification (async, don't wait)
        try {
            sendEmail({
                to: targetUser.email,
                subject: 'Your Password Has Been Reset',
                template: 'password-reset-admin',
                data: {
                    name: targetUser.name,
                    temporaryPassword: newPassword,
                    forceChange: forceChangeOnNextLogin,
                    requesterRole: requesterRole
                }
            }).catch(err => console.error('Email send error:', err));
        } catch (emailError) {
            console.error('Email error:', emailError);
            // Don't fail the operation if email fails
        }

        return {
            success: true,
            message: 'Password reset successfully',
            data: {
                user: {
                    _id: targetUser._id,
                    name: targetUser.name,
                    email: targetUser.email,
                    role: targetUser.role,
                    schoolCode: targetUser.schoolCode
                }
            }
        };

    } catch (error) {
        console.error('Reset password error:', error);
        throw error;
    }
};

/**
 * Change user's own password (self operation)
 * @param {Object} params
 * @param {String} params.userId - User ID changing their own password
 * @param {String} params.currentPassword - Current password
 * @param {String} params.newPassword - New password
 * @param {String} params.deviceId - Device ID to exclude from invalidation
 * @param {Object} params.req - Express request object
 * @returns {Promise<Object>} Result with success status and user data
 */
exports.changeUserPassword = async (params) => {
    const {
        userId,
        currentPassword,
        newPassword,
        deviceId = null,
        req = null
    } = params;

    try {
        // Fetch user with password field
        const user = await User.findById(userId).select('+password');
        if (!user) {
            throw new Error('User not found');
        }

        // Verify current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            throw new Error('Current password is incorrect');
        }

        // Check if new password is same as current
        const isSamePassword = await user.comparePassword(newPassword);
        if (isSamePassword) {
            throw new Error('New password must be different from current password');
        }

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 12);

        // Update password
        user.password = hashedPassword;
        user.passwordChangedAt = new Date();

        // Invalidate all sessions EXCEPT current device (if specified)
        if (deviceId) {
            user.sessions = user.sessions?.filter(s => s.deviceId === deviceId) || [];
        } else {
            user.sessions = [];
        }
        user.refreshToken = null;

        // Reset login attempts
        user.loginAttempts = 0;
        user.isBlocked = false;

        await user.save();

        // Create audit log
        try {
            await AuditLog.create({
                userId: user._id,
                action: 'PASSWORD_CHANGED_SELF',
                details: {
                    userRole: user.role,
                    deviceId: deviceId
                },
                schoolCode: user.schoolCode,
                ip: req?.ip || 'unknown',
                userAgent: req?.get?.('User-Agent') || 'unknown'
            });
        } catch (auditError) {
            console.error('Audit log creation error:', auditError);
        }

        // Send email notification
        try {
            sendEmail({
                to: user.email,
                subject: 'Your Password Has Been Changed',
                template: 'password-changed',
                data: {
                    name: user.name,
                    timestamp: new Date().toLocaleString()
                }
            }).catch(err => console.error('Email send error:', err));
        } catch (emailError) {
            console.error('Email error:', emailError);
        }

        return {
            success: true,
            message: 'Password changed successfully',
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            }
        };

    } catch (error) {
        console.error('Change password error:', error);
        throw error;
    }
};

module.exports = exports;
