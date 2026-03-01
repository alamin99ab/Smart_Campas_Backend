/**
 * 🏢 SUPER ADMIN CONTROLLER
 * Industry-level Super Admin management for Smart Campus System
 */

const School = require('../models/School');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Routine = require('../models/Routine');
const AuditLog = require('../models/AuditLog');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const speakeasy = require('speakeasy');

// Helper functions for token generation
const generateToken = (id, role, schoolCode, permissions = [], deviceId = null) => {
    return jwt.sign(
        { id, role, schoolCode, permissions, deviceId },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );
};

const generateRefreshToken = (id, deviceId = null) => {
    const getRefreshSecret = () => {
        const secret = process.env.JWT_REFRESH_SECRET;
        if (process.env.NODE_ENV === 'production' && !secret) {
            throw new Error('JWT_REFRESH_SECRET is required in production');
        }
        return secret || 'refresh_secret';
    };
    
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

const generateSecurePassword = (length = 16) => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
};

/**
 * @desc    Super Admin Login (Enhanced)
 * @route   POST /api/super-admin/login
 * @access  Public
 */
exports.superAdminLogin = async (req, res) => {
    try {
        const { email, password, twoFactorToken } = req.body;
        const deviceId = req.headers['x-device-id'] || crypto.randomBytes(16).toString('hex');

        // Input validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find super admin
        const superAdmin = await User.findOne({ 
            email, 
            role: 'super_admin' 
        }).select(
            '+password +refreshToken +loginAttempts +isBlocked +twoFactorSecret +twoFactorEnabled +devices'
        );

        if (!superAdmin) {
            await AuditLog.create({
                action: 'SUPER_ADMIN_LOGIN_FAILED',
                details: `Login attempt with non-existent email: ${email}`,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Security checks
        if (superAdmin.isBlocked) {
            await AuditLog.create({
                userId: superAdmin._id,
                action: 'BLOCKED_LOGIN_ATTEMPT',
                details: 'Blocked super admin attempted login',
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
            return res.status(403).json({
                success: false,
                message: 'Account is blocked'
            });
        }

        // Verify password
        const isMatch = await superAdmin.comparePassword(password);
        if (!isMatch) {
            superAdmin.loginAttempts = (superAdmin.loginAttempts || 0) + 1;
            
            // Block after 5 failed attempts
            if (superAdmin.loginAttempts >= 5) {
                superAdmin.isBlocked = true;
                await superAdmin.save();
                
                await AuditLog.create({
                    userId: superAdmin._id,
                    action: 'ACCOUNT_AUTO_BLOCKED',
                    details: 'Super admin account auto-blocked due to multiple failed attempts',
                    ip: req.ip,
                    userAgent: req.headers['user-agent']
                });
                
                return res.status(403).json({
                    success: false,
                    message: 'Account blocked due to too many failed attempts'
                });
            }
            
            await superAdmin.save();
            await AuditLog.create({
                userId: superAdmin._id,
                action: 'SUPER_ADMIN_LOGIN_FAILED',
                details: `Invalid password. Attempt ${superAdmin.loginAttempts}/5`,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
            
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Two-factor authentication check
        if (superAdmin.twoFactorEnabled) {
            if (!twoFactorToken) {
                return res.status(403).json({
                    success: false,
                    message: 'Two-factor authentication token required',
                    twoFactorRequired: true
                });
            }

            const verified = speakeasy.totp.verify({
                secret: superAdmin.twoFactorSecret,
                encoding: 'base32',
                token: twoFactorToken
            });

            if (!verified) {
                await AuditLog.create({
                    userId: superAdmin._id,
                    action: '2FA_VERIFICATION_FAILED',
                    details: 'Invalid 2FA token for super admin login',
                    ip: req.ip,
                    userAgent: req.headers['user-agent']
                });
                
                return res.status(401).json({
                    success: false,
                    message: 'Invalid two-factor authentication token'
                });
            }
        }

        // Reset login attempts on successful login
        superAdmin.loginAttempts = 0;
        superAdmin.lastLogin = new Date();
        superAdmin.lastLoginIP = req.ip;
        superAdmin.lastUserAgent = req.headers['user-agent'];

        // Device management
        const deviceIndex = superAdmin.devices.findIndex(d => d.deviceId === deviceId);
        if (deviceIndex === -1) {
            // New device - register it
            superAdmin.devices.push({
                deviceId,
                name: req.headers['user-agent']?.substring(0, 100) || 'Unknown device',
                lastActive: new Date()
            });
            
            await AuditLog.create({
                userId: superAdmin._id,
                action: 'NEW_DEVICE_REGISTERED',
                details: `New device registered for super admin: ${deviceId}`,
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
        } else {
            // Update existing device
            superAdmin.devices[deviceIndex].lastActive = new Date();
        }

        // Generate tokens
        const token = generateToken(
            superAdmin._id, 
            superAdmin.role, 
            superAdmin.schoolCode, 
            superAdmin.permissions, 
            deviceId
        );
        const refreshToken = generateRefreshToken(superAdmin._id, deviceId);

        // Session management
        superAdmin.refreshToken = refreshToken;
        superAdmin.sessions = superAdmin.sessions || [];
        
        // Limit sessions to 5 active sessions
        if (superAdmin.sessions.length >= 5) {
            superAdmin.sessions.shift();
        }
        
        superAdmin.sessions.push({
            token: refreshToken,
            device: req.headers['user-agent']?.substring(0, 200) || 'Unknown device',
            deviceId,
            ip: req.ip,
            lastActive: new Date()
        });

        await superAdmin.save();

        // Log successful login
        await AuditLog.create({
            userId: superAdmin._id,
            action: 'SUPER_ADMIN_LOGIN_SUCCESS',
            details: `Super admin login from device: ${deviceId}`,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        // Set cookies if using cookie-based auth
        if (process.env.USE_COOKIE === 'true') {
            setTokenCookie(res, token);
            setRefreshTokenCookie(res, refreshToken);
        }

        res.json({
            success: true,
            message: 'Super admin login successful',
            data: {
                _id: superAdmin._id,
                name: superAdmin.name,
                email: superAdmin.email,
                role: superAdmin.role,
                permissions: superAdmin.permissions,
                twoFactorEnabled: superAdmin.twoFactorEnabled,
                deviceId,
                lastLogin: superAdmin.lastLogin,
                token: process.env.USE_COOKIE === 'true' ? undefined : token,
                refreshToken: process.env.USE_COOKIE === 'true' ? undefined : refreshToken
            }
        });

    } catch (error) {
        console.error('Super admin login error:', error);
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        });
    }
};

/**
 * @desc    Get Super Admin Dashboard Data
 * @route   GET /api/super-admin/dashboard
 * @access  Super Admin only
 */
exports.getSuperAdminDashboard = async (req, res) => {
    try {
        // System overview statistics
        const [
            totalSchools,
            activeSchools,
            totalPrincipals,
            totalTeachers,
            totalStudents,
            activeStudents,
            totalUsers,
            recentLogins
        ] = await Promise.all([
            School.countDocuments(),
            School.countDocuments({ isActive: true }),
            User.countDocuments({ role: 'principal' }),
            User.countDocuments({ role: 'teacher' }),
            User.countDocuments({ role: 'student' }),
            User.countDocuments({ role: 'student', isActive: true }),
            User.countDocuments(),
            AuditLog.find({ action: 'LOGIN_SUCCESS' })
                .populate('userId', 'name email role')
                .sort({ createdAt: -1 })
                .limit(10)
        ]);

        // Recent system activity
        const recentActivity = await AuditLog.find()
            .populate('userId', 'name email role')
            .sort({ createdAt: -1 })
            .limit(20);

        // School subscription distribution
        const subscriptionStats = await School.aggregate([
            {
                $group: {
                    _id: '$subscriptionType',
                    count: { $sum: 1 },
                    schools: { $push: '$schoolName' }
                }
            }
        ]);

        // User role distribution
        const roleStats = await User.aggregate([
            {
                $group: {
                    _id: '$role',
                    count: { $sum: 1 }
                }
            }
        ]);

        // System health metrics
        const systemHealth = {
            uptime: process.uptime(),
            memoryUsage: process.memoryUsage(),
            nodeVersion: process.version,
            platform: process.platform
        };

        // Recent security events
        const securityEvents = await AuditLog.find({
            action: { $in: ['UNAUTHORIZED_ACCESS', 'BLOCKED_LOGIN_ATTEMPT', 'SUSPICIOUS_ACTIVITY'] }
        })
        .populate('userId', 'name email')
        .sort({ createdAt: -1 })
        .limit(10);

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    totalSchools,
                    activeSchools,
                    totalPrincipals,
                    totalTeachers,
                    totalStudents,
                    activeStudents,
                    totalUsers
                },
                recentLogins,
                recentActivity,
                subscriptionStats,
                roleStats,
                systemHealth,
                securityEvents
            }
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving dashboard data',
            error: error.message
        });
    }
};

/**
 * @desc    Manage System Settings
 * @route   PUT /api/super-admin/system-settings
 * @access  Super Admin only
 */
exports.updateSystemSettings = async (req, res) => {
    try {
        const { 
            maintenanceMode,
            registrationEnabled,
            emailVerificationRequired,
            maxLoginAttempts,
            sessionTimeout,
            systemNotifications 
        } = req.body;

        // Create system settings document if it doesn't exist
        const SystemSettings = require('../models/SystemSettings');
        
        const settings = await SystemSettings.findOneAndUpdate(
            { key: 'system_settings' },
            {
                key: 'system_settings',
                value: {
                    maintenanceMode: maintenanceMode || false,
                    registrationEnabled: registrationEnabled !== false,
                    emailVerificationRequired: emailVerificationRequired !== false,
                    maxLoginAttempts: maxLoginAttempts || 5,
                    sessionTimeout: sessionTimeout || 7,
                    systemNotifications: systemNotifications || {},
                    lastUpdatedBy: req.user._id,
                    lastUpdatedAt: new Date()
                }
            },
            { upsert: true, new: true }
        );

        // Log the system setting change
        await AuditLog.create({
            userId: req.user._id,
            action: 'SYSTEM_SETTINGS_UPDATED',
            details: `System settings updated by super admin`,
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(200).json({
            success: true,
            message: 'System settings updated successfully',
            data: settings.value
        });

    } catch (error) {
        console.error('System settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating system settings',
            error: error.message
        });
    }
};

/**
 * @desc    Get System Settings
 * @route   GET /api/super-admin/system-settings
 * @access  Super Admin only
 */
exports.getSystemSettings = async (req, res) => {
    try {
        const SystemSettings = require('../models/SystemSettings');
        const settings = await SystemSettings.findOne({ key: 'system_settings' });

        if (!settings) {
            // Return default settings if none exist
            return res.status(200).json({
                success: true,
                data: {
                    maintenanceMode: false,
                    registrationEnabled: true,
                    emailVerificationRequired: false,
                    maxLoginAttempts: 5,
                    sessionTimeout: 7,
                    systemNotifications: {}
                }
            });
        }

        res.status(200).json({
            success: true,
            data: settings.value
        });

    } catch (error) {
        console.error('Get system settings error:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving system settings',
            error: error.message
        });
    }
};
exports.createSchool = async (req, res) => {
    try {
        const { 
            schoolName, 
            schoolCode, 
            address, 
            phone, 
            email,
            principalName,
            principalEmail,
            principalPhone,
            principalPassword
        } = req.body;

        // Check if school code already exists
        const existingSchool = await School.findOne({ schoolCode });
        if (existingSchool) {
            return res.status(400).json({
                success: false,
                message: 'School code already exists'
            });
        }

        // Create school
        const school = new School({
            schoolName,
            schoolCode,
            address,
            phone,
            email,
            status: 'Active',
            subscriptionType: 'Premium',
            maxStudents: 2000,
            isActive: true
        });

        await school.save();

        // Create principal account
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(principalPassword, salt);

        const principal = new User({
            name: principalName,
            email: principalEmail,
            password: hashedPassword,
            role: 'principal',
            phone: principalPhone,
            schoolCode: schoolCode,
            isActive: true,
            isEmailVerified: true,
            permissions: [
                'manage_students',
                'manage_teachers',
                'manage_classes',
                'manage_subjects',
                'manage_routine',
                'view_reports',
                'manage_attendance',
                'manage_results'
            ]
        });

        await principal.save();

        // Update school with principal
        school.principalId = principal._id;
        await school.save();

        // Log audit
        await AuditLog.create({
            userId: req.user.id,
            action: 'CREATE_SCHOOL',
            details: `Created school: ${schoolName} (${schoolCode})`,
            schoolCode: schoolCode
        });

        res.status(201).json({
            success: true,
            message: 'School and principal created successfully',
            data: {
                school,
                principal: {
                    id: principal._id,
                    name: principal.name,
                    email: principal.email,
                    role: principal.role
                }
            }
        });

    } catch (error) {
        console.error('Error creating school:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating school',
            error: error.message
        });
    }
};

/**
 * @desc    Get all schools
 * @route   GET /api/super-admin/schools
 * @access  Super Admin only
 */
exports.getAllSchools = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, status } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = {};
        if (search) {
            query.$or = [
                { schoolName: { $regex: search, $options: 'i' } },
                { schoolCode: { $regex: search, $options: 'i' } }
            ];
        }
        if (status) {
            query.status = status;
        }

        const schools = await School.find(query)
            .populate('principal', 'name email phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await School.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                schools,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Error getting schools:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving schools',
            error: error.message
        });
    }
};

/**
 * @desc    Update school
 * @route   PUT /api/super-admin/schools/:id
 * @access  Super Admin only
 */
exports.updateSchool = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const school = await School.findByIdAndUpdate(
            id,
            { ...updates, lastModifiedBy: req.user.id },
            { new: true, runValidators: true }
        );

        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        // Log audit
        await AuditLog.create({
            userId: req.user.id,
            action: 'UPDATE_SCHOOL',
            details: `Updated school: ${school.schoolName} (${school.schoolCode})`,
            schoolCode: school.schoolCode
        });

        res.status(200).json({
            success: true,
            message: 'School updated successfully',
            data: school
        });

    } catch (error) {
        console.error('Error updating school:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating school',
            error: error.message
        });
    }
};

