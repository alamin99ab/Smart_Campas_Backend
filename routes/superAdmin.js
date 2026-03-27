/**
 * 👑 SUPER ADMIN ROUTES
 * Complete Super Admin workflow implementation
 */

const express = require('express');
const router = express.Router();

// Import controllers
const authController = require('../controllers/authController');
const {
    createSchool,
    getAllSchools,
    getSchool,
    updateSchool,
    deleteSchool,
    getSystemAnalytics,
    getSuperAdminDashboard,
    updateSystemSettings,
    getSystemSettings,
    getAllUsers,
    createUser,
    getUserDetails,
    updateUser,
    toggleUserBlock,
    resetUserPassword
} = require('../controllers/superAdminController');

// Import middleware
const { protect, authorize } = require('../middleware/authMiddleware');

/**
 * 🔹 PHASE 2: SUPER ADMIN FLOW
 */

// 👑 Step 1: Super Admin Login
router.post('/login', authController.loginUser);

// 🏫 Step 2: Create New School (protected)
router.post('/schools', protect, authorize('super_admin'), createSchool);

// School Management (protected)
router.get('/schools', protect, authorize('super_admin'), getAllSchools);
router.get('/schools/:id', protect, authorize('super_admin'), getSchool);
router.put('/schools/:id', protect, authorize('super_admin'), updateSchool);
router.delete('/schools/:id', protect, authorize('super_admin'), deleteSchool);

// Platform Statistics (protected)
router.get('/statistics', protect, authorize('super_admin'), getSystemAnalytics);
router.get('/dashboard', protect, authorize('super_admin'), getSuperAdminDashboard);

// User Management (protected)
router.get('/users', protect, authorize('super_admin'), getAllUsers);
router.get('/users/:id', protect, authorize('super_admin'), getUserDetails);

// Create new user (protected)
router.post('/users', protect, authorize('super_admin'), createUser);

// Update user (protected)
router.put('/users/:id', protect, authorize('super_admin'), updateUser);

// Toggle user block (protected)
router.patch('/users/:id/toggle-block', protect, authorize('super_admin'), toggleUserBlock);

// Reset user password (protected) - Super Admin can reset any user (except other super admin)
router.post('/users/:userId/reset-password', protect, authorize('super_admin'), resetUserPassword);

// System Settings (protected)
router.get('/settings', protect, authorize('super_admin'), getSystemSettings);
router.put('/settings', protect, authorize('super_admin'), updateSystemSettings);

module.exports = router;
