/**
 * 🎓 STUDENT ROUTES
 * Industry-level Student routes for Smart Campus System
 */

const express = require('express');
const router = express.Router();
const {
    getStudentDashboard,
    getNotices,
    getResults,
    getAttendance,
    getRoutine,
    getProfile
} = require('../controllers/studentController');

const { protect, authorize } = require('../middleware/authMiddleware');

// Middleware
router.use(protect);
router.use(authorize('student'));

// Dashboard
router.get('/dashboard', getStudentDashboard);

// Notice Management (View Only)
router.get('/notices', getNotices);

// Result Management (View Only)
router.get('/results', getResults);

// Attendance Management (View Only)
router.get('/attendance', getAttendance);

// Routine Management (View Only)
router.get('/routine', getRoutine);

// Profile Management
router.get('/profile', getProfile);

module.exports = router;
