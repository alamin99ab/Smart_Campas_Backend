// controllers/authController.js
const mongoose = require('mongoose');

// MongoDB Models
const User = require('../models/User');
const School = require('../models/School');
const AuditLog = require('../models/AuditLog');

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { sendEmail } = require('../utils/emailService');
const { sendSMS } = require('../utils/smsService');

// ==================== HELPER FUNCTIONS ====================

// Validate JWT configuration at startup
const getJwtSecret = () => {
    const secret = process.env.JWT_SECRET;
    
    // In production, JWT_SECRET is required and validated before server starts
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

const generateToken = (id, role, schoolCode, permissions = [], deviceId = null) => {
    return jwt.sign(
        { id, role, schoolCode, permissions, deviceId },
        getJwtSecret(),
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
};

const getRefreshSecret = () => {
    const secret = process.env.JWT_REFRESH_SECRET;
    
    // In production, JWT_REFRESH_SECRET is required
    if (process.env.NODE_ENV === 'production') {
        if (!secret) {
            throw new Error('JWT_REFRESH_SECRET environment variable is required in production');
        }
        if (secret.includes('your_') || secret.length < 32) {
            throw new Error('JWT_REFRESH_SECRET must be a strong value (min 32 characters, no placeholder values) in production');
        }
    }
    
    // Development fallback
    if (!secret) {
        console.warn('⚠️  WARNING: Using development JWT_REFRESH_SECRET. Set JWT_REFRESH_SECRET in .env for production.');
        return 'dev_refresh_secret_32_chars_minimum_for_development_only';
    }
    
    return secret;
};

const generateRefreshToken = (id, deviceId = null) => {
    return jwt.sign(
        { id, deviceId },
        getRefreshSecret(),
        { expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d' }
    );
};

const setTokenCookie = (res, token) => {
    res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
};

const setRefreshTokenCookie = (res, token) => {
    res.cookie('refreshToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth/refresh',
        maxAge: 7 * 24 * 60 * 60 * 1000
    });
};

const createAuditLog = async (userId, action, details, req) => {
    try {
        // Use directly imported AuditLog model
        if (!AuditLog) return; // Skip audit logging if not available
        
        // Check if this is an env-based user (super_admin_env)
        const isEnvUser = userId === 'super_admin_env' || (req && req.isEnvUser);
        
        const logData = {
            action,
            details,
            ip: req?.ip,
            userAgent: req?.headers?.['user-agent'],
            deviceId: req?.headers?.['x-device-id'] || null
        };
        
        if (isEnvUser) {
            // For env-based super admin
            logData.isEnvUser = true;
            logData.envUserEmail = process.env.SUPER_ADMIN_EMAIL || 'super_admin@env';
        } else {
            // For regular database users
            logData.user = userId;
        }
        
        await AuditLog.create(logData);
    } catch (error) {
        console.error('Audit log error:', error);
    }
};

// ==================== AUTH CONTROLLERS ====================

// @desc    Register User
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
    const { name, email, password, role, schoolName, schoolCode, phone } = req.body;
    const deviceId = req.headers['x-device-id'] || crypto.randomBytes(16).toString('hex');

    try {
        if (!name || !email || !password || !role) {
            return res.status(400).json({ message: 'All fields are required' });
        }
        if (password.length < 6) {
            return res.status(400).json({ message: 'Password must be at least 6 characters' });
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        if (role === 'super_admin') {
            // Super admin doesn't need school code or school name
            // Can register without school association
        }

        if (role === 'principal') {
            if (!schoolName || !schoolCode) {
                return res.status(400).json({ message: 'School name and code required for principal' });
            }
            const existingSchool = await School.findOne({ schoolCode });
            if (existingSchool) {
                return res.status(400).json({ message: 'School code already exists' });
            }
            const existingPrincipal = await User.findOne({ schoolCode, role: 'principal' });
            if (existingPrincipal) {
                return res.status(400).json({ message: 'Principal already exists for this school' });
            }
        }

        if (role === 'teacher' || role === 'student') {
            if (!schoolCode) {
                return res.status(400).json({ message: 'School code required' });
            }
            const school = await School.findOne({ schoolCode, isActive: true });
            if (!school) {
                return res.status(400).json({ message: 'Invalid or inactive school code' });
            }
        }

        let school = null;
        if (role === 'principal') {
            school = await School.create({
                schoolName,
                schoolCode,
                principalEmail: email,
                subscription: {
                    plan: 'trial',
                    status: 'active',
                    startDate: new Date(),
                    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                }
            });
        }

        const emailVerificationToken = crypto.randomBytes(32).toString('hex');
        const emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000;

        const user = await User.create({
            name,
            email,
            password, // plain password
            role,
            schoolName: school?.schoolName || schoolName,
            schoolCode,
            phone,
            isApproved: role === 'principal' ? true : false,
            emailVerificationToken,
            emailVerificationExpire,
            permissions: role === 'principal' ? ['manage_all'] : [],
            devices: [{
                deviceId,
                name: req.headers['user-agent']?.substring(0, 100) || 'Unknown device',
                lastActive: new Date()
            }]
        });

        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${emailVerificationToken}`;
        sendEmail({
            to: email,
            subject: 'Verify Your Email',
            template: 'email-verification',
            data: { name, verificationUrl }
        }).catch(err => console.error('Email send error:', err));

        const token = generateToken(user._id, user.role, user.schoolCode, user.permissions, deviceId);
        const refreshToken = generateRefreshToken(user._id, deviceId);

        user.refreshToken = refreshToken;
        user.sessions = user.sessions || [];
        user.sessions.push({
            token: refreshToken,
            device: req.headers['user-agent']?.substring(0, 200) || 'Unknown device',
            deviceId,
            ip: req.ip,
            lastActive: new Date()
        });
        await user.save();

        await createAuditLog(user._id, 'REGISTER', { role, schoolCode }, req);

        if (process.env.USE_COOKIE === 'true') {
            setTokenCookie(res, token);
            setRefreshTokenCookie(res, refreshToken);
        }

        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            schoolCode: user.schoolCode,
            schoolName: user.schoolName,
            isApproved: user.isApproved,
            emailVerified: false,
            permissions: user.permissions,
            deviceId,
            token: process.env.USE_COOKIE === 'true' ? undefined : token,
            refreshToken: process.env.USE_COOKIE === 'true' ? undefined : refreshToken
        });

    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ message: 'Registration failed' });
    }
} // Added closing bracket here

// @desc    Login User
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
    const { email, password, schoolCode, twoFactorToken } = req.body;
    const deviceId = req.headers['x-device-id'] || crypto.randomBytes(16).toString('hex');

    try {
        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                message: 'Email and password required' 
            });
        }

        // ============================================
        // SUPER ADMIN AUTHENTICATION FROM ENV VARIABLES
        // ============================================
        // Super Admin login does NOT require schoolCode - only email + password
        const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
        const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
        
        if (email === superAdminEmail && superAdminEmail && superAdminPassword) {
            // Validate Super Admin password from environment variables
            let isSuperAdminValid = false;
            
            if (superAdminPassword.startsWith('$2') && superAdminPassword.length >= 60) {
                isSuperAdminValid = await bcrypt.compare(password, superAdminPassword);
            } else {
                isSuperAdminValid = (password === superAdminPassword);
            }
            
            if (!isSuperAdminValid) {
                return res.status(401).json({ 
                    success: false,
                    message: 'Invalid credentials' 
                });
            }
            
            const superAdminToken = jwt.sign(
                { 
                    id: 'super_admin_env',
                    role: 'super_admin',
                    schoolCode: 'SUPER_ADMIN',
                    isEnvBased: true
                },
                getJwtSecret(),
                { expiresIn: process.env.JWT_EXPIRE || '7d' }
            );
            
            const refreshToken = generateRefreshToken('super_admin_env', deviceId);
            
            return res.json({
                success: true,
                message: 'Super Admin login successful',
                token: superAdminToken,
                refreshToken,
                data: {
                    user: {
                        email: superAdminEmail,
                        name: process.env.SUPER_ADMIN_NAME || 'Super Admin',
                        role: 'super_admin'
                    }
                }
            });
        }
        // ============================================

        // ============================================
        // MULTI-SCHOOL SAAS LOGIN VALIDATION
        // ============================================
        // For school users (principal, teacher, student, parent, accountant), schoolCode is REQUIRED
        let validatedSchoolCode = null;
        
        // First, check if user exists to determine their role and expected school
        const userCheck = await User.findOne({ email }).select(
            '+password +refreshToken +loginAttempts +isBlocked +twoFactorSecret +twoFactorEnabled +devices schoolCode role'
        );

        // If user exists, get their schoolCode from database
        if (userCheck && userCheck.schoolCode) {
            validatedSchoolCode = userCheck.schoolCode;
        } else {
            // If user doesn't exist yet, schoolCode must be provided
            if (!schoolCode) {
                return res.status(400).json({ 
                    success: false,
                    message: 'School code is required for new user login' 
                });
            }
            
            // Validate the provided schoolCode exists and is active
            const school = await School.findOne({ schoolCode: schoolCode.toUpperCase() });
            if (!school) {
                return res.status(404).json({ 
                    success: false,
                    message: 'School not found with this code' 
                });
            }
            
            if (!school.isActive) {
                return res.status(403).json({ 
                    success: false,
                    message: 'School account is inactive' 
                });
            }
            
            // Check subscription status
            if (school.subscription?.status !== 'active') {
                return res.status(403).json({ 
                    success: false,
                    message: 'School subscription is not active. Please contact your administrator.' 
                });
            }
            
            validatedSchoolCode = school.schoolCode;
        }
        // ============================================

        // MongoDB query - get user with password field for verification
        const user = await User.findOne({ email }).select(
            '+password +refreshToken +loginAttempts +isBlocked +twoFactorSecret +twoFactorEnabled +devices'
        );

        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid credentials' 
            });
        }

        // Verify school code matches for this user (multi-school safety check)
        if (user.schoolCode && schoolCode && user.schoolCode !== schoolCode.toUpperCase()) {
            return res.status(403).json({ 
                success: false,
                message: 'Invalid school code for this user' 
            });
        }

        if (user.isBlocked) {
            await createAuditLog(user._id, 'LOGIN_BLOCKED', { reason: 'Account blocked' }, req);
            return res.status(403).json({ 
                success: false,
                message: 'Account blocked. Contact support.' 
            });
        }

        if (!user.emailVerified && process.env.REQUIRE_EMAIL_VERIFICATION === 'true') {
            return res.status(403).json({ 
                success: false,
                message: 'Please verify your email first' 
            });
        }

        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            user.loginAttempts = (user.loginAttempts || 0) + 1;
            if (user.loginAttempts >= 5) {
                user.isBlocked = true;
                await user.save();
                await createAuditLog(user._id, 'ACCOUNT_BLOCKED', { reason: 'Too many failed attempts' }, req);
                return res.status(403).json({ 
                    success: false,
                    message: 'Too many attempts. Account blocked.' 
                });
            }
            await user.save();
            await createAuditLog(user._id, 'LOGIN_FAILED', { attempt: user.loginAttempts }, req);
            return res.status(401).json({ 
                success: false,
                message: 'Invalid credentials' 
            });
        }

        if (user.twoFactorEnabled) {
            if (!twoFactorToken) {
                return res.status(403).json({
                    success: false,
                    message: '2FA token required',
                    twoFactorRequired: true
                });
            }
            const verified = speakeasy.totp.verify({
                secret: user.twoFactorSecret,
                encoding: 'base32',
                token: twoFactorToken
            });
            if (!verified) {
                await createAuditLog(user._id, '2FA_FAILED', {}, req);
                return res.status(401).json({ message: 'Invalid 2FA token' });
            }
        }

        // Check school subscription only for non-super-admin users
        if (user.role !== 'super_admin' && user.schoolCode) {
            const school = await School.findOne({ schoolCode: user.schoolCode });
            if (school && school.subscription?.status !== 'active') {
                return res.status(403).json({ message: 'School subscription is inactive' });
            }
        }

        user.loginAttempts = 0;
        user.lastLogin = new Date();
        user.lastLoginIP = req.ip;
        user.lastUserAgent = req.headers['user-agent'];

        // Ensure devices array exists
        if (!user.devices) {
            user.devices = [];
        }

        const deviceIndex = user.devices.findIndex(d => d.deviceId === deviceId);
        if (deviceIndex === -1) {
            user.devices.push({
                deviceId,
                name: req.headers['user-agent']?.substring(0, 100) || 'Unknown device',
                lastActive: new Date()
            });
        } else {
            user.devices[deviceIndex].lastActive = new Date();
        }

        // Generate token with schoolCode for multi-school SaaS
        const token = generateToken(user._id, user.role, user.schoolCode, user.permissions, deviceId);
        const refreshToken = generateRefreshToken(user._id, deviceId);

        user.refreshToken = refreshToken;
        user.sessions = user.sessions || [];
        if (user.sessions.length >= 5) {
            user.sessions.shift();
        }
        user.sessions.push({
            token: refreshToken,
            device: req.headers['user-agent']?.substring(0, 200) || 'Unknown device',
            deviceId,
            ip: req.ip,
            lastActive: new Date()
        });

        await user.save();
        await createAuditLog(user._id, 'LOGIN_SUCCESS', { deviceId, schoolCode: user.schoolCode }, req);

        if (process.env.USE_COOKIE === 'true') {
            setTokenCookie(res, token);
            setRefreshTokenCookie(res, refreshToken);
        }

        // Get school details for response
        let schoolDetails = null;
        if (user.schoolCode) {
            const school = await School.findOne({ schoolCode: user.schoolCode }).select('schoolName subscription');
            if (school) {
                schoolDetails = {
                    schoolName: school.schoolName,
                    plan: school.subscription?.plan || 'trial',
                    subscriptionStatus: school.subscription?.status || 'active',
                    expiryDate: school.subscription?.endDate
                };
            }
        }

        res.json({
            success: true,
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                schoolCode: user.schoolCode,
                schoolName: user.schoolName,
                isApproved: user.isApproved,
                emailVerified: user.emailVerified,
                twoFactorEnabled: user.twoFactorEnabled,
                permissions: user.permissions,
                deviceId,
                schoolDetails,
                token: process.env.USE_COOKIE === 'true' ? undefined : token,
                refreshToken: process.env.USE_COOKIE === 'true' ? undefined : refreshToken
            }
        });

    } catch (error) {
        console.error('❌ Login error:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({ 
            success: false,
            message: 'Login failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// @desc    Refresh Token
// @route   POST /api/auth/refresh
// @access  Public
exports.refreshToken = async (req, res) => {
    const { refreshToken } = req.body;
    const cookieToken = req.cookies?.refreshToken;
    const deviceId = req.headers['x-device-id'];

    try {
        const token = refreshToken || cookieToken;

        if (!token) {
            return res.status(401).json({ message: 'No refresh token' });
        }

        const decoded = jwt.verify(token, getRefreshSecret());

        if (decoded.deviceId && decoded.deviceId !== deviceId) {
            await createAuditLog(decoded.id, 'REFRESH_TOKEN_DEVICE_MISMATCH', {}, req);
            return res.status(401).json({ message: 'Invalid device' });
        }

        const user = await User.findOne({ _id: decoded.id, 'sessions.token': token });

        if (!user) {
            return res.status(401).json({ message: 'Invalid refresh token' });
        }

        const newToken = generateToken(user._id, user.role, user.schoolCode, user.permissions, deviceId);
        const newRefreshToken = generateRefreshToken(user._id, deviceId);

        const session = user.sessions.find(s => s.token === token);
        if (session) {
            session.token = newRefreshToken;
            session.lastActive = new Date();
        }
        user.refreshToken = newRefreshToken;
        await user.save();

        if (process.env.USE_COOKIE === 'true') {
            setTokenCookie(res, newToken);
            setRefreshTokenCookie(res, newRefreshToken);
        }

        res.json({
            token: process.env.USE_COOKIE === 'true' ? undefined : newToken,
            refreshToken: process.env.USE_COOKIE === 'true' ? undefined : newRefreshToken
        });

    } catch (error) {
        console.error('Refresh error:', error);
        res.status(401).json({ message: 'Invalid or expired refresh token' });
    }
};

// @desc    Logout User
// @route   POST /api/auth/logout
// @access  Private
exports.logoutUser = async (req, res) => {
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
    const deviceId = req.headers['x-device-id'];

    try {
        if (refreshToken && req.user) {
            await User.updateOne(
                { _id: req.user._id },
                { $pull: { sessions: { token: refreshToken } }, $set: { refreshToken: null } }
            );
            await createAuditLog(req.user._id, 'LOGOUT', { deviceId }, req);
        }

        res.clearCookie('token');
        res.clearCookie('refreshToken');
        res.json({ message: 'Logged out successfully' });

    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ message: 'Logout failed' });
    }
};

// @desc    Logout from all devices
// @route   POST /api/auth/logout-all
// @access  Private
exports.logoutAllDevices = async (req, res) => {
    try {
        await User.updateOne(
            { _id: req.user._id },
            { sessions: [], refreshToken: null }
        );
        await createAuditLog(req.user._id, 'LOGOUT_ALL_DEVICES', {}, req);
        res.clearCookie('token');
        res.clearCookie('refreshToken');
        res.json({ message: 'Logged out from all devices' });

    } catch (error) {
        console.error('Logout all error:', error);
        res.status(500).json({ message: 'Failed to logout from all devices' });
    }
};

// @desc    Get User Profile
// @route   GET /api/auth/profile
// @access  Private
exports.getUserProfile = async (req, res) => {
    try {
        // Use Mongoose pattern
        const selectFields = '-password -refreshToken -emailVerificationToken -resetPasswordToken -twoFactorSecret';
        const user = await User.findById(req.user._id).select(selectFields);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const activeSessions = user.sessions?.length || 0;
        const devices = user.devices || [];
        let school = null;
        if (user.schoolCode) {
            school = await School.findOne({ schoolCode: user.schoolCode }).select('schoolName subscription logo address phone email');
        }

        await createAuditLog(user._id, 'PROFILE_VIEW', {}, req);

        // Use Mongoose toObject method
        const userData = user.toObject();

        res.json({
            success: true,
            data: {
                ...userData,
                activeSessions,
                devices,
                ...(school && { school })
            }
        });

    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ message: 'Failed to fetch profile' });
    }
};

// @desc    Update Profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateUserProfile = async (req, res) => {
    const { name, phone, address, profileImage } = req.body;

    try {
        const user = await User.findById(req.user._id);

        if (name) user.name = name;
        if (phone) user.phone = phone;
        if (address) user.address = address;
        if (profileImage) user.profileImage = profileImage;

        await user.save();
        await createAuditLog(user._id, 'PROFILE_UPDATE', { fields: { name, phone, address } }, req);

        res.json({
            message: 'Profile updated',
            user: {
                name: user.name,
                email: user.email,
                phone: user.phone,
                address: user.address,
                profileImage: user.profileImage
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Failed to update profile' });
    }
};

// @desc    Change Password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    try {
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ message: 'All fields required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ message: 'Password must be 6+ characters' });
        }

        const user = await User.findById(req.user._id).select('+password');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        const isValid = await user.comparePassword(currentPassword);

        if (!isValid) {
            return res.status(400).json({ message: 'Current password incorrect' });
        }

        user.password = await bcrypt.hash(newPassword, 12);
        user.passwordChangedAt = new Date();

        const currentDeviceId = req.headers['x-device-id'];
        user.sessions = user.sessions?.filter(s => s.deviceId === currentDeviceId) || [];
        if (user.sessions.length === 0) user.refreshToken = null;

        await user.save();

        await createAuditLog(user._id, 'PASSWORD_CHANGED', { deviceId: currentDeviceId }, req);

        // Send email notification
        sendEmail({
            to: user.email,
            subject: 'Password Changed',
            template: 'password-changed',
            data: { name: user.name, time: new Date().toLocaleString() }
        }).catch(err => console.error('Email error:', err));

        res.json({ message: 'Password changed successfully' });

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ message: 'Failed to change password' });
    }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const resetToken = crypto.randomBytes(32).toString('hex');
        user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
        await user.save();

        const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
        
        // Bypass email sending for testing
        if (process.env.NODE_ENV === 'development') {
            console.log(`📧 Email bypassed in development: ${resetUrl}`);
            await createAuditLog(user._id, 'PASSWORD_RESET_REQUESTED', { 
                email, 
                resetToken,
                bypassed: true 
            }, req);
        } else {
            sendEmail({
                to: email,
                subject: 'Password Reset',
                template: 'password-reset',
                data: { name: user.name, resetUrl }
            }).catch(err => console.error('Email error:', err));
        }

        await createAuditLog(user._id, 'PASSWORD_RESET_REQUESTED', {}, req);

        res.json({
            message: 'Password reset email sent',
            resetToken: process.env.NODE_ENV === 'development' ? resetToken : undefined
        });

    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ message: 'Failed to process request' });
    }
};

// @desc    Reset Password
// @route   PUT /api/auth/reset-password/:token
// @access  Public
exports.resetPassword = async (req, res) => {
    const { token } = req.params;
    const { password } = req.body;

    try {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const user = await User.findOne({
            resetPasswordToken: hashedToken,
            resetPasswordExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        if (!password || password.length < 6) {
            return res.status(400).json({ message: 'Password must be 6+ characters' });
        }

        user.password = await bcrypt.hash(password, 12);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        user.passwordChangedAt = new Date();
        user.sessions = [];
        user.refreshToken = null;
        await user.save();

        await createAuditLog(user._id, 'PASSWORD_RESET_COMPLETED', {}, req);

        sendEmail({
            to: user.email,
            subject: 'Password Reset Successful',
            template: 'password-reset-success',
            data: { name: user.name }
        }).catch(err => console.error('Email error:', err));

        res.json({ message: 'Password reset successful' });

    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ message: 'Failed to reset password' });
    }
};

// @desc    Verify Email
// @route   GET /api/auth/verify-email/:token
// @access  Public
exports.verifyEmail = async (req, res) => {
    const { token } = req.params;

    try {
        const user = await User.findOne({
            emailVerificationToken: token,
            emailVerificationExpire: { $gt: Date.now() }
        });

        if (!user) {
            return res.status(400).json({ message: 'Invalid or expired token' });
        }

        user.emailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpire = undefined;
        await user.save();

        await createAuditLog(user._id, 'EMAIL_VERIFIED', {}, req);

        res.json({ message: 'Email verified successfully' });

    } catch (error) {
        console.error('Verify email error:', error);
        res.status(500).json({ message: 'Failed to verify email' });
    }
};

// @desc    Resend Verification Email
// @route   POST /api/auth/resend-verification
// @access  Public
exports.resendVerificationEmail = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        if (user.emailVerified) {
            return res.status(400).json({ message: 'Email already verified' });
        }

        const emailVerificationToken = crypto.randomBytes(32).toString('hex');
        user.emailVerificationToken = emailVerificationToken;
        user.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000;
        await user.save();

        const verificationUrl = `${process.env.FRONTEND_URL}/verify-email/${emailVerificationToken}`;
        sendEmail({
            to: email,
            subject: 'Verify Your Email',
            template: 'email-verification',
            data: { name: user.name, verificationUrl }
        }).catch(err => console.error('Email error:', err));

        await createAuditLog(user._id, 'VERIFICATION_EMAIL_RESENT', {}, req);

        res.json({ message: 'Verification email sent' });

    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({ message: 'Failed to resend verification email' });
    }
};

// @desc    Setup 2FA
// @route   POST /api/auth/setup-2fa
// @access  Private
exports.setup2FA = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (user.twoFactorEnabled) {
            return res.status(400).json({ message: '2FA already enabled' });
        }

        const secret = speakeasy.generateSecret({ name: `Smart Campus (${user.email})` });
        user.twoFactorSecret = secret.base32;
        await user.save();

        const dataUrl = await new Promise((resolve, reject) => {
            qrcode.toDataURL(secret.otpauth_url, (err, url) => {
                if (err) reject(err);
                else resolve(url);
            });
        });

        await createAuditLog(user._id, '2FA_SETUP_INITIATED', {}, req);

        res.json({ secret: secret.base32, qrCode: dataUrl });
    } catch (error) {
        console.error('2FA setup error:', error);
        res.status(500).json({ message: 'Failed to setup 2FA' });
    }
};

// @desc    Verify and Enable 2FA
// @route   POST /api/auth/verify-2fa
// @access  Private
exports.verifyAndEnable2FA = async (req, res) => {
    const { token } = req.body;

    try {
        if (!token) {
            return res.status(400).json({ message: 'Token required' });
        }

        const user = await User.findById(req.user._id).select('+twoFactorSecret');
        if (!user || !user.twoFactorSecret) {
            return res.status(400).json({ message: '2FA setup not started or expired. Please setup 2FA again.' });
        }
        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token
        });

        if (!verified) {
            return res.status(401).json({ message: 'Invalid token' });
        }

        user.twoFactorEnabled = true;
        await user.save();

        await createAuditLog(user._id, '2FA_ENABLED', {}, req);

        res.json({ message: '2FA enabled successfully' });

    } catch (error) {
        console.error('Verify 2FA error:', error);
        res.status(500).json({ message: 'Failed to verify 2FA' });
    }
};

// @desc    Disable 2FA
// @route   POST /api/auth/disable-2fa
// @access  Private
exports.disable2FA = async (req, res) => {
    const { password, token } = req.body;

    try {
        if (!password || !token) {
            return res.status(400).json({ message: 'Password and 2FA token required' });
        }

        const user = await User.findById(req.user._id).select('+password +twoFactorSecret');
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid password' });
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token
        });

        if (!verified) {
            return res.status(401).json({ message: 'Invalid 2FA token' });
        }

        user.twoFactorEnabled = false;
        user.twoFactorSecret = undefined;
        await user.save();

        await createAuditLog(user._id, '2FA_DISABLED', {}, req);

        res.json({ message: '2FA disabled successfully' });

    } catch (error) {
        console.error('Disable 2FA error:', error);
        res.status(500).json({ message: 'Failed to disable 2FA' });
    }
};

// @desc    Get All Sessions
// @route   GET /api/auth/sessions
// @access  Private
exports.getSessions = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('sessions devices');
        const currentDeviceId = req.headers['x-device-id'];

        res.json({
            currentDeviceId,
            sessions: user.sessions || [],
            devices: user.devices || []
        });

    } catch (error) {
        console.error('Get sessions error:', error);
        res.status(500).json({ message: 'Failed to fetch sessions' });
    }
};

// @desc    Revoke Session
// @route   DELETE /api/auth/sessions/:sessionToken
// @access  Private
exports.revokeSession = async (req, res) => {
    const { sessionToken } = req.params;

    try {
        const result = await User.updateOne(
            { _id: req.user._id, 'sessions.token': sessionToken },
            { $pull: { sessions: { token: sessionToken } } }
        );

        if (result.modifiedCount === 0) {
            return res.status(404).json({ message: 'Session not found' });
        }

        await createAuditLog(req.user._id, 'SESSION_REVOKED', { sessionToken }, req);

        res.json({ message: 'Session revoked' });

    } catch (error) {
        console.error('Revoke session error:', error);
        res.status(500).json({ message: 'Failed to revoke session' });
    }
};

// @desc    Get Pending Teachers (Principal only)
// @route   GET /api/auth/pending-teachers
// @access  Private
exports.getPendingTeachers = async (req, res) => {
    try {
        if (req.user.role !== 'principal') {
            return res.status(403).json({ message: 'Access denied. Principal only.' });
        }

        const teachers = await User.find({
            schoolCode: req.user.schoolCode,
            role: 'teacher',
            isApproved: false
        }).select('name email phone createdAt');

        res.json({
            count: teachers.length,
            teachers
        });

    } catch (error) {
        console.error('Get pending teachers error:', error);
        res.status(500).json({ message: 'Failed to fetch pending teachers' });
    }
};

// @desc    Approve Teacher (Principal only)
// @route   PUT /api/auth/approve-teacher/:id
// @access  Private
exports.approveTeacher = async (req, res) => {
    try {
        if (req.user.role !== 'principal') {
            return res.status(403).json({ message: 'Access denied. Principal only.' });
        }

        const teacher = await User.findById(req.params.id);
        if (!teacher || teacher.schoolCode !== req.user.schoolCode) {
            return res.status(404).json({ message: 'Teacher not found' });
        }

        if (teacher.role !== 'teacher') {
            return res.status(400).json({ message: 'User is not a teacher' });
        }

        if (teacher.isApproved) {
            return res.status(400).json({ message: 'Teacher already approved' });
        }

        teacher.isApproved = true;
        teacher.approvedBy = req.user._id;
        teacher.approvedAt = new Date();
        await teacher.save();

        sendEmail({
            to: teacher.email,
            subject: 'Account Approved',
            template: 'teacher-approved',
            data: { name: teacher.name, schoolName: req.user.schoolName }
        }).catch(err => console.error('Email error:', err));

        if (teacher.phone) {
            sendSMS({
                to: teacher.phone,
                message: `Your teacher account has been approved by ${req.user.schoolName} principal.`
            }).catch(err => console.error('SMS error:', err));
        }

        await createAuditLog(req.user._id, 'TEACHER_APPROVED', { teacherId: teacher._id }, req);

        res.json({ message: 'Teacher approved successfully' });

    } catch (error) {
        console.error('Approve teacher error:', error);
        res.status(500).json({ message: 'Failed to approve teacher' });
    }
};

// @desc    Get Audit Logs (Admin only)
// @route   GET /api/auth/audit-logs
// @access  Private
exports.getAuditLogs = async (req, res) => {
    const { page = 1, limit = 20, userId, action } = req.query;
    const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const pageNum = Math.max(parseInt(page, 10) || 1, 1);

    try {
        if (req.user.role !== 'admin' && req.user.role !== 'principal') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const query = {};
        if (userId) query.user = userId;
        if (action) query.action = action;

        if (req.user.role === 'principal') {
            const schoolUsers = await User.find({ schoolCode: req.user.schoolCode }).select('_id');
            query.user = { $in: schoolUsers.map(u => u._id) };
        }

        const logs = await AuditLog.find(query)
            .populate('user', 'name email role')
            .sort({ createdAt: -1 })
            .limit(limitNum)
            .skip((pageNum - 1) * limitNum);

        const total = await AuditLog.countDocuments(query);

        res.json({
            logs,
            totalPages: Math.ceil(total / limitNum),
            currentPage: pageNum,
            total
        });

    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ message: 'Failed to fetch audit logs' });
    }
};