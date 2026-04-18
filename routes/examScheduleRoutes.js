const express = require('express');
const router = express.Router();
const {
    createExamSchedule,
    getExamSchedules,
    updateExamSchedule,
    publishExamSchedule
} = require('../controllers/examScheduleController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, addSchoolScope } = require('../middleware/multiTenant');

router.use(protect);
router.use(ensureTenantIsolation);
router.use(addSchoolScope);

router.post('/', authorize('principal', 'admin'), createExamSchedule);
router.get('/', authorize('principal', 'admin', 'teacher', 'student'), getExamSchedules);
router.put('/:id', authorize('principal', 'admin'), updateExamSchedule);
router.put('/:id/publish', authorize('principal', 'admin'), publishExamSchedule);

module.exports = router;
