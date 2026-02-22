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

const { protect, authorize } = require('../middleware/authMiddleware');
const { validateClass, validateSubject, checkValidation } = require('../middleware/validationMiddleware');

// Middleware
router.use(protect);
router.use(authorize('principal'));

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