/**
 * @desc    Delete school
 * @route   DELETE /api/super-admin/schools/:id
 * @access  Super Admin only
 */
exports.deleteSchool = async (req, res) => {
    try {
        const { id } = req.params;

        const school = await School.findById(id);
        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        // Check if school has active students
        const activeStudents = await User.countDocuments({
            schoolCode: school.schoolCode,
            role: 'student',
            isActive: true
        });

        if (activeStudents > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete school with active students'
            });
        }

        await School.findByIdAndDelete(id);

        // Log audit
        await AuditLog.create({
            userId: req.user.id,
            action: 'DELETE_SCHOOL',
            details: `Deleted school: ${school.schoolName} (${school.schoolCode})`,
            schoolCode: school.schoolCode
        });

        res.status(200).json({
            success: true,
            message: 'School deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting school:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting school',
            error: error.message
        });
    }
};

/**
 * @desc    Get system analytics
 * @route   GET /api/super-admin/analytics
 * @access  Super Admin only
 */
exports.getSystemAnalytics = async (req, res) => {
    try {
        const totalSchools = await School.countDocuments();
        const activeSchools = await School.countDocuments({ isActive: true });
        const totalPrincipals = await User.countDocuments({ role: 'principal' });
        const totalTeachers = await User.countDocuments({ role: 'teacher' });
        const totalStudents = await User.countDocuments({ role: 'student' });
        const activeStudents = await User.countDocuments({ 
            role: 'student', 
            isActive: true 
        });
        const activeUsers = await User.countDocuments({ isActive: true });

        // Total revenue (from School.amountPaid – SaaS billing)
        const revenueResult = await School.aggregate([
            { $group: { _id: null, totalRevenue: { $sum: { $ifNull: ['$amountPaid', 0] } } } }
        ]);
        const totalRevenue = revenueResult[0]?.totalRevenue ?? 0;

        // Storage usage placeholder (MB) – can be replaced with real file-storage stats
        const storageUsageMB = 0;

        // Get recent activity
        const recentActivity = await AuditLog.find()
            .populate('user', 'name role')
            .sort({ createdAt: -1 })
            .limit(10);

        // Get school distribution by subscription plan
        const schoolsByType = await School.aggregate([
            { $group: { _id: '$subscription.plan', count: { $sum: 1 } } }
        ]);

        // Get student growth (last 6 months)
        const sixMonthsAgo = new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000);
        const studentGrowth = await User.aggregate([
            { $match: { role: 'student', createdAt: { $gte: sixMonthsAgo } } },
            { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    totalSchools,
                    activeSchools,
                    activeUsers,
                    totalPrincipals,
                    totalTeachers,
                    totalStudents,
                    activeStudents,
                    totalRevenue,
                    storageUsageMB
                },
                recentActivity,
                schoolsByType,
                studentGrowth
            }
        });

    } catch (error) {
        console.error('Error getting analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving analytics',
            error: error.message
        });
    }
};

