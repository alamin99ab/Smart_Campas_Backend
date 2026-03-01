/**
 * 📢 NOTICE MANAGEMENT ROUTES
 * Complete CRUD system for school communication
 */

const express = require('express');
const router = express.Router();

// Import controllers
const {
    createNotice,
    getNotices,
    getNoticeById,
    updateNotice,
    deleteNotice,
    acknowledgeNotice,
    addComment,
    getNoticeAnalytics,
    pinNotice
} = require('../controllers/noticeController');

// Import middleware
const { protect, authorize } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, checkFeatureAccess, addSchoolScope } = require('../middleware/multiTenant');

// Apply multi-tenant middleware to all routes
router.use(ensureTenantIsolation);
router.use(addSchoolScope);

// All routes require authentication
router.use(protect);

/**
 * 🔹 NOTICE CRUD OPERATIONS
 */

// Create notice (Principal, Teacher, Super Admin)
router.post('/', 
    checkFeatureAccess('notice'),
    authorize(['principal', 'teacher', 'super_admin']),
    createNotice
);

// Get notices (All authenticated users)
router.get('/', 
    getNotices
);

// Get notice by ID
router.get('/:id', 
    getNoticeById
);

// Update notice (Creator, Principal, Super Admin)
router.put('/:id', 
    authorize(['principal', 'teacher', 'super_admin']),
    updateNotice
);

// Delete notice (Creator, Principal, Super Admin)
router.delete('/:id', 
    authorize(['principal', 'teacher', 'super_admin']),
    deleteNotice
);

/**
 * 🔹 NOTICE INTERACTIONS
 */

// Acknowledge notice
router.post('/:id/acknowledge', 
    acknowledgeNotice
);

// Add comment to notice
router.post('/:id/comments', 
    addComment
);

// Pin/Unpin notice (Principal, Super Admin)
router.patch('/:id/pin', 
    authorize(['principal', 'super_admin']),
    pinNotice
);

/**
 * 🔹 NOTICE ANALYTICS (Principal, Super Admin)
 */

// Get notice analytics
router.get('/analytics/dashboard', 
    authorize(['principal', 'super_admin']),
    getNoticeAnalytics
);

/**
 * 🔹 GLOBAL NOTICE ROUTES (Super Admin only)
 */

// Create global notice
router.post('/global/create', 
    authorize('super_admin'),
    createNotice
);

// Get global notices
router.get('/global/list', 
    authorize('super_admin'),
    getNotices
);

/**
 * 🔹 TEACHER NOTICE ROUTES (Limited access)
 */

// Create class notice (Teacher only for assigned classes)
router.post('/class/create', 
    authorize('teacher'),
    checkFeatureAccess('notice'),
    createNotice
);

// Get my created notices
router.get('/my/created', 
    authorize(['principal', 'teacher', 'super_admin']),
    getNotices
);

/**
 * 🔹 STUDENT/PARENT NOTICE ROUTES (View only)
 */

// Get notices for student/parent
router.get('/student/view', 
    authorize(['student', 'parent']),
    getNotices
);

// Get unread notices
router.get('/student/unread', 
    authorize(['student', 'parent']),
    getNotices
);

module.exports = router;
