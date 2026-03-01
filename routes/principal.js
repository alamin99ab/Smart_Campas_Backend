/**
 * 🏫 PRINCIPAL ROUTES
 * Complete Principal workflow implementation
 */

const express = require('express');
const router = express.Router();

// Import controllers
const principalController = require('../controllers/principalController');
const teacherController = require('../controllers/teacherController');
const studentController = require('../controllers/studentController');
const {
    createWeeklyRoutine,
    dragDropUpdate,
    getWeeklyRoutine,
    publishRoutine,
    getTeacherSchedule,
    detectAllConflicts,
    resolveConflict,
    createExamRoutine,
    getRoutineAnalytics
} = require('../controllers/advancedRoutineController');
const {
    applyLeave,
    getLeaveApplications,
    approveLeave,
    getAvailableSubstitutes,
    respondToSubstituteAssignment,
    getMySubstituteAssignments,
    getLeaveStatistics
} = require('../controllers/substituteController');
const {
    markStudentAttendance,
    getStudentAttendanceReport,
    getClassAttendanceReport,
    getAttendanceAnalytics,
    getAttendanceAlerts,
    acknowledgeAlert
} = require('../controllers/advancedAttendanceController');
const feeController = require('../controllers/feeController');
const noticeController = require('../controllers/noticeController');
const analyticsController = require('../controllers/analyticsController');

// Import middleware
const { protect, authorize } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, checkFeatureAccess, addSchoolScope } = require('../middleware/multiTenant');

// Apply multi-tenant middleware to all routes
router.use(ensureTenantIsolation);
router.use(addSchoolScope);

/**
 * 🔹 PHASE 3: PRINCIPAL FLOW
 */

// 👑 Step 3: Principal Login (handled in auth routes)
router.post('/login', require('../controllers/authController').loginUser);

// All other routes require principal authentication
router.use(protect);
router.use(authorize('principal'));

/**
 * 📚 Step 4: Academic Setup
 */

// Academic Session Management
router.post('/academic-sessions', principalController.createAcademicSession);
router.get('/academic-sessions', principalController.getAcademicSessions);
router.put('/academic-sessions/:id', principalController.updateAcademicSession);

// Class Management
router.post('/classes', principalController.createClass);
router.get('/classes', principalController.getClasses);
router.put('/classes/:id', principalController.updateClass);
router.delete('/classes/:id', principalController.deleteClass);

// Section Management
router.post('/sections', principalController.createSection);
router.get('/sections', principalController.getSections);
router.put('/sections/:id', principalController.updateSection);

// Subject Management
router.post('/subjects', principalController.createSubject);
router.get('/subjects', principalController.getSubjects);
router.put('/subjects/:id', principalController.updateSubject);

// Room Management
router.post('/rooms', principalController.createRoom);
router.get('/rooms', principalController.getRooms);
router.put('/rooms/:id', principalController.updateRoom);

/**
 * 👨‍🏫 Step 5: Create Teacher
 */

router.post('/teachers', teacherController.createTeacher);
router.get('/teachers', teacherController.getTeachers);
router.put('/teachers/:id', teacherController.updateTeacher);
router.delete('/teachers/:id', teacherController.deleteTeacher);
router.post('/teachers/:id/reset-password', teacherController.resetTeacherPassword);

/**
 * 🎓 Step 6: Create Student
 */

router.post('/students', studentController.createStudent);
router.get('/students', studentController.getStudents);
router.put('/students/:id', studentController.updateStudent);
router.delete('/students/:id', studentController.deleteStudent);
router.post('/students/bulk-import', studentController.bulkImportStudents);
router.post('/students/:id/reset-password', studentController.resetStudentPassword);

/**
 * 🔹 PHASE 4: ROUTINE SETUP
 */

// 📅 Step 7: Create Class Routine
router.post('/routine/weekly', checkFeatureAccess('routine'), createWeeklyRoutine);
router.put('/routine/drag-drop', checkFeatureAccess('routine'), dragDropUpdate);
router.get('/routine/weekly/:classId/:sectionId/:academicSessionId', getWeeklyRoutine);
router.post('/routine/publish', checkFeatureAccess('routine'), publishRoutine);
router.get('/routine/teacher/:teacherId', getTeacherSchedule);
router.get('/routine/conflicts/:academicSessionId', detectAllConflicts);
router.put('/routine/:routineId/resolve-conflict/:conflictIndex', resolveConflict);
router.post('/routine/exam', checkFeatureAccess('routine'), createExamRoutine);
router.get('/routine/analytics', checkFeatureAccess('routine'), getRoutineAnalytics);

/**
 * 🔹 PHASE 5: DAILY OPERATION FLOW
 */

// Substitute Management
router.post('/substitute/leave-apply', applyLeave);
router.get('/substitute/leave-applications', getLeaveApplications);
router.patch('/substitute/leave/:id/approve', approveLeave);
router.get('/substitute/available-teachers', getAvailableSubstitutes);
router.get('/substitute/my-assignments', getMySubstituteAssignments);
router.get('/substitute/statistics', getLeaveStatistics);

// Attendance Management
router.post('/attendance/student/mark', checkFeatureAccess('attendance'), markStudentAttendance);
router.get('/attendance/student/:studentId/report', getStudentAttendanceReport);
router.get('/attendance/class/:classId/:sectionId/:date', getClassAttendanceReport);
router.get('/attendance/analytics', checkFeatureAccess('attendance'), getAttendanceAnalytics);
router.get('/attendance/alerts', getAttendanceAlerts);
router.patch('/attendance/alerts/:attendanceId/:alertId/acknowledge', acknowledgeAlert);

/**
 * 🔹 PHASE 6: RESULT FLOW
 */

// Exam Management
router.post('/exams', checkFeatureAccess('exam'), principalController.createExam);
router.get('/exams', principalController.getExams);
router.put('/exams/:id', principalController.updateExam);
router.delete('/exams/:id', principalController.deleteExam);
router.post('/exams/:id/publish', principalController.publishExamResults);

/**
 * 🔹 PHASE 7: FEES FLOW
 */

router.post('/fee-structure', checkFeatureAccess('fee'), feeController.createFeeStructure);
router.get('/fee-structure', feeController.getFeeStructures);
router.put('/fee-structure/:id', feeController.updateFeeStructure);
router.get('/fee/collections', checkFeatureAccess('fee'), feeController.getFeeCollections);
router.get('/fee/unpaid', checkFeatureAccess('fee'), feeController.getUnpaidFees);
router.post('/fee/generate-invoices', checkFeatureAccess('fee'), feeController.generateInvoices);

/**
 * 🔹 PHASE 8: NOTICE FLOW
 */

router.post('/notices', checkFeatureAccess('notice'), noticeController.createNotice);
router.get('/notices', noticeController.getNotices);
router.put('/notices/:id', noticeController.updateNotice);
router.delete('/notices/:id', noticeController.deleteNotice);
router.post('/notices/:id/publish', noticeController.publishNotice);

/**
 * 🔹 PHASE 9: ANALYTICS FLOW
 */

router.get('/dashboard', analyticsController.getPrincipalDashboard);
router.get('/analytics/attendance', checkFeatureAccess('attendance'), analyticsController.getAttendanceAnalytics);
router.get('/analytics/performance', checkFeatureAccess('exam'), analyticsController.getPerformanceAnalytics);
router.get('/analytics/fees', checkFeatureAccess('fee'), analyticsController.getFeeAnalytics);

module.exports = router;
