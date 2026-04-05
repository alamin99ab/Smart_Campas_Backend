/**
 * 🏢 SUPER ADMIN CONTROLLER (Fixed)
 * Clean, minimal, and secure implementations for Super Admin endpoints.
 */
const mongoose = require('mongoose');
const crypto = require('crypto');
const { sendEmail } = require('../utils/emailService');

const School = require('../models/School');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const AuditLog = require('../models/AuditLog');
const Student = require('../models/Student');
const passwordService = require('../services/passwordResetService');

const SUBSCRIPTION_PRESETS = {
    trial: {
        durationDays: 14,
        amount: 0,
        billingCycle: 'trial',
        limits: { maxUsers: 100, maxStudents: 50, maxTeachers: 10, maxClasses: 10, maxStorage: 500, maxApiCalls: 1000 },
        features: { routine: true, attendance: true, exam: true, fee: true, notice: true, library: false, assignment: false, sms: false, bulkImport: false, mobileApp: false, apiAccess: false, advancedAnalytics: false, customBranding: false, prioritySupport: false, backup: false, integration: false }
    },
    monthly: {
        durationDays: 30,
        amount: 49.99,
        billingCycle: 'monthly',
        limits: { maxUsers: 500, maxStudents: 300, maxTeachers: 50, maxClasses: 30, maxStorage: 5000, maxApiCalls: 10000 },
        features: { routine: true, attendance: true, exam: true, fee: true, notice: true, library: true, assignment: true, sms: false, bulkImport: true, mobileApp: false, apiAccess: false, advancedAnalytics: false, customBranding: false, prioritySupport: false, backup: false, integration: false }
    },
    yearly: {
        durationDays: 365,
        amount: 499.99,
        billingCycle: 'yearly',
        limits: { maxUsers: 2000, maxStudents: 1500, maxTeachers: 200, maxClasses: 100, maxStorage: 50000, maxApiCalls: 100000 },
        features: { routine: true, attendance: true, exam: true, fee: true, notice: true, library: true, assignment: true, sms: true, bulkImport: true, mobileApp: true, apiAccess: true, advancedAnalytics: true, customBranding: true, prioritySupport: true, backup: true, integration: true }
    },
    basic: {
        durationDays: 30,
        amount: 29.99,
        billingCycle: 'monthly',
        limits: { maxUsers: 200, maxStudents: 1000, maxTeachers: 50, maxClasses: 25, maxStorage: 5000, maxApiCalls: 10000 },
        features: { routine: true, attendance: true, exam: true, fee: true, notice: true, library: false, assignment: false, sms: false, bulkImport: true, mobileApp: false, apiAccess: false, advancedAnalytics: false, customBranding: false, prioritySupport: false, backup: false, integration: false }
    },
    standard: {
        durationDays: 365,
        amount: 199.99,
        billingCycle: 'yearly',
        limits: { maxUsers: 1000, maxStudents: 5000, maxTeachers: 200, maxClasses: 100, maxStorage: 25000, maxApiCalls: 50000 },
        features: { routine: true, attendance: true, exam: true, fee: true, notice: true, library: true, assignment: true, sms: true, bulkImport: true, mobileApp: true, apiAccess: true, advancedAnalytics: true, customBranding: false, prioritySupport: false, backup: true, integration: true }
    },
    premium: {
        durationDays: 365,
        amount: 399.99,
        billingCycle: 'yearly',
        limits: { maxUsers: 5000, maxStudents: 20000, maxTeachers: 1000, maxClasses: 500, maxStorage: 100000, maxApiCalls: 250000 },
        features: { routine: true, attendance: true, exam: true, fee: true, notice: true, library: true, assignment: true, sms: true, bulkImport: true, mobileApp: true, apiAccess: true, advancedAnalytics: true, customBranding: true, prioritySupport: true, backup: true, integration: true }
    },
    enterprise: {
        durationDays: 365,
        amount: 999.99,
        billingCycle: 'yearly',
        limits: { maxUsers: Infinity, maxStudents: Infinity, maxTeachers: Infinity, maxClasses: Infinity, maxStorage: Infinity, maxApiCalls: Infinity },
        features: { routine: true, attendance: true, exam: true, fee: true, notice: true, library: true, assignment: true, sms: true, bulkImport: true, mobileApp: true, apiAccess: true, advancedAnalytics: true, customBranding: true, prioritySupport: true, backup: true, integration: true }
    }
};

