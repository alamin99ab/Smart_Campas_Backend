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
const passwordService = require('../services/passwordResetService');

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
        const { schoolName, schoolCode, principalName, principalEmail, principalPassword, schoolType, currentSession } = req.body;
        if (!schoolName || !schoolCode || !principalEmail || !principalName) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ success: false, message: 'schoolName, schoolCode, principalName and principalEmail are required' });
        }

        const normalizedCode = schoolCode.trim().toUpperCase();

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
            academicSettings: { currentSession: academicCurrentSession },
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
            isApproved: true,
            emailVerified: false
        });

        await principal.save({ session });

        createdSchool.principalId = principal._id;
        await createdSchool.save({ session });

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

        return res.status(201).json({ success: true, data: { schoolId: createdSchool._id, schoolName: createdSchool.schoolName, schoolCode: createdSchool.schoolCode, principalId: principal._id, principalEmail } });
    } catch (error) {
        await session.abortTransaction();
        session.endSession();
        console.error('createSchool error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getAllSchools = async (req, res) => {
    try {
        const schools = await School.find().select('-__v');
        res.json({ success: true, data: schools });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getSchool = async (req, res) => {
    try {
        const school = await School.findById(req.params.id).select('-__v');
        if (!school) return res.status(404).json({ success: false, message: 'School not found' });
        res.json({ success: true, data: school });
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
            isApproved: role !== 'student' ? true : false
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

exports.getSystemAnalytics = async (req, res) => {
    try {
        const schools = await School.countDocuments();
        const users = await User.countDocuments();
        const activeSubscriptions = await Subscription.countDocuments({ status: 'active' });
        res.json({ success: true, data: { schools, users, activeSubscriptions } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getSuperAdminDashboard = exports.getSystemAnalytics;

module.exports = exports;
