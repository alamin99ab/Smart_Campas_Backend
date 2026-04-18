const express = require('express');
const router = express.Router();
const {
    createSession,
    getSessions,
    setCurrentSession
} = require('../controllers/academicSessionController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, addSchoolScope } = require('../middleware/multiTenant');

router.use(protect);
router.use(ensureTenantIsolation);
router.use(addSchoolScope);

router.post('/', authorize('principal', 'admin', 'super_admin'), createSession);
router.get('/', authorize('principal', 'admin', 'teacher', 'student', 'super_admin'), getSessions);
router.put('/:id/current', authorize('principal', 'admin'), setCurrentSession);

module.exports = router;