/**
 * @desc    Get all users across all schools
 * @route   GET /api/super-admin/users
 * @access  Super Admin only
 */
/**
 * @desc    Create User (Super Admin only)
 * @route   POST /api/super-admin/users
 * @access  Super Admin only
 */
exports.createUser = async (req, res) => {
    try {
        const { name, email, password, role, schoolCode, phone, permissions } = req.body;

        // Input validation
        if (!name || !email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: 'Name, email, password, and role are required'
            });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            });
        }

        // Validate role
        const validRoles = ['super_admin', 'admin', 'principal', 'teacher', 'student', 'parent'];
        if (!validRoles.includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid role'
            });
        }

        // For school-specific roles, validate school code
        if (['principal', 'teacher', 'student', 'parent'].includes(role)) {
            if (!schoolCode) {
                return res.status(400).json({
                    success: false,
                    message: 'School code required for this role'
                });
            }

            const school = await School.findOne({ schoolCode });
            if (!school) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid school code'
                });
            }
        }

        // Hash password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const user = new User({
            name,
            email,
            password: hashedPassword,
            role,
            schoolCode: schoolCode || 'SYSTEM',
            phone,
            permissions: permissions || [],
            isActive: true,
            isEmailVerified: true,
            isApproved: ['principal', 'super_admin'].includes(role)
        });

        await user.save();

        // Log audit
        await AuditLog.create({
            userId: req.user._id,
            action: 'USER_CREATED',
            details: `Created user: ${name} (${email}) with role: ${role}`,
            schoolCode: schoolCode || 'SYSTEM'
        });

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                schoolCode: user.schoolCode,
                permissions: user.permissions,
                isActive: user.isActive,
                isApproved: user.isApproved
            }
        });

    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating user',
            error: error.message
        });
    }
};

