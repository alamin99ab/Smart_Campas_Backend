const express = require('express');
const router = express.Router();
const {
    getSchoolProfile,
    updateSchoolSettings,
    uploadLogo,
    updateSubscription,
    toggleSchoolStatus,
    getSchoolStats,
    upload
} = require('../controllers/schoolController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/roleMiddleware');

// All routes require authentication
router.use(protect);

// School profile (for logged-in user's school)
router.get('/profile', getSchoolProfile);
router.get('/stats', getSchoolStats);

// Settings update (principal or admin)
router.put('/settings', authorize('principal', 'admin'), updateSchoolSettings);

// Logo upload (principal or admin)
router.post('/logo', authorize('principal', 'admin'), upload, uploadLogo);

// Admin-only routes
router.put('/subscription/:schoolCode', adminOnly, updateSubscription);
router.put('/toggle-status/:schoolCode', adminOnly, toggleSchoolStatus);

module.exports = router;