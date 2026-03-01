/**
 * 👨‍🏫 TEACHER ROUTES
 * Complete Teacher workflow implementation
 */

const express = require('express');
const router = express.Router();

// Import controllers
const {
    teacherAttendance,
    getStudentAttendanceReport,
    getClassAttendanceReport,
    getTeacherAttendanceReport
} = require('../controllers/advancedAttendanceController');
const {
    applyLeave,
    getLeaveApplications,
    respondToSubstituteAssignment,
    getMySubstituteAssignments
} = require('../controllers/leaveController');
const resultController = require('../controllers/resultController');

// Import middleware
const { protect, authorize } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, checkFeatureAccess, addSchoolScope } = require('../middleware/multiTenant');

// Apply multi-tenant middleware to all routes
router.use(ensureTenantIsolation);
router.use(addSchoolScope);

/**
 * 🔹 PHASE 5: DAILY OPERATION FLOW
 */

// 👨‍🏫 Step 8: Teacher Login (handled in auth routes)
router.post('/login', require('../controllers/authController').loginUser);

// All other routes require teacher authentication
router.use(protect);
router.use(authorize('teacher'));

/**
 * 👨‍🏫 Step 9: Take Attendance
 */

router.post('/attendance/mark', checkFeatureAccess('attendance'), teacherAttendance);
router.get('/attendance/my-report', getTeacherAttendanceReport);
router.get('/attendance/class/:classId/:sectionId/:date', getClassAttendanceReport);
router.get('/attendance/student/:studentId/report', getStudentAttendanceReport);

/**
 * 👨‍🏫 Step 10: Enter Marks
 */

router.post('/marks/enter', checkFeatureAccess('exam'), resultController.enterMarks);
router.put('/marks/update/:resultId', checkFeatureAccess('exam'), resultController.updateMarks);
router.get('/marks/exam/:examId', resultController.getExamMarks);
router.get('/marks/subject/:subjectId', resultController.getSubjectMarks);

/**
 * 🔁 SUBSTITUTE FLOW
 */

// Step 11: Teacher Leave Application
router.post('/leave/apply', applyLeave);
router.get('/leave/my-applications', getLeaveApplications);

// Substitute Assignment Response
router.patch('/substitute/assignment/:id/respond', respondToSubstituteAssignment);
router.get('/substitute/my-assignments', getMySubstituteAssignments);

/**
 * 📚 Teacher Dashboard & Profile
 */

router.get('/dashboard', require('../controllers/teacherController').getTeacherDashboard);
router.get('/profile', require('../controllers/teacherController').getTeacherProfile);
router.put('/profile', require('../controllers/teacherController').updateTeacherProfile);
router.put('/password', require('../controllers/teacherController').changePassword);

/**
 * 📚 Teacher Resources
 */

router.get('/my-classes', require('../controllers/teacherController').getMyClasses);
router.get('/my-subjects', require('../controllers/teacherController').getMySubjects);
router.get('/my-routine', require('../controllers/teacherController').getMyRoutine);
router.get('/my-students', require('../controllers/teacherController').getMyStudents);

module.exports = router;
