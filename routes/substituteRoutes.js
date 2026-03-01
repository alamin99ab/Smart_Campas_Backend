const express = require('express');
const router = express.Router();
const {
    assignSubstitute,
    suggestSubstitutes,
    getSubstitutions
} = require('../controllers/substituteController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/assign', authorize('principal', 'admin'), assignSubstitute);
router.get('/suggest', authorize('principal', 'admin', 'teacher'), suggestSubstitutes);
router.get('/', authorize('principal', 'admin', 'teacher', 'super_admin'), getSubstitutions);

module.exports = router;
