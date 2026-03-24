/**
 * 👑 SUPER ADMIN ROUTES
 * Complete Super Admin workflow implementation
 */

const express = require('express');
const router = express.Router();

// Import controllers
const {
    superAdminLogin,
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
    createUser
} = require('../controllers/superAdminController');

// Import middleware
const { protect, authorize } = require('../middleware/authMiddleware');

/**
 * 🔹 PHASE 2: SUPER ADMIN FLOW
 */

// 👑 Step 1: Super Admin Login
router.post('/login', superAdminLogin);

// All other routes require super admin authentication
router.use(protect);
router.use(authorize('super_admin'));

// 🏫 Step 2: Create New School
router.post('/schools', createSchool);

// School Management
router.get('/schools', getAllSchools);
router.get('/schools/:id', getSchool);
router.put('/schools/:id', updateSchool);
router.delete('/schools/:id', deleteSchool);

// Platform Statistics
router.get('/statistics', getSystemAnalytics);
router.get('/dashboard', getSuperAdminDashboard);

// User Management
router.get('/users', getAllUsers);
router.get('/users/:id', getUserDetails);

// Create new user
router.post('/users', createUser);

// Update user
router.put('/users/:id', updateUser);

// Toggle user block
router.patch('/users/:id/toggle-block', toggleUserBlock);

// System Settings
router.get('/settings', getSystemSettings);
router.put('/settings', updateSystemSettings);

module.exports = router;
