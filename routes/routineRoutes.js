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
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

// Auto-generate routine based on teacher subject assignments
router.post('/auto-generate', authorize('principal', 'admin', 'super_admin'), autoGenerateRoutine);

router.post('/check-conflicts', authorize('principal', 'admin', 'teacher'), checkConflicts);
router.post('/', authorize('principal', 'admin', 'teacher'), createRoutine);
router.get('/daily', getDailyRoutine);
router.get('/', getRoutines);
router.get('/:id', getRoutineById);
router.put('/:id', authorize('principal', 'admin', 'teacher'), updateRoutine);
router.put('/:id/publish', authorize('principal', 'admin'), publishRoutine);
router.delete('/:id', authorize('principal', 'admin'), deleteRoutine);

module.exports = router;
