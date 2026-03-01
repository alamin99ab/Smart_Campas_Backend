const express = require('express');
const router = express.Router();
const {
    createSession,
    getSessions,
    setCurrentSession
} = require('../controllers/academicSessionController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', authorize('principal', 'admin', 'super_admin'), createSession);
router.get('/', authorize('principal', 'admin', 'teacher', 'student', 'super_admin'), getSessions);
router.put('/:id/current', authorize('principal', 'admin'), setCurrentSession);

module.exports = router;
