const express = require('express');
const router = express.Router();
const {
    registerUser,
    loginUser,
    refreshToken,
    logoutUser,
    logoutAllDevices,
    getUserProfile,
    updateUserProfile,
    changePassword,
    forgotPassword,
    resetPassword,
    verifyEmail,
    resendVerificationEmail,
    setup2FA,
    verifyAndEnable2FA,
    disable2FA,
    getSessions,
    revokeSession,
    getAuditLogs,
    getPendingTeachers,
    approveTeacher
} = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { loginLimiter, registerLimiter, authLimiter } = require('../middleware/rateLimiter');
const { validateLogin, validateRegister, checkValidation } = require('../middleware/validationMiddleware');

// Public routes (with rate limiting)
router.post('/register', registerLimiter, validateRegister, checkValidation, registerUser);
router.post('/login', loginLimiter, validateLogin, checkValidation, loginUser);
router.post('/refresh-token', refreshToken);
router.post('/forgot-password', authLimiter, forgotPassword);
router.put('/reset-password/:token', resetPassword);
router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);

// Protected routes
router.use(protect); // All routes below require authentication

router.post('/logout', logoutUser);
router.post('/logout-all', logoutAllDevices);
router.get('/profile', getUserProfile);
router.put('/profile', updateUserProfile);
router.put('/change-password', changePassword);

// 2FA
router.post('/setup-2fa', setup2FA);
router.post('/verify-2fa', verifyAndEnable2FA);
router.post('/disable-2fa', disable2FA);

// Sessions
router.get('/sessions', getSessions);
router.delete('/sessions/:sessionToken', revokeSession);

// Teacher approval (Principal only)
router.get('/pending-teachers', authorize('principal'), getPendingTeachers);
router.put('/approve-teacher/:id', authorize('principal'), approveTeacher);

// Audit logs (Admin/Principal only)
router.get('/audit-logs', authorize('admin', 'principal', 'superadmin'), getAuditLogs);

module.exports = router;