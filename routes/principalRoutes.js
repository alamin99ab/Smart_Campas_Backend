/**
 * 👨‍🎓 PRINCIPAL ROUTES
 * Industry-level Principal routes for Smart Campus System
 */

const express = require('express');
const router = express.Router();
const {
    createClass,
    getAllClasses,
    createSubject,
    getAllSubjects,
    createRoutine,
    getClassRoutine,
    assignTeacher,
    getSchoolAnalytics
} = require('../controllers/principalController');
const {
    addStudent,
    bulkImportStudents,
    promoteStudents,
    transferStudent
} = require('../controllers/principalStudentController');

const { protect, authorize } = require('../middleware/authMiddleware');
const { validateClass, validateSubject, checkValidation } = require('../middleware/validationMiddleware');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Middleware
router.use(protect);
router.use(authorize('principal'));

// Student Management (Principal)
router.post('/students', addStudent);
router.post('/students/bulk-import', upload.single('file'), bulkImportStudents);
router.post('/students/promote', promoteStudents);
router.post('/students/transfer', transferStudent);

// Class Management Routes
router.post('/classes', validateClass, checkValidation, createClass);
router.get('/classes', getAllClasses);

// Subject Management Routes
router.post('/subjects', validateSubject, checkValidation, createSubject);
router.get('/subjects', getAllSubjects);

// Routine Management Routes
router.post('/routine', createRoutine);
router.get('/routine/:classId', getClassRoutine);

// Teacher Assignment Routes
router.post('/assign-teacher', assignTeacher);

// Analytics Routes
router.get('/analytics', getSchoolAnalytics);

module.exports = router;
