const User = require('../models/User');
const School = require('../models/School');
const AuditLog = require('../models/AuditLog');

const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { sendEmail } = require('../utils/emailService');
const { sendSMS } = require('../utils/smsService');
const { USER_SAFE_RESPONSE_PROJECTION, sanitizeUserForResponse } = require('../utils/safeUserResponse');

// ==================== HELPER FUNCTIONS ====================

// Validate JWT configuration at startup
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

const generateToken = (id, role, schoolCode, permissions = [], deviceId = null) => {
    return jwt.sign(
        { id, role, schoolCode, permissions, deviceId },
        getJwtSecret(),
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
};

const getRefreshSecret = () => {
    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;

    if (!secret) {
        throw new Error('JWT_REFRESH_SECRET or JWT_SECRET environment variable is required');
    }

    if (process.env.NODE_ENV === 'production' && (secret.includes('your_') || secret.length < 32)) {
        throw new Error('JWT_REFRESH_SECRET must be a strong value (min 32 characters, no placeholder values) in production');
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
        if (mongoose.connection.readyState !== 1) return; // Skip audit writes when DB is unavailable
        
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
            logData.envUserEmail = process.env.SUPER_ADMIN_EMAIL;
        } else {
            // For regular database users
            logData.user = userId;
        }
        
        await AuditLog.create(logData);
    } catch (error) {
        console.error('Audit log error:', error);
    }
};

const sendAuthError = (res, statusCode, message, code, details) => {
    return res.status(statusCode).json({
        success: false,
        code,
        message,
        ...(details && process.env.NODE_ENV !== 'production' ? { details } : {})
    });
};

const sendAuthSuccess = (res, { statusCode = 200, code = 'REQUEST_SUCCESS', message = 'Request successful', data, legacyFields = {} } = {}) => {
    const payload = {
        success: true,
        code,
        message,
        ...(data !== undefined ? { data } : {}),
        ...legacyFields
    };

    return res.status(statusCode).json(payload);
};

const isDbUnavailableError = (error) => {
    return error?.name === 'MongoServerSelectionError'
        || error?.name === 'MongooseServerSelectionError'
        || error?.name === 'MongoNetworkError'
        || /buffering timed out/i.test(error?.message || '');
};

const handleAuthError = (res, error, fallbackMessage) => {
    if (error?.name === 'CastError') {
        return sendAuthError(res, 400, 'Invalid request data', 'INVALID_REQUEST_DATA', error.message);
    }

    if (isDbUnavailableError(error)) {
        return sendAuthError(res, 503, 'Database unavailable. Please try again shortly.', 'DB_UNAVAILABLE', error.message);
    }

    return sendAuthError(res, 500, fallbackMessage, 'INTERNAL_ERROR', error?.message);
};

const getAuthenticatedUserId = (req, res) => {
    const userId = req?.user?._id || req?.user?.id;

    if (!userId) {
        sendAuthError(res, 401, 'Authentication required. Please login and try again.', 'AUTH_REQUIRED');
        return null;
    }

    return userId;
};

// ==================== AUTH CONTROLLERS ====================

