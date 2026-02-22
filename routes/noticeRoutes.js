// routes/noticeRoutes.js
const express = require('express');
const router = express.Router();
const {
    createNotice,
    getNotices,
    getNotice,
    updateNotice,
    deleteNotice,
    getNoticesByCategory,
    getImportantNotices,
    getMyNotices,
    archiveExpiredNotices
} = require('../controllers/noticeController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { upload, uploadHandler } = require('../middleware/uploadMiddleware');

// All routes are protected
router.use(protect);

// Main routes
router.route('/')
    .get(getNotices)
    .post(
        authorize('principal', 'teacher', 'admin'),
        uploadHandler(['attachments', 5]),
        createNotice
    );

// My notices
router.get('/my', getMyNotices);

// Important notices
router.get('/important', getImportantNotices);

// Archive expired (admin/principal only)
router.post('/archive-expired', authorize('admin', 'principal'), archiveExpiredNotices);

// Category based
router.get('/category/:category', getNoticesByCategory);

// School based
router.get('/school/:schoolCode', getNotices);

// Single notice operations
router.route('/:id')
    .get(getNotice)
    .put(
        authorize('principal', 'teacher', 'admin'),
        uploadHandler(['attachments', 5]),
        updateNotice
    )
    .delete(authorize('principal', 'teacher', 'admin'), deleteNotice);

module.exports = router;