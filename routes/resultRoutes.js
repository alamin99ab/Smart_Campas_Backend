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
    publishResultsByExam,
    unpublishResultsByExam,
    getExamPublishStatus
} = require('../controllers/resultController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { principalOnly } = require('../middleware/roleMiddleware');
const { ensureTenantIsolation, addSchoolScope } = require('../middleware/multiTenant');
const { validate, schemas, validateObjectId } = require('../middleware/validationMiddleware');

// Protected routes
router.use(protect);
router.use(ensureTenantIsolation);
router.use(addSchoolScope);
router.post('/search', 
    validate(schemas.result.search, 'query'), 
    authorize('principal', 'admin', 'super_admin', 'teacher'), 
    searchResult
);

// Export (principal/admin only)
router.get('/export', authorize('principal', 'admin', 'super_admin'), exportResultsToExcel);

// CRUD operations
router.route('/')
    .post(
        validate(schemas.result.upload), 
        authorize('teacher', 'principal', 'admin'), 
        uploadResult
    )
    .get(
        validate(schemas.result.search, 'query'), 
        authorize('super_admin', 'admin', 'principal', 'teacher', 'student', 'parent'), 
        getResults
    );

// Exam-wise publish workflow endpoints (principal/admin only)
router.post('/publish', authorize('principal', 'admin'), publishResultsByExam);
router.put('/publish', authorize('principal', 'admin'), publishResultsByExam); // backward-compatible verb support
router.post('/unpublish', authorize('principal', 'admin'), unpublishResultsByExam);
router.get('/publish-status', authorize('principal', 'admin'), getExamPublishStatus);

router.route('/:id')
    .get(
        validateObjectId('id'), 
        authorize('super_admin', 'admin', 'principal', 'teacher', 'student', 'parent'), 
        getResultById
    )
    .put(
        validateObjectId('id'), 
        validate(schemas.result.update), 
        authorize('teacher', 'principal', 'admin'), 
        updateResult
    )
    .delete(
        validateObjectId('id'), 
        principalOnly, 
        deleteResult
    );

// Lock/Unlock (Principal only)
router.put('/:id/lock', 
    validateObjectId('id'), 
    principalOnly, 
    lockResult
);
router.put('/:id/unlock', 
    validateObjectId('id'), 
    principalOnly, 
    unlockResult
);

// PDF download (public or private - can be accessed via shared link)
router.get('/:id/pdf', authorize('super_admin', 'admin', 'principal', 'teacher', 'student', 'parent'), downloadResultPDF);

module.exports = router;