// @desc    Register User
// @route   POST /api/auth/register
// @access  Public
exports.registerUser = async (req, res) => {
    const { name, email, password, role, schoolName, schoolCode, phone } = req.body;
    const deviceId = req.headers['x-device-id'] || crypto.randomBytes(16).toString('hex');

    try {
        const normalizedEmail = email.trim().toLowerCase();
        const normalizedName = name.trim();
        const normalizedSchoolCode = schoolCode ? schoolCode.trim().toUpperCase() : undefined;

        if (!normalizedName || !normalizedEmail || !password || !role) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        const passwordPolicy = /^(?=.{8,128}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).*$/;
        if (!passwordPolicy.test(password)) {
            return res.status(400).json({ message: 'Password must be 8-128 chars and include uppercase, lowercase, number, and symbol' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedEmail)) {
            return res.status(400).json({ message: 'Invalid email format' });
        }

        const existingUser = await User.findOne({ email: normalizedEmail });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        if (role === 'super_admin' || role === 'principal') {
            return res.status(403).json({ message: 'Registration of this role via public API is not allowed. Use Super Admin flow or invitation workflow.' });
        }

        let school = null;
        if (['teacher', 'student', 'parent', 'accountant'].includes(role)) {
            if (!normalizedSchoolCode) {
                return res.status(400).json({ message: 'School code required' });
            }

            school = await School.findOne({ schoolCode: normalizedSchoolCode, isActive: true });
            if (!school) {
                return res.status(400).json({ message: 'Invalid or inactive school code' });
            }

            const existingSchoolUser = await User.findOne({ schoolCode: normalizedSchoolCode, role, email: normalizedEmail });
        if (existingSchoolUser) {
            return res.status(400).json({ message: `${role} account already exists for this email in the specified school` });
        }
    }

        const emailVerificationToken = crypto.randomBytes(32).toString('hex');
        const emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000;

        const user = await User.create({
            name: normalizedName,
            email: normalizedEmail,
            password,
            role,
            schoolId: school ? school._id : undefined,
            schoolName: school ? school.schoolName : schoolName,
            schoolCode: school ? school.schoolCode : normalizedSchoolCode,
            phone,
            isApproved: false,
            emailVerificationToken,
            emailVerificationExpire,
            permissions: [],
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
}

// @desc    Login User (Super Admin and School Users)
// @route   POST /api/auth/login
// @access  Public
exports.loginUser = async (req, res) => {
    const { email: rawEmail, password, schoolCode: rawSchoolCode, twoFactorToken, isSuperAdminLogin } = req.body;
    const deviceId = req.headers['x-device-id'] || crypto.randomBytes(16).toString('hex');

    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : rawEmail;
    const schoolCode = typeof rawSchoolCode === 'string' ? rawSchoolCode.trim().toUpperCase() : rawSchoolCode;

    try {
        if (!email || !password) {
            return sendAuthError(res, 400, 'Email and password required', 'VALIDATION_ERROR');
        }

        // ============================================
        // SUPER ADMIN AUTHENTICATION (ENV-BASED)
        // ============================================
        const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
        const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;
        
        if (email === superAdminEmail && superAdminEmail && superAdminPassword) {
            // Validate Super Admin password
            let isSuperAdminValid = false;
            
            if (superAdminPassword.startsWith('$2') && superAdminPassword.length >= 60) {
                isSuperAdminValid = await bcrypt.compare(password, superAdminPassword);
            } else {
                isSuperAdminValid = (password === superAdminPassword);
            }
            
            if (!isSuperAdminValid) {
                return sendAuthError(res, 401, 'Invalid credentials', 'INVALID_CREDENTIALS');
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
            
            return sendAuthSuccess(res, {
                code: 'LOGIN_SUCCESS',
                message: 'Super Admin login successful',
                data: {
                    user: {
                        _id: 'super_admin_env',
                        email: superAdminEmail,
                        name: process.env.SUPER_ADMIN_NAME || 'Super Admin',
                        role: 'super_admin',
                        isEnvBased: true
                    },
                    token: superAdminToken,
                    refreshToken,
                    deviceId
                }
            });
        }
        // ============================================

        // ============================================
        // SCHOOL USERS LOGIN (Principal, Teacher, Student, etc.)
        // ============================================

        if (mongoose.connection.readyState !== 1) {
            return sendAuthError(
                res,
                503,
                'Database unavailable. School user login is temporarily unavailable.',
                'DB_UNAVAILABLE'
            );
        }
        
        // First, find user by email
        const user = await User.findOne({ email }).select(
            '+password +refreshToken +loginAttempts +isBlocked +twoFactorSecret +twoFactorEnabled +devices'
        );

        if (!user) {
            return sendAuthError(res, 401, 'Invalid credentials', 'INVALID_CREDENTIALS');
        }

        if (user.role === 'super_admin') {
            return sendAuthError(
                res,
                403,
                'Super Admin is environment-based only. Remove any legacy super_admin DB user and use SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD.',
                'SUPER_ADMIN_ENV_ONLY'
            );
        }

        // If user exists in DB, they already have a schoolCode
        // Normalize stored school code for legacy records
        const normalizedUserSchoolCode = typeof user.schoolCode === 'string' ? user.schoolCode.trim().toUpperCase() : user.schoolCode;

        // Only validate provided schoolCode if it's explicitly given
        if (schoolCode && normalizedUserSchoolCode && normalizedUserSchoolCode !== schoolCode) {
            return sendAuthError(res, 403, 'Invalid school code for this user account', 'INVALID_SCHOOL_CODE');
        }

        // Use normalized schoolCode for all downstream checks
        const userSchoolCode = normalizedUserSchoolCode || schoolCode;
        
        // Verify school exists and is active
        if (userSchoolCode) {
            const school = await School.findOne({ schoolCode: userSchoolCode });
            
            if (!school) {
                return sendAuthError(res, 404, 'School not found. Contact administrator.', 'SCHOOL_NOT_FOUND');
            }
            
            if (!school.isActive) {
                return sendAuthError(res, 403, 'School account is inactive. Contact administrator.', 'SCHOOL_INACTIVE');
            }
            
            // Check subscription status
            if (school.subscription?.status !== 'active') {
                return sendAuthError(res, 403, 'School subscription has expired. Contact administrator.', 'SUBSCRIPTION_EXPIRED');
            }
        }

        // Account status checks
        if (user.isBlocked) {
            await createAuditLog(user._id, 'LOGIN_BLOCKED', { reason: 'Account blocked' }, req);
            return sendAuthError(res, 403, 'Account is blocked. Contact your administrator.', 'ACCOUNT_BLOCKED');
        }

        if (!user.isActive) {
            return sendAuthError(res, 403, 'Account is inactive. Contact your administrator.', 'ACCOUNT_INACTIVE');
        }

        if (user.role !== 'super_admin' && !user.isApproved) {
            return sendAuthError(res, 403, 'Account pending approval. Please contact your administrator.', 'ACCOUNT_NOT_APPROVED');
        }

        if (!user.emailVerified && process.env.REQUIRE_EMAIL_VERIFICATION === 'true') {
            return sendAuthError(res, 403, 'Please verify your email first', 'EMAIL_NOT_VERIFIED');
        }

        // Verify password (handle legacy/plaintext edge cases)
        let isMatch = false;

        if (!user.password) {
            // Account exists without a stored password - force password reset via admin.
            return sendAuthError(
                res,
                403,
                'Account password not set. Contact your school administrator to reset the password.',
                'PASSWORD_NOT_SET'
            );
        }

        if (user.password.startsWith('$2')) {
            // Normal bcrypt hash path
            isMatch = await user.comparePassword(password);
        } else {
            // Legacy plaintext password stored (e.g., from old bulk imports). Upgrade on first successful login.
            if (user.password === password) {
                isMatch = true;
                user.password = password; // pre-save hook will hash
            }
        }

        if (!isMatch) {
            user.loginAttempts = (user.loginAttempts || 0) + 1;
            if (user.loginAttempts >= 5) {
                user.isBlocked = true;
                await user.save();
                await createAuditLog(user._id, 'ACCOUNT_BLOCKED', { reason: 'Too many failed login attempts' }, req);
                return sendAuthError(
                    res,
                    403,
                    'Too many incorrect password attempts. Account blocked. Contact administrator.',
                    'ACCOUNT_BLOCKED'
                );
            }
            await user.save();
            await createAuditLog(user._id, 'LOGIN_FAILED', { attempt: user.loginAttempts }, req);
            return sendAuthError(res, 401, 'Invalid email or password', 'INVALID_CREDENTIALS');
        }

        // Persist any password upgrades performed above
        if (isMatch && !user.password.startsWith('$2')) {
            await user.save();
        }

        // Check 2FA if enabled
        if (user.twoFactorEnabled) {
            if (!twoFactorToken) {
                return res.status(403).json({
                    success: false,
                    code: 'TWO_FA_TOKEN_REQUIRED',
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
                return sendAuthError(res, 401, 'Invalid 2FA token', 'INVALID_TWO_FA_TOKEN');
            }
        }

        // Update user login info
        user.loginAttempts = 0;
        user.lastLogin = new Date();
        user.lastLoginIP = req.ip;
        user.lastUserAgent = req.headers['user-agent'];

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

        // Generate JWT token with user info and schoolCode for SaaS multi-tenancy
        const token = generateToken(user._id, user.role, user.schoolCode, user.permissions, deviceId);
        const refreshToken = generateRefreshToken(user._id, deviceId);

        // Store refresh token
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
        await createAuditLog(user._id, 'LOGIN_SUCCESS', { deviceId, schoolCode: user.schoolCode, role: user.role }, req);

        // Set cookies if configured
        if (process.env.USE_COOKIE === 'true') {
            setTokenCookie(res, token);
            setRefreshTokenCookie(res, refreshToken);
        }

        // Get school details for response
        let schoolDetails = null;
        if (user.schoolCode && user.schoolCode !== 'SUPER_ADMIN') {
            const school = await School.findOne({ schoolCode: user.schoolCode }).select('schoolName subscription logo');
            if (school) {
                schoolDetails = {
                    schoolId: school._id,
                    schoolName: school.schoolName,
                    schoolCode: school.schoolCode,
                    logo: school.logo?.url,
                    plan: school.subscription?.plan || 'trial',
                    subscriptionStatus: school.subscription?.status || 'active',
                    expiryDate: school.subscription?.endDate
                };
            }
        }

        // Return success response with clear structure
        return sendAuthSuccess(res, {
            code: 'LOGIN_SUCCESS',
            message: 'Login successful',
            data: {
                user: {
                    _id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    schoolCode: user.schoolCode,
                    schoolName: user.schoolName,
                    isApproved: user.isApproved,
                    emailVerified: user.emailVerified,
                    permissions: user.permissions,
                    schoolDetails
                },
                token: process.env.USE_COOKIE === 'true' ? undefined : token,
                refreshToken: process.env.USE_COOKIE === 'true' ? undefined : refreshToken,
                deviceId
            }
        });

    } catch (error) {
        console.error('❌ Login error:', error.message);
        console.error('Stack:', error.stack);
        return sendAuthError(
            res,
            500,
            'Login failed. Please try again.',
            'LOGIN_FAILED',
            process.env.NODE_ENV === 'development' ? error.message : undefined
        );
    }
};

// @desc    Refresh Token
// @route   POST /api/auth/refresh
// @access  Public
exports.refreshToken = async (req, res) => {
    const { refreshToken } = req.body;
    const cookieToken = req.cookies?.refreshToken;
    const deviceId = req.headers['x-device-id'] || req.body?.deviceId;

    try {
        const token = refreshToken || cookieToken;

        if (!token) {
            return sendAuthError(res, 401, 'No refresh token', 'REFRESH_TOKEN_REQUIRED');
        }

        const decoded = jwt.verify(token, getRefreshSecret());

        if (decoded.deviceId && decoded.deviceId !== deviceId) {
            await createAuditLog(decoded.id, 'REFRESH_TOKEN_DEVICE_MISMATCH', {}, req);
            return sendAuthError(res, 401, 'Invalid device', 'INVALID_DEVICE');
        }

        if (decoded.id === 'super_admin_env') {
            const newToken = jwt.sign(
                {
                    id: 'super_admin_env',
                    role: 'super_admin',
                    schoolCode: 'SUPER_ADMIN',
                    isEnvBased: true
                },
                getJwtSecret(),
                { expiresIn: process.env.JWT_EXPIRE || '7d' }
            );
            const newRefreshToken = generateRefreshToken('super_admin_env', deviceId);
            if (process.env.USE_COOKIE === 'true') {
                setTokenCookie(res, newToken);
                setRefreshTokenCookie(res, newRefreshToken);
            }
            return sendAuthSuccess(res, {
                code: 'TOKEN_REFRESHED',
                message: 'Token refreshed successfully',
                data: {
                    token: process.env.USE_COOKIE === 'true' ? undefined : newToken,
                    refreshToken: process.env.USE_COOKIE === 'true' ? undefined : newRefreshToken
                },
                // Keep legacy flat shape for existing clients.
                legacyFields: {
                    token: process.env.USE_COOKIE === 'true' ? undefined : newToken,
                    refreshToken: process.env.USE_COOKIE === 'true' ? undefined : newRefreshToken
                }
            });
        }

        const user = await User.findOne({ _id: decoded.id, 'sessions.token': token });

        if (!user) {
            return sendAuthError(res, 401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
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

        return sendAuthSuccess(res, {
            code: 'TOKEN_REFRESHED',
            message: 'Token refreshed successfully',
            data: {
                token: process.env.USE_COOKIE === 'true' ? undefined : newToken,
                refreshToken: process.env.USE_COOKIE === 'true' ? undefined : newRefreshToken
            },
            legacyFields: {
                token: process.env.USE_COOKIE === 'true' ? undefined : newToken,
                refreshToken: process.env.USE_COOKIE === 'true' ? undefined : newRefreshToken
            }
        });

    } catch (error) {
        console.error('Refresh error:', error);
        if (error?.name === 'TokenExpiredError' || error?.name === 'JsonWebTokenError') {
            return sendAuthError(res, 401, 'Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
        }

        if (isDbUnavailableError(error)) {
            return sendAuthError(res, 503, 'Database unavailable. Please try again shortly.', 'DB_UNAVAILABLE');
        }

        return sendAuthError(res, 500, 'Failed to refresh token', 'TOKEN_REFRESH_FAILED');
    }
};

// @desc    Logout User
// @route   POST /api/auth/logout
// @access  Private
exports.logoutUser = async (req, res) => {
    const refreshToken = req.body.refreshToken || req.cookies?.refreshToken;
    const deviceId = req.headers['x-device-id'] || req.body?.deviceId;

    try {
        if (refreshToken && req.user && !req.user.isEnvBased) {
            await User.updateOne(
                { _id: req.user._id },
                { $pull: { sessions: { token: refreshToken } }, $set: { refreshToken: null } }
            );
            await createAuditLog(req.user._id, 'LOGOUT', { deviceId }, req);
        } else if (req.user?.isEnvBased) {
            await createAuditLog('super_admin_env', 'LOGOUT', { deviceId }, req);
        }

        res.clearCookie('token');
        res.clearCookie('refreshToken');
        return sendAuthSuccess(res, {
            code: 'LOGOUT_SUCCESS',
            message: 'Logged out successfully',
            data: null
        });

    } catch (error) {
        console.error('Logout error:', error);
        if (isDbUnavailableError(error)) {
            return sendAuthError(res, 503, 'Database unavailable. Please try again shortly.', 'DB_UNAVAILABLE');
        }

        return sendAuthError(res, 500, 'Logout failed', 'LOGOUT_FAILED');
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
        if (req.user.isEnvBased && req.user._id === 'super_admin_env') {
            await createAuditLog('super_admin_env', 'PROFILE_VIEW', {}, req);
            return sendAuthSuccess(res, {
                code: 'PROFILE_FETCHED',
                message: 'Profile fetched successfully',
                data: {
                    _id: 'super_admin_env',
                    name: req.user.name,
                    email: req.user.email,
                    role: 'super_admin',
                    schoolCode: 'SUPER_ADMIN',
                    isEnvBased: true,
                    emailVerified: true,
                    isApproved: true,
                    activeSessions: 0
                }
            });
        }

        if (mongoose.connection.readyState !== 1) {
            return sendAuthError(res, 503, 'Database unavailable. Please try again shortly.', 'DB_UNAVAILABLE');
        }

        // Use Mongoose pattern
        const user = await User.findById(req.user._id).select(USER_SAFE_RESPONSE_PROJECTION);

        if (!user) {
            return sendAuthError(res, 404, 'User not found', 'USER_NOT_FOUND');
        }

        const sessionCounter = await User.findById(req.user._id).select('sessions').lean();
        const activeSessions = Array.isArray(sessionCounter?.sessions) ? sessionCounter.sessions.length : 0;
        let school = null;
        if (user.schoolCode) {
            school = await School.findOne({ schoolCode: user.schoolCode }).select('schoolName subscription logo address phone email');
        }

        await createAuditLog(user._id, 'PROFILE_VIEW', {}, req);

        // Use Mongoose toObject method
        const userData = sanitizeUserForResponse(user);

        return sendAuthSuccess(res, {
            code: 'PROFILE_FETCHED',
            message: 'Profile fetched successfully',
            data: {
                ...userData,
                activeSessions,
                ...(school && { school })
            }
        });

    } catch (error) {
        console.error('Profile error:', error);
        return handleAuthError(res, error, 'Failed to fetch profile');
    }
};

// @desc    Update Profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateUserProfile = async (req, res) => {
    const { name, phone, address, profileImage } = req.body;

    try {
        if (req.user.isEnvBased) {
            return sendAuthError(
                res,
                403,
                'Platform Super Admin profile is managed via environment variables (e.g. SUPER_ADMIN_NAME).',
                'ENV_USER_PROFILE_READ_ONLY'
            );
        }

        if (mongoose.connection.readyState !== 1) {
            return sendAuthError(res, 503, 'Database unavailable. Please try again shortly.', 'DB_UNAVAILABLE');
        }

        const user = await User.findById(req.user._id);
        if (!user) {
            return sendAuthError(res, 404, 'User not found', 'USER_NOT_FOUND');
        }

        if (name) user.name = name;
        if (phone) user.phone = phone;
        if (address) user.address = address;
        if (profileImage) user.profileImage = profileImage;

        await user.save();
        await createAuditLog(user._id, 'PROFILE_UPDATE', { fields: { name, phone, address } }, req);

        return sendAuthSuccess(res, {
            code: 'PROFILE_UPDATED',
            message: 'Profile updated',
            data: {
                user: {
                    name: user.name,
                    email: user.email,
                    phone: user.phone,
                    address: user.address,
                    profileImage: user.profileImage
                }
            }
        });

    } catch (error) {
        console.error('Update profile error:', error);
        return handleAuthError(res, error, 'Failed to update profile');
    }
};

// @desc    Change Password (Self)
// @route   PUT /api/auth/change-password
// @access  Private (All authenticated users)
/**
 * Allows any authenticated user to change their own password
 * Requires verification of current password
 * Invalidates all sessions after password change
 */
exports.changePassword = async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    try {
        if (req.user.isEnvBased) {
            return res.status(403).json({
                success: false,
                message: 'Super Admin password is managed in hosting environment (SUPER_ADMIN_PASSWORD), not in the app.'
            });
        }

        // ===== VALIDATION =====
        if (!currentPassword || !newPassword) {
            return res.status(400).json({
                success: false,
                message: 'Current password and new password are required'
            });
        }

        if (!confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Password confirmation is required'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New password and confirmation do not match'
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

        // ===== VERIFY CURRENT PASSWORD =====
        const user = await User.findById(req.user._id).select('+password');
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

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

        // ===== USE PASSWORD SERVICE FOR CONSISTENCY =====
        const passwordService = require('../services/passwordResetService');
        const deviceId = req.headers['x-device-id'];

        const result = await passwordService.changeUserPassword({
            userId: req.user._id,
            currentPassword,
            newPassword,
            deviceId,
            req
        });

        res.json(result);

    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to change password'
        });
    }
};

// @desc    Forgot Password
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res) => {
    const { email } = req.body;

    try {
        const user = await User.findOne({ email });

        if (user) {
            const resetToken = crypto.randomBytes(32).toString('hex');
            user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
            user.resetPasswordExpire = Date.now() + 10 * 60 * 1000;
            await user.save();

            const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
            
            if (process.env.NODE_ENV === 'development') {
                // In development, perform no-op email path and record bypassed status
                await createAuditLog(user._id, 'PASSWORD_RESET_REQUESTED', {
                    email,
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
        }

        res.json({
            message: 'If an account with this email exists, a password reset link has been sent.'
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
    const token = req.params.token || req.body?.token;
    const { password } = req.body;

    try {
        if (!token) {
            return res.status(400).json({ message: 'Reset token is required' });
        }
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
    const token = req.params.token || req.body?.token;

    try {
        if (!token) {
            return res.status(400).json({ message: 'Verification token is required' });
        }
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
        const userId = getAuthenticatedUserId(req, res);
        if (!userId) {
            return;
        }

        if (mongoose.connection.readyState !== 1) {
            return sendAuthError(res, 503, 'Database unavailable. Please try again shortly.', 'DB_UNAVAILABLE');
        }

        const user = await User.findById(userId).select('email twoFactorEnabled');
        if (!user) {
            return sendAuthError(res, 404, 'User not found', 'USER_NOT_FOUND');
        }

        if (user.twoFactorEnabled) {
            return sendAuthError(res, 400, '2FA is already enabled for this account', 'TWO_FA_ALREADY_ENABLED');
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

        return sendAuthSuccess(res, {
            code: 'TWO_FA_SETUP_INITIATED',
            message: '2FA setup started. Scan the QR code and verify to enable.',
            data: {
                secret: secret.base32,
                qrCode: dataUrl
            },
            // Keep legacy fields for existing clients.
            legacyFields: {
                secret: secret.base32,
                qrCode: dataUrl
            }
        });
    } catch (error) {
        console.error('2FA setup error:', error);
        return handleAuthError(res, error, 'Failed to set up 2FA');
    }
};

// @desc    Verify and Enable 2FA
// @route   POST /api/auth/verify-2fa
// @access  Private
exports.verifyAndEnable2FA = async (req, res) => {
    const { token } = req.body;

    try {
        const userId = getAuthenticatedUserId(req, res);
        if (!userId) {
            return;
        }

        if (mongoose.connection.readyState !== 1) {
            return sendAuthError(res, 503, 'Database unavailable. Please try again shortly.', 'DB_UNAVAILABLE');
        }

        if (!token || typeof token !== 'string') {
            return sendAuthError(res, 400, '2FA token is required', 'TWO_FA_TOKEN_REQUIRED');
        }

        const user = await User.findById(userId).select('+twoFactorSecret twoFactorEnabled');
        if (!user || !user.twoFactorSecret) {
            return sendAuthError(
                res,
                400,
                '2FA setup not started or expired. Please set up 2FA again.',
                'TWO_FA_SETUP_NOT_FOUND'
            );
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: token.trim()
        });

        if (!verified) {
            return sendAuthError(res, 401, 'Invalid 2FA token', 'INVALID_TWO_FA_TOKEN');
        }

        user.twoFactorEnabled = true;
        await user.save();

        await createAuditLog(user._id, '2FA_ENABLED', {}, req);

        return sendAuthSuccess(res, {
            code: 'TWO_FA_ENABLED',
            message: '2FA enabled successfully',
            data: null
        });

    } catch (error) {
        console.error('Verify 2FA error:', error);
        return handleAuthError(res, error, 'Failed to verify 2FA');
    }
};

// @desc    Disable 2FA
// @route   POST /api/auth/disable-2fa
// @access  Private
exports.disable2FA = async (req, res) => {
    const { password, token } = req.body;

    try {
        const userId = getAuthenticatedUserId(req, res);
        if (!userId) {
            return;
        }

        if (mongoose.connection.readyState !== 1) {
            return sendAuthError(res, 503, 'Database unavailable. Please try again shortly.', 'DB_UNAVAILABLE');
        }

        if (!password || !token) {
            return sendAuthError(
                res,
                400,
                'Password and 2FA token are required',
                'PASSWORD_AND_TWO_FA_TOKEN_REQUIRED'
            );
        }

        const user = await User.findById(userId).select('+password +twoFactorSecret twoFactorEnabled');
        if (!user) {
            return sendAuthError(res, 404, 'User not found', 'USER_NOT_FOUND');
        }

        if (!user.twoFactorEnabled || !user.twoFactorSecret) {
            return sendAuthError(res, 400, '2FA is not enabled for this account', 'TWO_FA_NOT_ENABLED');
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return sendAuthError(res, 401, 'Invalid password', 'INVALID_PASSWORD');
        }

        const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret,
            encoding: 'base32',
            token: token.trim()
        });

        if (!verified) {
            return sendAuthError(res, 401, 'Invalid 2FA token', 'INVALID_TWO_FA_TOKEN');
        }

        user.twoFactorEnabled = false;
        user.twoFactorSecret = undefined;
        await user.save();

        await createAuditLog(user._id, '2FA_DISABLED', {}, req);

        return sendAuthSuccess(res, {
            code: 'TWO_FA_DISABLED',
            message: '2FA disabled successfully',
            data: null
        });

    } catch (error) {
        console.error('Disable 2FA error:', error);
        return handleAuthError(res, error, 'Failed to disable 2FA');
    }
};

// @desc    Get All Sessions
// @route   GET /api/auth/sessions
// @access  Private
exports.getSessions = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('sessions devices');
        const currentDeviceId = req.headers['x-device-id'];
        const safeSessions = (user?.sessions || []).map((session) => ({
            device: session.device || 'Unknown device',
            deviceId: session.deviceId || null,
            ip: session.ip || null,
            lastActive: session.lastActive || null
        }));
        const safeDevices = (user?.devices || []).map((device) => ({
            deviceId: device.deviceId || null,
            name: device.name || 'Unknown device',
            lastActive: device.lastActive || null
        }));

        res.json({
            currentDeviceId,
            sessions: safeSessions,
            devices: safeDevices
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