/**
 * @desc    Update User (Super Admin only)
 * @route   PUT /api/super-admin/users/:id
 * @access  Super Admin only
 */
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Don't allow password updates through this endpoint
        delete updates.password;

        const user = await User.findByIdAndUpdate(
            id,
            { ...updates, lastModifiedBy: req.user._id },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Log audit
        await AuditLog.create({
            userId: req.user._id,
            action: 'USER_UPDATED',
            details: `Updated user: ${user.name} (${user.email})`,
            schoolCode: user.schoolCode
        });

        res.status(200).json({
            success: true,
            message: 'User updated successfully',
            data: user
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating user',
            error: error.message
        });
    }
};

/**
 * @desc    Delete User (Super Admin only)
 * @route   DELETE /api/super-admin/users/:id
 * @access  Super Admin only
 */
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Prevent deletion of super admin
        if (user.role === 'super_admin') {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete super admin account'
            });
        }

        await User.findByIdAndDelete(id);

        // Log audit
        await AuditLog.create({
            userId: req.user._id,
            action: 'USER_DELETED',
            details: `Deleted user: ${user.name} (${user.email})`,
            schoolCode: user.schoolCode
        });

        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting user',
            error: error.message
        });
    }
};

/**
 * @desc    Block/Unblock User (Super Admin only)
 * @route   PUT /api/super-admin/users/:id/block
 * @access  Super Admin only
 */
