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
    updateSchool,
    deleteSchool,
    getSystemAnalytics,
    getSuperAdminDashboard,
    updateSystemSettings,
    getSystemSettings
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
router.put('/schools/:id', updateSchool);
router.delete('/schools/:id', deleteSchool);

// Platform Statistics
router.get('/statistics', getSystemAnalytics);
router.get('/dashboard', getSuperAdminDashboard);

// System Settings
router.get('/settings', getSystemSettings);
router.put('/settings', updateSystemSettings);

module.exports = router;
