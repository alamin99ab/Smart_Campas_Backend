/**
 * 📢 NOTICE MANAGEMENT ROUTES
 * Complete CRUD system for school communication
 */

const express = require('express');
const router = express.Router();

// Import controllers
const noticeController = require('../controllers/noticeController');

// Import middleware
const { protect, authorize } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, checkFeatureAccess, addSchoolScope } = require('../middleware/multiTenant');

// Authentication first, then tenant isolation
router.use(protect);
router.use(ensureTenantIsolation);
router.use(addSchoolScope);

/**
 * 🔹 NOTICE CRUD OPERATIONS
 */

// Create notice (Principal, Teacher, Super Admin)
router.post('/', 
    checkFeatureAccess('notice'),
    authorize('principal', 'teacher', 'super_admin'),
    noticeController.createNotice
);

// Get notices (All authenticated users)
router.get('/', 
    noticeController.getNotices
);

// Get notice by ID
router.get('/:id', 
    noticeController.getNoticeById
);

// Update notice (Creator, Principal, Super Admin)
router.put('/:id', 
    authorize('principal', 'teacher', 'super_admin'),
    noticeController.updateNotice
);

// Delete notice (Creator, Principal, Super Admin)
router.delete('/:id', 
    authorize('principal', 'teacher', 'super_admin'),
    noticeController.deleteNotice
);

/**
 * 🔹 NOTICE INTERACTIONS
 */

// Acknowledge notice
router.post('/:id/acknowledge', 
    noticeController.acknowledgeNotice
);

// Add comment to notice
router.post('/:id/comments', 
    noticeController.addComment
);

// Pin/Unpin notice (Principal, Super Admin)
router.patch('/:id/pin', 
    authorize('principal', 'super_admin'),
    noticeController.pinNotice
);

/**
 * 🔹 NOTICE ANALYTICS (Principal, Super Admin)
 */

// Get notice analytics
router.get('/analytics/dashboard', 
    authorize('principal', 'super_admin'),
    noticeController.getNoticeAnalytics
);

/**
 * 🔹 GLOBAL NOTICE ROUTES (Super Admin only)
 */

// Create global notice
router.post('/global/create', 
    authorize('super_admin'),
    noticeController.createNotice
);

// Get global notices
router.get('/global/list', 
    authorize('super_admin'),
    noticeController.getNotices
);

/**
 * 🔹 TEACHER NOTICE ROUTES (Limited access)
 */

// Create class notice (Teacher only for assigned classes)
router.post('/class/create', 
    authorize('teacher'),
    checkFeatureAccess('notice'),
    noticeController.createNotice
);

// Get my created notices
router.get('/my/created', 
    authorize('principal', 'teacher', 'super_admin'),
    noticeController.getNotices
);

/**
 * 🔹 STUDENT/PARENT NOTICE ROUTES (View only)
 */

// Get notices for student/parent
router.get('/student/view', 
    authorize('student', 'parent'),
    noticeController.getNotices
);

// Get unread notices
router.get('/student/unread', 
    authorize('student', 'parent'),
    noticeController.getNotices
);

module.exports = router;