exports.toggleUserBlock = async (req, res) => {
    try {
        const { id } = req.params;
        const { isBlocked, reason } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Prevent blocking super admin
        if (user.role === 'super_admin') {
            return res.status(400).json({
                success: false,
                message: 'Cannot block super admin account'
            });
        }

        user.isBlocked = isBlocked;
        if (isBlocked) {
            user.loginAttempts = 0;
            user.sessions = [];
            user.refreshToken = null;
        }

        await user.save();

        // Log audit
        await AuditLog.create({
            userId: req.user._id,
            action: isBlocked ? 'USER_BLOCKED' : 'USER_UNBLOCKED',
            details: `${isBlocked ? 'Blocked' : 'Unblocked'} user: ${user.name} (${user.email})${reason ? ` - Reason: ${reason}` : ''}`,
            schoolCode: user.schoolCode
        });

        res.status(200).json({
            success: true,
            message: `User ${isBlocked ? 'blocked' : 'unblocked'} successfully`,
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                isBlocked: user.isBlocked
            }
        });

    } catch (error) {
        console.error('Toggle user block error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating user status',
            error: error.message
        });
    }
};

/**
 * @desc    Force Password Reset for User (Super Admin only)
 * @route   POST /api/super-admin/users/:id/reset-password
 * @access  Super Admin only
 */
