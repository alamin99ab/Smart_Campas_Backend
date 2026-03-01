const express = require('express');
const router = express.Router();
const {
    createExamSchedule,
    getExamSchedules,
    updateExamSchedule,
    publishExamSchedule
} = require('../controllers/examScheduleController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', authorize('principal', 'admin'), createExamSchedule);
router.get('/', authorize('principal', 'admin', 'teacher', 'student'), getExamSchedules);
router.put('/:id', authorize('principal', 'admin'), updateExamSchedule);
router.put('/:id/publish', authorize('principal', 'admin'), publishExamSchedule);

module.exports = router;
