const express = require('express');
const router = express.Router();
const {
    applyLeave,
    getMyLeaves,
    getAllLeaves,
    approveLeave,
    rejectLeave
} = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/apply', authorize('teacher'), applyLeave);
router.get('/my', authorize('teacher'), getMyLeaves);
router.get('/', authorize('principal', 'admin', 'super_admin'), getAllLeaves);
router.put('/:id/approve', authorize('principal', 'admin'), approveLeave);
router.put('/:id/reject', authorize('principal', 'admin'), rejectLeave);

module.exports = router;