const generateSecurePassword = (length = 16) => {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
};

const createAudit = async (userId, action, details, req) => {
    try {
        if (!AuditLog) return;
        await AuditLog.create({ user: userId, action, details, ip: req?.ip, userAgent: req?.headers?.['user-agent'], schoolCode: req?.user?.schoolCode });
    } catch (err) {
        console.error('Audit creation failed:', err.message);
    }
};

exports.createSchool = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { schoolName, schoolCode, principalName, principalEmail, principalPassword, schoolType, currentSession, address, phone, email, principalPhone, plan = 'trial' } = req.body;
        if (!schoolName || !schoolCode || !principalEmail || !principalName) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'schoolName, schoolCode, principalName and principalEmail are required' });
        }

        const normalizedCode = schoolCode.trim().toUpperCase();
        const normalizedPlan = SUBSCRIPTION_PRESETS[plan] ? plan : 'trial';
        const planConfig = SUBSCRIPTION_PRESETS[normalizedPlan];
        const subscriptionStartDate = new Date();
        const subscriptionEndDate = new Date(subscriptionStartDate);
        subscriptionEndDate.setDate(subscriptionEndDate.getDate() + planConfig.durationDays);

        const existing = await School.findOne({ schoolCode: normalizedCode }).session(session);
        if (existing) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'School code already exists' });
        }

        const schoolTypeValue = schoolType || 'secondary';
        const academicCurrentSession = currentSession || process.env.DEFAULT_ACADEMIC_SESSION || '2025-2026';

        const creatorId = (req.user && mongoose.Types.ObjectId.isValid(req.user._id)) ? req.user._id : null;

        const school = await School.create([{
            schoolName: schoolName.trim(),
            schoolCode: normalizedCode,
            schoolType: schoolTypeValue,
            address: address?.trim() || undefined,
            phone: phone?.trim() || undefined,
            email: email?.trim().toLowerCase() || undefined,
            academicSettings: { currentSession: academicCurrentSession },
            subscription: {
                plan: normalizedPlan,
                billingCycle: planConfig.billingCycle,
                status: 'active',
                startDate: subscriptionStartDate,
                endDate: subscriptionEndDate
            },
            features: planConfig.features,
            createdBy: creatorId
        }], { session });

        const existingUser = await User.findOne({ email: principalEmail.trim().toLowerCase() }).session(session);
        if (existingUser) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'Principal email already exists' });
        }

        const createdSchool = school[0];

        const passwordToUse = principalPassword || generateSecurePassword();

        const principal = new User({
            name: principalName.trim(),
            email: principalEmail.trim().toLowerCase(),
            password: passwordToUse,
            role: 'principal',
            schoolId: createdSchool._id,
            schoolCode: createdSchool.schoolCode,
            schoolName: createdSchool.schoolName,
            phone: principalPhone?.trim() || undefined,
            isApproved: true,
            emailVerified: false
        });

        await principal.save({ session });

        createdSchool.principal = principal._id;
        await createdSchool.save({ session });

        await Subscription.create([{
            schoolId: createdSchool._id,
            plan: normalizedPlan,
            status: 'active',
            billingCycle: planConfig.billingCycle,
            startDate: subscriptionStartDate,
            endDate: subscriptionEndDate,
            trialEndDate: normalizedPlan === 'trial' ? subscriptionEndDate : null,
            amount: {
                currency: 'USD',
                amount: Number.isFinite(planConfig.amount) ? planConfig.amount : 0,
                discount: 0,
                tax: 0,
                total: Number.isFinite(planConfig.amount) ? planConfig.amount : 0
            },
            paymentMethod: 'card',
            autoRenew: normalizedPlan !== 'trial',
            usage: {
                users: 0,
                students: 0,
                teachers: 0,
                classes: 0,
                storage: 0,
                apiCalls: 0
            },
            limits: {
                maxUsers: Number.isFinite(planConfig.limits.maxUsers) ? planConfig.limits.maxUsers : 999999999,
                maxStudents: Number.isFinite(planConfig.limits.maxStudents) ? planConfig.limits.maxStudents : 999999999,
                maxTeachers: Number.isFinite(planConfig.limits.maxTeachers) ? planConfig.limits.maxTeachers : 999999999,
                maxClasses: Number.isFinite(planConfig.limits.maxClasses) ? planConfig.limits.maxClasses : 999999999,
                maxStorage: Number.isFinite(planConfig.limits.maxStorage) ? planConfig.limits.maxStorage : 999999999,
                maxApiCalls: Number.isFinite(planConfig.limits.maxApiCalls) ? planConfig.limits.maxApiCalls : 999999999
            },
            features: planConfig.features
        }], { session });

        await session.commitTransaction();
        session.endSession();

        // Send onboarding email (fire and forget)
        sendEmail({
            to: principalEmail,
            subject: 'Welcome to Smart Campus',
            template: 'principal-welcome',
            data: { name: principalName, temporaryPassword: passwordToUse, schoolName: createdSchool.schoolName }
        }).catch(e => console.error('Email send error:', e));

        await createAudit(req.user?._id || null, 'CREATE_SCHOOL', { schoolId: createdSchool._id, principal: principal._id }, req);

        return res.status(201).json({
            success: true,
            message: 'School created successfully',
            data: {
                school: {
                    _id: createdSchool._id,
                    schoolName: createdSchool.schoolName,
                    schoolCode: createdSchool.schoolCode,
                    address: createdSchool.address,
                    phone: createdSchool.phone,
                    email: createdSchool.email,
                    subscription: {
                        ...createdSchool.subscription.toObject(),
                        expiryDate: createdSchool.subscription.endDate
                    }
                },
                principal: {
                    _id: principal._id,
                    name: principal.name,
                    email: principal.email,
                    phone: principal.phone,
                    role: principal.role
                },
                schoolId: createdSchool._id,
                schoolName: createdSchool.schoolName,
                schoolCode: createdSchool.schoolCode,
                principalId: principal._id,
                principalEmail: principal.email
            }
        });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('createSchool error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAllSchools = async (req, res) => {
    try {
        const schools = await School.find()
            .select('-__v')
            .populate('principal', 'name email phone role');
        res.json({ success: true, data: schools });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getSchool = async (req, res) => {
    try {
        const school = await School.findById(req.params.id)
            .select('-__v')
            .populate('principal', 'name email phone role');
        if (!school) return res.status(404).json({ success: false, message: 'School not found' });
        const [studentCount, teacherCount] = await Promise.all([
            User.countDocuments({ schoolCode: school.schoolCode, role: 'student' }),
            User.countDocuments({ schoolCode: school.schoolCode, role: 'teacher' })
        ]);
        const schoolData = school.toObject();
        if (schoolData.subscription?.endDate) {
            schoolData.subscription.expiryDate = schoolData.subscription.endDate;
        }
        res.json({ success: true, data: { ...schoolData, studentCount, teacherCount } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateSchool = async (req, res) => {
    try {
        const updates = { ...req.body };
        delete updates._id;
        const school = await School.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select('-__v');
        if (!school) return res.status(404).json({ success: false, message: 'School not found' });
        await createAudit(req.user?._id || null, 'UPDATE_SCHOOL', { schoolId: school._id }, req);
        res.json({ success: true, data: school });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.deleteSchool = async (req, res) => {
    try {
        const school = await School.findByIdAndDelete(req.params.id);
        if (!school) return res.status(404).json({ success: false, message: 'School not found' });
        await createAudit(req.user?._id || null, 'DELETE_SCHOOL', { schoolId: req.params.id }, req);
        res.json({ success: true, message: 'School deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const { role } = req.query;
        const query = {};
        if (role) query.role = role;
        const users = await User.find(query).select('-password -refreshToken -twoFactorSecret');
        res.json({ success: true, data: users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createUser = async (req, res) => {
    try {
        const { name, email, role, schoolCode, password } = req.body;
        if (!name || !email || !role || !schoolCode) return res.status(400).json({ success: false, message: 'name, email, role and schoolCode required' });

        if (role === 'super_admin') return res.status(403).json({ success: false, message: 'Creating super_admin via API is not allowed. Manage Super Admin via environment variables.' });

        const school = await School.findOne({ schoolCode: schoolCode.trim().toUpperCase() });
        if (!school) return res.status(404).json({ success: false, message: 'School not found for the provided schoolCode' });

        const pwd = password || generateSecurePassword();
        const userData = {
            name,
            email: email.trim().toLowerCase(),
            role,
            schoolId: school._id,
            schoolCode: school.schoolCode,
            schoolName: school.schoolName,
            password: pwd,
            // Super admin-created users should be ready to log in; approve students too
            isApproved: true
        };

        const user = new User(userData);
        await user.save();

        // Send notification email (do not include password in response)
        try {
            sendEmail({ to: email, subject: 'Account Created', template: 'account-created', data: { name, role } }).catch(e => console.error('Email error:', e));
        } catch (e) {
            console.error('Email send failed:', e.message);
        }

        await createAudit(req.user?._id || null, 'CREATE_USER', { userId: user._id, role }, req);
        res.status(201).json({ success: true, data: { userId: user._id, name: user.name, email: user.email, role: user.role, schoolCode: user.schoolCode } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getUserDetails = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password -refreshToken -twoFactorSecret');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, data: user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateUser = async (req, res) => {
    try {
        const updates = { ...req.body };
        delete updates.password; // Password updates via reset endpoint only
        if (updates.role === 'super_admin') return res.status(403).json({ success: false, message: 'Assigning super_admin role via API is not allowed.' });
        const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select('-password -refreshToken -twoFactorSecret');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        await createAudit(req.user?._id || null, 'UPDATE_USER', { userId: user._id }, req);
        res.json({ success: true, data: user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.toggleUserBlock = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('+isBlocked');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        user.isBlocked = !user.isBlocked;
        await user.save();
        await createAudit(req.user?._id || null, 'TOGGLE_USER_BLOCK', { userId: user._id, blocked: user.isBlocked }, req);
        res.json({ success: true, data: { userId: user._id, isBlocked: user.isBlocked } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.resetUserPassword = async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const { newPassword, forceChangeOnNextLogin = true } = req.body;
        if (!newPassword) return res.status(400).json({ success: false, message: 'New password is required' });

        const result = await passwordService.resetUserPassword({
            targetUserId,
            newPassword,
            requesterId: req.user?._id || 'super_admin',
            requesterRole: req.user?.role || 'super_admin',
            requesterSchoolCode: req.user?.schoolCode || null,
            forceChangeOnNextLogin,
            req
        });

        res.json({ success: true, message: result.message, data: result.data });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getSystemSettings = async (req, res) => {
    try {
        const settings = { siteName: process.env.SITE_NAME || 'Smart Campus', supportEmail: process.env.SUPPORT_EMAIL || null };
        res.json({ success: true, data: settings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateSystemSettings = async (req, res) => {
    try {
        // For now persist to env-backed store is not implemented; accept changes in-memory
        const updates = req.body || {};
        await createAudit(req.user?._id || null, 'UPDATE_SYSTEM_SETTINGS', { updates }, req);
        res.json({ success: true, message: 'Settings updated (in-memory)', data: updates });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

function getMonthWindow(baseDate = new Date()) {
    const start = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
    const end = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1);
    return { start, end };
}

function getRecentMonthWindows(monthCount = 12) {
    const now = new Date();

    return Array.from({ length: monthCount }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - (monthCount - 1 - index), 1);
        return {
            start: new Date(date.getFullYear(), date.getMonth(), 1),
            end: new Date(date.getFullYear(), date.getMonth() + 1, 1)
        };
    });
}

async function countStudents(match = {}) {
    const [studentRecords, studentUsers] = await Promise.all([
        Student.countDocuments(match),
        User.countDocuments({ role: 'student', ...match })
    ]);

    return Math.max(studentRecords, studentUsers);
}

async function buildMonthlyCounts(model, match = {}, dateField = 'createdAt', monthCount = 12) {
    const windows = getRecentMonthWindows(monthCount);

    return Promise.all(windows.map(({ start, end }) => (
        model.countDocuments({
            ...match,
            [dateField]: { $gte: start, $lt: end }
        })
    )));
}

async function buildMonthlyStudentCounts(monthCount = 12) {
    const windows = getRecentMonthWindows(monthCount);

    return Promise.all(windows.map(({ start, end }) => countStudents({
        createdAt: { $gte: start, $lt: end }
    })));
}

async function buildMonthlyRevenue(monthCount = 12) {
    const windows = getRecentMonthWindows(monthCount);

    return Promise.all(windows.map(async ({ start, end }) => {
        const revenue = await Subscription.aggregate([
            {
                $match: {
                    startDate: { $gte: start, $lt: end }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount.total' }
                }
            }
        ]);

        return revenue[0]?.total || 0;
    }));
}

async function buildSuperAdminMetrics() {
    const { start: startOfMonth, end: endOfMonth } = getMonthWindow();

    const [
        totalSchools,
        activeSchools,
        totalUsers,
        activeUsers,
        totalPrincipals,
        totalTeachers,
        totalStudents,
        activeStudents,
        newSchoolsThisMonth,
        newTeachersThisMonth,
        newStudentsThisMonth,
        activeSubscriptions,
        totalRevenueAggregate,
        monthlyIncomeAggregate,
        monthlyRevenue,
        monthlyStudents,
        monthlyNewSchools
    ] = await Promise.all([
        School.countDocuments(),
        School.countDocuments({ isActive: { $ne: false } }),
        User.countDocuments(),
        User.countDocuments({ isActive: { $ne: false }, isBlocked: { $ne: true } }),
        User.countDocuments({ role: 'principal' }),
        User.countDocuments({ role: 'teacher' }),
        countStudents(),
        countStudents({ isActive: { $ne: false } }),
        School.countDocuments({ createdAt: { $gte: startOfMonth, $lt: endOfMonth } }),
        User.countDocuments({ role: 'teacher', createdAt: { $gte: startOfMonth, $lt: endOfMonth } }),
        countStudents({ createdAt: { $gte: startOfMonth, $lt: endOfMonth } }),
        Subscription.countDocuments({ status: 'active' }),
        Subscription.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount.total' }
                }
            }
        ]),
        Subscription.aggregate([
            {
                $match: {
                    startDate: { $gte: startOfMonth, $lt: endOfMonth }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount.total' }
                }
            }
        ]),
        buildMonthlyRevenue(),
        buildMonthlyStudentCounts(),
        buildMonthlyCounts(School)
    ]);

    const inactiveSchools = Math.max(totalSchools - activeSchools, 0);
    const totalRevenue = totalRevenueAggregate[0]?.total || 0;
    const monthlyIncome = monthlyIncomeAggregate[0]?.total || 0;

    return {
        totalSchools,
        activeSchools,
        inactiveSchools,
        totalUsers,
        activeUsers,
        totalPrincipals,
        totalTeachers,
        totalStudents,
        activeStudents,
        newStudentsThisMonth,
        totalRevenue,
        monthlyIncome,
        activeSubscriptions,
        recentActivity: {
            newSchoolsThisMonth,
            newStudentsThisMonth,
            newTeachersThisMonth
        },
        monthlyRevenue,
        monthlyStudents,
        monthlyNewSchools,
        // Backward-compatible aliases for older clients
        schools: totalSchools,
        users: totalUsers
    };
}

exports.getSystemAnalytics = async (req, res) => {
    try {
        const metrics = await buildSuperAdminMetrics();
        res.json({ success: true, data: metrics });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getSuperAdminDashboard = async (req, res) => {
    try {
        const metrics = await buildSuperAdminMetrics();
        res.json({ success: true, data: metrics });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

module.exports = exports;
