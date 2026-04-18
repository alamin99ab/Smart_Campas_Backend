const express = require('express');
const router = express.Router();
const {
    createRoutine,
    getRoutines,
    getRoutineById,
    updateRoutine,
    deleteRoutine,
    publishRoutine,
    checkConflicts,
    autoGenerateRoutine,
    getDailyRoutine
} = require('../controllers/routineController');
const {
    getWeeklyRoutine,
    getTeacherSchedule
} = require('../controllers/advancedRoutineController');
const { getMyRoutine } = require('../controllers/studentController');
const {
    uploadAndParseRoutine,
    confirmRoutineImport,
    upload
} = require('../controllers/routineImportController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, addSchoolScope } = require('../middleware/multiTenant');
const { validate, schemas, validateObjectId } = require('../middleware/validationMiddleware');

router.use(protect);
router.use(ensureTenantIsolation);
router.use(addSchoolScope);

// Auto-generate routine based on teacher subject assignments
router.post('/auto-generate', authorize('principal', 'admin', 'super_admin'), autoGenerateRoutine);

router.post('/check-conflicts', authorize('principal', 'admin', 'super_admin'), checkConflicts);

// PDF Import Routes
router.post('/import/upload', 
    validate(schemas.routineImport.upload), 
    authorize('principal', 'admin', 'super_admin'), 
    upload.single('routinePdf'), 
    uploadAndParseRoutine
);
router.post('/import/confirm', 
    validate(schemas.routineImport.confirm), 
    authorize('principal', 'admin', 'super_admin'), 
    confirmRoutineImport
);

// Enhanced routine retrieval routes
router.get('/weekly', getWeeklyRoutine);
router.get('/teacher/schedule', authorize('teacher'), getTeacherSchedule);
router.get('/student/schedule', authorize('student'), getMyRoutine);
router.post('/detect-conflicts', authorize('principal', 'admin', 'super_admin'), checkConflicts);

router.post('/', authorize('principal', 'admin', 'super_admin'), createRoutine);
router.get('/daily', getDailyRoutine);
router.get('/', getRoutines);
router.get('/:id', getRoutineById);
router.put('/:id', authorize('principal', 'admin', 'super_admin'), updateRoutine);
router.put('/:id/publish', authorize('principal', 'admin', 'super_admin'), publishRoutine);
router.delete('/:id', authorize('principal', 'admin', 'super_admin'), deleteRoutine);

module.exports = router;
