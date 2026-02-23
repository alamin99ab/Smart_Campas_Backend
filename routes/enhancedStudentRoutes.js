/**
 * 🎓 ENHANCED STUDENT ROUTES
 * Industry-level enhanced student routes with additional features
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const {
    getEnhancedDashboard,
    getAssignments,
    submitAssignment,
    getFees,
    getLibraryBooks,
    getExams,
    updateProfile
} = require('../controllers/enhancedStudentController');

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
        const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images and documents are allowed'));
        }
    }
});

// Middleware
router.use(protect);
router.use(authorize('student'));

// Enhanced Dashboard
router.get('/enhanced-dashboard', getEnhancedDashboard);

// Assignment Management
router.get('/assignments', getAssignments);
router.post('/assignments/:id/submit', upload.array('attachments', 5), submitAssignment);

// Fee Management
router.get('/fees', getFees);

// Library Management
router.get('/library', getLibraryBooks);

// Exam Management
router.get('/exams', getExams);

// Profile Management with file upload
router.put('/profile', upload.single('profileImage'), updateProfile);

module.exports = router;
