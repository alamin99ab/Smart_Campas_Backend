/**
 * 👨‍🏫 TEACHER ROUTES
 * Industry-level Teacher routes for Smart Campus System
 */

const express = require('express');
const router = express.Router();
const {
    getTeacherDashboard,
    takeAttendance,
    getAttendanceRecords,
    inputResults,
    getResults,
    getClassStudents,
    createNotice
} = require('../controllers/teacherController');

const { protect, authorize } = require('../middleware/authMiddleware');

// Middleware
router.use(protect);
router.use(authorize('teacher'));

// Dashboard
router.get('/dashboard', getTeacherDashboard);

// Attendance Management
router.post('/attendance', takeAttendance);
router.get('/attendance', getAttendanceRecords);

// Result Management
router.post('/results', inputResults);
router.get('/results', getResults);

// Class Management
router.get('/students/:classId', getClassStudents);

// Notice Management
router.post('/notices', createNotice);

module.exports = router;
