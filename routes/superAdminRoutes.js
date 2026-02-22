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
    getAllUsers
} = require('../controllers/superAdminController');

const { protect, authorize } = require('../middleware/authMiddleware');
const { validateSchool, checkValidation } = require('../middleware/validationMiddleware');

// Middleware
router.use(protect);
router.use(authorize('super_admin'));

// School Management Routes
router.post('/schools', validateSchool, checkValidation, createSchool);
router.get('/schools', getAllSchools);
router.put('/schools/:id', updateSchool);
router.delete('/schools/:id', deleteSchool);

// Analytics Routes
router.get('/analytics', getSystemAnalytics);

// User Management Routes
router.get('/users', getAllUsers);

module.exports = router;
