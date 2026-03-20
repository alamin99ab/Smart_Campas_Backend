/**
 * 🎓 STUDENT ROUTES
 * Complete Student workflow implementation
 */

const express = require('express');
const router = express.Router();

// Import controllers
const studentController = require('../controllers/studentController');
const {
    getStudentAttendanceReport
} = require('../controllers/advancedAttendanceController');
const resultController = require('../controllers/resultController');
const feeController = require('../controllers/feeController');
const noticeController = require('../controllers/noticeController');

// Import middleware
const { protect, authorize } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, checkFeatureAccess, addSchoolScope } = require('../middleware/multiTenant');

// Authentication first, then tenant isolation
router.use(protect);
router.use(ensureTenantIsolation);
router.use(addSchoolScope);

/**
 * 🔹 PHASE 5: DAILY OPERATION FLOW
 */

// 🎓 Student Login (handled in auth routes)
router.post('/login', require('../controllers/authController').loginUser);

// All other routes require student authentication
router.use(protect);
router.use(authorize('student'));

/**
 * 🎓 Student Dashboard & Profile
 */

router.get('/dashboard', studentController.getStudentDashboard);
router.get('/profile', studentController.getStudentProfile);
router.put('/profile', studentController.updateStudentProfile);
router.put('/password', studentController.changePassword);

/**
 * 📅 View Routine
 */

router.get('/routine', studentController.getMyRoutine);
router.get('/routine/today', studentController.getTodayRoutine);
router.get('/routine/week', studentController.getWeeklyRoutine);

/**
 * 📝 View Attendance
 */

router.get('/attendance', getStudentAttendanceReport);
router.get('/attendance/summary', studentController.getAttendanceSummary);
router.get('/attendance/monthly', studentController.getMonthlyAttendance);

/**
 * 🧾 View Result
 */

router.get('/results', resultController.getStudentResults);
router.get('/results/exam/:examId', resultController.getStudentExamResult);
router.get('/results/marksheet', resultController.downloadMarksheet);
router.get('/results/transcript', resultController.getTranscript);

/**
 * 💰 View Fees
 */

router.get('/fees', checkFeatureAccess('fee'), feeController.getStudentFees);
router.get('/fees/due', checkFeatureAccess('fee'), feeController.getDueFees);
router.get('/fees/payment-history', checkFeatureAccess('fee'), feeController.getPaymentHistory);
router.get('/fees/invoice/:invoiceId', checkFeatureAccess('fee'), feeController.getInvoice);

/**
 * 📢 View Notice
 */

router.get('/notices', noticeController.getStudentNotices);
router.get('/notices/unread', noticeController.getUnreadNotices);
router.put('/notices/:id/read', noticeController.markNoticeAsRead);

/**
 * 📚 Academic Resources
 */

router.get('/assignments', studentController.getAssignments);
router.get('/assignments/:id', studentController.getAssignmentDetails);
router.post('/assignments/:id/submit', studentController.submitAssignment);

router.get('/study-materials', studentController.getStudyMaterials);
router.get('/study-materials/:id', studentController.downloadStudyMaterial);

/**
 * 📊 Performance Analytics
 */

router.get('/performance', studentController.getPerformanceAnalytics);
router.get('/performance/subjects', studentController.getSubjectPerformance);
router.get('/performance/attendance-trend', studentController.getAttendanceTrend);

module.exports = router;
