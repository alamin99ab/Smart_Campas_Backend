const express = require('express');
const rateLimit = require('express-rate-limit');

const router = express.Router();

const loginRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 10,
    message: {
        success: false,
        message: 'Too many login attempts from this IP, please try again after 5 minutes.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');
const passwordMgmtMiddleware = require('../middleware/passwordManagementMiddleware');

router.post('/setup', async (req, res) => {
    try {
        const adminEmail = process.env.SUPER_ADMIN_EMAIL;
        const adminConfigured = !!adminEmail && !!process.env.SUPER_ADMIN_PASSWORD;
        if (!adminConfigured) {
            return res.status(400).json({ success: false, message: 'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are not configured. Please set them in environment.' });
        }

        return res.json({
            success: true,
            message: 'Super Admin is managed via environment. No DB record is created.',
            data: { email: adminEmail, name: process.env.SUPER_ADMIN_NAME || 'Super Admin' },
            login_url: '/api/auth/super-admin/login'
        });
    } catch (error) {
        console.error('Setup check error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/emergency-reset', async (req, res) => {
    try {
        return res.status(403).json({
            success: false,
            message: 'Emergency reset is disabled for env-based Super Admin accounts. Update SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in your hosting environment.'
        });
    } catch (error) {
        console.error('Emergency reset handler error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/super-admin/login', loginRateLimiter, authController.loginUser);
router.post('/principal/login', loginRateLimiter, authController.loginUser);
router.post('/teacher/login', loginRateLimiter, authController.loginUser);
router.post('/student/login', loginRateLimiter, authController.loginUser);
router.post('/register', loginRateLimiter, authController.registerUser);
router.post('/login', loginRateLimiter, authController.loginUser);

router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logoutUser);

router.get('/profile', authMiddleware.protect, authController.getUserProfile);
router.put('/profile', authMiddleware.protect, authController.updateUserProfile);

router.post('/forgot-password', authController.forgotPassword);
router.put('/reset-password/:token', authController.resetPassword);
router.post('/reset-password', authController.resetPassword);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/verify-email', authController.verifyEmail);
router.put(
    '/change-password',
    authMiddleware.protect,
    passwordMgmtMiddleware.validatePasswordStrength,
    authController.changePassword
);

router.post('/enable-2fa', authController.setup2FA);
router.post('/verify-2fa', authController.verifyAndEnable2FA);
router.post('/disable-2fa', authController.disable2FA);

module.exports = router;
