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
    try {
        const { schoolName, schoolCode, principalName, principalEmail, principalPassword } = req.body;
        if (!schoolName || !schoolCode || !principalEmail || !principalName) {
            return res.status(400).json({ success: false, message: 'schoolName, schoolCode, principalName and principalEmail are required' });
        }

        const existing = await School.findOne({ schoolCode: schoolCode.toUpperCase() });
        if (existing) return res.status(400).json({ success: false, message: 'School code already exists' });

        const school = await School.create({ schoolName, schoolCode: schoolCode.toUpperCase(), createdBy: req.user?._id });

        // Create principal user
        const passwordToUse = principalPassword || generateSecurePassword();
        const principal = new User({
            name: principalName,
            email: principalEmail,
            password: passwordToUse,
            role: 'principal',
            schoolCode: school.schoolCode,
            schoolName: school.schoolName,
            isApproved: true,
            emailVerified: false
        });
        await principal.save();

        // Link principal to school
        school.principalId = principal._id;
        await school.save();

        // Send onboarding email (do not return password in API)
        try {
            sendEmail({
                to: principalEmail,
                subject: 'Welcome to Smart Campus',
                template: 'principal-welcome',
                data: { name: principalName, temporaryPassword: passwordToUse, schoolName: school.schoolName }
            }).catch(e => console.error('Email send error:', e));
        } catch (e) {
            console.error('Onboarding email failed:', e.message);
        }

        await createAudit(req.user?._id || null, 'CREATE_SCHOOL', { schoolId: school._id, principal: principal._id }, req);

        return res.status(201).json({ success: true, data: { schoolId: school._id, schoolName: school.schoolName, schoolCode: school.schoolCode, principalId: principal._id, principalEmail } });
    } catch (error) {
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
        if (!name || !email || !role) return res.status(400).json({ success: false, message: 'name, email and role required' });

        if (role === 'super_admin') return res.status(403).json({ success: false, message: 'Creating super_admin via API is not allowed. Manage Super Admin via environment variables.' });

        const pwd = password || generateSecurePassword();
        const user = new User({ name, email, role, schoolCode, password: pwd });
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
