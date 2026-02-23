/**
 * 👨‍🏫 ENHANCED TEACHER ROUTES
 * Industry-level enhanced teacher routes with additional features
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
    getEnhancedDashboard,
    createAssignment,
    getAssignments,
    gradeAssignment,
    createExam,
    getClassStudents,
    getAnalytics
} = require('../controllers/enhancedTeacherController');

const { protect, authorize } = require('../middleware/authMiddleware');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/assignments/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|ppt|pptx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images, documents, and presentations are allowed'));
        }
    }
});

// Middleware
router.use(protect);
router.use(authorize('teacher'));

// Enhanced Dashboard
router.get('/enhanced-dashboard', getEnhancedDashboard);

// Assignment Management
router.post('/assignments', upload.array('attachments', 10), createAssignment);
router.get('/assignments', getAssignments);
router.put('/assignments/:id/grade', gradeAssignment);

// Exam Management
router.post('/exams', upload.array('attachments', 5), createExam);

// Student Management
router.get('/students/:classId', getClassStudents);

// Analytics
router.get('/analytics', getAnalytics);

module.exports = router;
