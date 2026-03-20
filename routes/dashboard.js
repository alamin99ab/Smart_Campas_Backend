/**
 * 📊 DASHBOARD ROUTES
 * Role-based dashboard endpoints
 */

const express = require('express');
const router = express.Router();

// Import controllers
const dashboardController = require('../controllers/dashboardController');

// Import middleware
const { protect, authorize } = require('../middleware/authMiddleware');
const { ensureTenantIsolation } = require('../middleware/multiTenant');

/**
 * 🔹 PHASE 9: ANALYTICS FLOW
 */

// All dashboard routes require authentication first
router.use(protect);

// Then apply multi-tenant middleware (after auth, for non-super-admin routes)
router.use(ensureTenantIsolation);

/**
 * 👑 Super Admin Dashboard
 */
router.get('/super-admin', authorize('super_admin'), dashboardController.getSuperAdminDashboard);

/**
 * 🏫 Principal Dashboard
 */
router.get('/principal', authorize('principal'), dashboardController.getPrincipalDashboard);

/**
 * 👨‍🏫 Teacher Dashboard
 */
router.get('/teacher', authorize('teacher'), dashboardController.getTeacherDashboard);

/**
 * 🎓 Student Dashboard
 */
router.get('/student', authorize('student'), dashboardController.getStudentDashboard);

/**
 * 👨‍👩 Parent Dashboard
 */
router.get('/parent', authorize('parent'), dashboardController.getParentDashboard);

/**
 * 💰 Accountant Dashboard
 */
router.get('/accountant', authorize('accountant'), dashboardController.getAccountantDashboard);

module.exports = router;
