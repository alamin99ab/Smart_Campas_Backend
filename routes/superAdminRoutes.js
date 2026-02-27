/**
 * 🏢 SUPER ADMIN ROUTES
 * Industry-level Super Admin routes for Smart Campus System
 */

const express = require('express');
const router = express.Router();
const {
    createSchool,
    getAllSchools,
    updateSchool,
    deleteSchool,
    getSystemAnalytics,
    getAllUsers,
    superAdminLogin,
    getSuperAdminDashboard,
    updateSystemSettings,
    getSystemSettings,
    createUser,
    updateUser,
    deleteUser,
    toggleUserBlock,
    forcePasswordReset,
    getUserDetails,
    getAuditLogs
} = require('../controllers/superAdminController');

const { protect, authorize } = require('../middleware/authMiddleware');
const { superAdminAuth, validateSuperAdminSession, requireSuperAdminPermission, superAdminRateLimit } = require('../middleware/superAdminAuth');
const { validateSchool, checkValidation } = require('../middleware/validationMiddleware');

// Public route for super admin login
router.post('/login', superAdminRateLimit(5, 15 * 60 * 1000), superAdminLogin);

// Apply super admin authentication to all other routes
router.use(protect);
router.use(authorize('super_admin'));
router.use(superAdminAuth);
router.use(validateSuperAdminSession);

// Dashboard and Analytics Routes
router.get('/dashboard', getSuperAdminDashboard);
router.get('/analytics', getSystemAnalytics);

// System Settings Routes
router.get('/system-settings', getSystemSettings);
router.put('/system-settings', requireSuperAdminPermission('manage_system_settings'), updateSystemSettings);

// School Management Routes
router.post('/schools', requireSuperAdminPermission('manage_schools'), validateSchool, checkValidation, createSchool);
router.get('/schools', getAllSchools);
router.put('/schools/:id', requireSuperAdminPermission('manage_schools'), updateSchool);
router.delete('/schools/:id', requireSuperAdminPermission('manage_schools'), deleteSchool);

// User Management Routes
router.get('/users', getAllUsers);
router.post('/users', requireSuperAdminPermission('manage_users'), createUser);
router.get('/users/:id', getUserDetails);
router.put('/users/:id', requireSuperAdminPermission('manage_users'), updateUser);
router.delete('/users/:id', requireSuperAdminPermission('manage_users'), deleteUser);
router.put('/users/:id/block', requireSuperAdminPermission('manage_users'), toggleUserBlock);
router.post('/users/:id/reset-password', requireSuperAdminPermission('manage_users'), forcePasswordReset);

// Audit Logs Routes
router.get('/audit-logs', requireSuperAdminPermission('audit_logs'), getAuditLogs);

module.exports = router;
