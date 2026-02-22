const express = require('express');
const router = express.Router();
const {
    takeAttendance,
    getAttendanceReport,
    getTodayAttendance,
    getMonthlyReport,
    exportAttendance,
    deleteAttendance
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { checkSchoolStatus } = require('../middleware/schoolMiddleware');

// All attendance routes require authentication
router.use(protect);
router.use(checkSchoolStatus);

// Teacher/Principal can take attendance
router.post('/take', authorize('teacher', 'principal', 'accountant'), takeAttendance);
router.get('/report', getAttendanceReport);
router.get('/today', getTodayAttendance);
router.get('/monthly', getMonthlyReport);
router.get('/export', authorize('principal', 'accountant'), exportAttendance);
router.delete('/:id', authorize('principal'), deleteAttendance);

module.exports = router;