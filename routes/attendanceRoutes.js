const express = require('express');
const router = express.Router();
const {
    takeAttendance,
    getAttendanceReport,
    getTodayAttendance,
    getMonthlyReport,
    getAttendanceAlerts,
    exportAttendance,
    deleteAttendance
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { checkSchoolStatus } = require('../middleware/schoolMiddleware');

// All attendance routes require authentication
router.use(protect);
router.use(checkSchoolStatus);

// Discovery endpoint
router.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Attendance API',
        data: {
            endpoints: [
                'POST /api/attendance/take',
                'GET /api/attendance/report',
                'GET /api/attendance/today',
                'GET /api/attendance/monthly',
                'GET /api/attendance/alerts',
                'GET /api/attendance/export',
                'DELETE /api/attendance/:id'
            ]
        }
    });
});

// Teacher/Principal can take attendance
router.post('/take', authorize('teacher', 'principal', 'accountant'), takeAttendance);
router.get('/report', getAttendanceReport);
router.get('/today', getTodayAttendance);
router.get('/monthly', getMonthlyReport);
router.get('/alerts', authorize('principal', 'teacher', 'admin'), getAttendanceAlerts);
router.get('/export', authorize('principal', 'accountant'), exportAttendance);
router.delete('/:id', authorize('principal'), deleteAttendance);

module.exports = router;