exports.forcePasswordReset = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;

        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Generate new password if not provided
        const password = newPassword || generateSecurePassword();
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);

        user.password = hashedPassword;
        user.loginAttempts = 0;
        user.isBlocked = false;
        user.sessions = [];
        user.refreshToken = null;
        user.passwordChangedAt = new Date();

        await user.save();

        // Log audit
        await AuditLog.create({
            userId: req.user._id,
            action: 'PASSWORD_RESET_FORCED',
            details: `Forced password reset for user: ${user.name} (${user.email})`,
            schoolCode: user.schoolCode
        });

        res.status(200).json({
            success: true,
            message: 'Password reset successful',
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                newPassword: password
            }
        });

    } catch (error) {
        console.error('Force password reset error:', error);
        res.status(500).json({
            success: false,
            message: 'Error resetting password',
            error: error.message
        });
    }
};

/**
 * @desc    Get User Details (Super Admin only)
 * @route   GET /api/super-admin/users/:id
 * @access  Super Admin only
 */
exports.getUserDetails = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id)
            .select('-password -refreshToken -emailVerificationToken -resetPasswordToken -twoFactorSecret')
            .populate('schoolCode', 'schoolName address phone email');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user activity logs
        const recentActivity = await AuditLog.find({ userId: id })
            .sort({ createdAt: -1 })
            .limit(20);

        res.status(200).json({
            success: true,
            data: {
                user,
                recentActivity,
                activeSessions: (user.sessions || []).length,
                registeredDevices: (user.devices || []).length
            }
        });

    } catch (error) {
        console.error('Get user details error:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving user details',
            error: error.message
        });
    }
};

/**
 * @desc    Get Audit Logs (Super Admin only)
 * @route   GET /api/super-admin/audit-logs
 * @access  Super Admin only
 */
exports.getAuditLogs = async (req, res) => {
    try {
        const { page = 1, limit = 50, action, userId, schoolCode, startDate, endDate } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = {};
        if (action) query.action = action;
        if (userId) query.userId = userId;
        if (schoolCode) query.schoolCode = schoolCode;
        
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const logs = await AuditLog.find(query)
            .populate('userId', 'name email role')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await AuditLog.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                logs,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving audit logs',
            error: error.message
        });
    }
};

/**
 * @desc    Get all users across all schools
 * @route   GET /api/super-admin/users
 * @access  Super Admin only
 */
exports.getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, role, search, schoolCode } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = {};
        if (role) query.role = role;
        if (schoolCode) query.schoolCode = schoolCode;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                users,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving users',
            error: error.message
        });
    }
};
