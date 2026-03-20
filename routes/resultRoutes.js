const express = require('express');
const router = express.Router();
const {
    uploadResult,
    updateResult,
    searchResult,
    getResults,
    getResultById,
    deleteResult,
    lockResult,
    unlockResult,
    downloadResultPDF,
    exportResultsToExcel,
    publishResult,
    bulkPublishResults
} = require('../controllers/resultController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { principalOnly } = require('../middleware/roleMiddleware');

// Public route (search)
router.post('/search', searchResult);

// Protected routes
router.use(protect);

// Export (principal/admin only)
router.get('/export', authorize('principal', 'admin', 'super_admin'), exportResultsToExcel);

// CRUD operations
router.route('/')
    .post(authorize('teacher', 'principal', 'admin'), uploadResult)
    .get(getResults);

// Principal publish endpoints
router.put('/publish', authorize('principal', 'admin', 'super_admin'), bulkPublishResults);

router.route('/:id')
    .get(getResultById)
    .put(authorize('teacher', 'principal', 'admin'), updateResult)
    .delete(principalOnly, deleteResult);

// Publish single result (Principal only)
router.put('/:id/publish', authorize('principal', 'admin', 'super_admin'), publishResult);

// Lock/Unlock (Principal only)
router.put('/:id/lock', principalOnly, lockResult);
router.put('/:id/unlock', principalOnly, unlockResult);

// PDF download (public or private - can be accessed via shared link)
router.get('/:id/pdf', downloadResultPDF);

module.exports = router;