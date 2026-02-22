const express = require('express');
const router = express.Router();
const {
    uploadResult,
    updateResult,
    searchResult,
    getResults,
    getResultById,
    deleteResult,
    downloadResultPDF,
    exportResultsToExcel
} = require('../controllers/resultController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { principalOnly } = require('../middleware/roleMiddleware');

// Public route (search)
router.post('/search', searchResult);

// Protected routes
router.use(protect);

// Export (principal/admin only)
router.get('/export', authorize('principal', 'admin'), exportResultsToExcel);

// CRUD operations
router.route('/')
    .post(authorize('teacher', 'principal'), uploadResult)
    .get(getResults);

router.route('/:id')
    .get(getResultById)
    .put(authorize('teacher', 'principal'), updateResult)
    .delete(principalOnly, deleteResult);

// PDF download (public or private - can be accessed via shared link)
router.get('/:id/pdf', downloadResultPDF);

module.exports = router;