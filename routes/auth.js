/**
 * 🔐 AUTHENTICATION ROUTES
 * Complete authentication workflow for all roles
 */

const express = require('express');
const router = express.Router();

// Import controllers
const authController = require('../controllers/authController');
const authMiddleware = require('../middleware/authMiddleware');

/**
 * 🔹 PHASE 1: SYSTEM INITIAL SETUP
 * Super Admin account should be created manually in database
 */

/**
 * 🔹 PHASE 2: SUPER ADMIN FLOW
 * 👑 Step 1: Super Admin Login
 */
router.post('/super-admin/login', authController.loginUser);

/**
 * 🔹 PHASE 3: PRINCIPAL FLOW
 * 🏫 Step 3: Principal Login
 */
router.post('/principal/login', authController.loginUser);

/**
 * 🔹 PHASE 5: DAILY OPERATION FLOW
 * 👨‍🏫 Step 8: Teacher Login
 */
router.post('/teacher/login', authController.loginUser);

/**
 * 🎓 Student Login
 */
router.post('/student/login', authController.loginUser);

/**
 * 🔐 Universal Login (detects role automatically)
 */
router.post('/login', authController.loginUser);

/**
 * 🔄 Token Management
 */
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logoutUser);

/**
 * 🔐 Profile Management
 */
router.get('/profile', authMiddleware.protect, authController.getUserProfile);
router.put('/profile', authMiddleware.protect, authController.updateUserProfile);

/**
 * 🔐 Password Management
 */
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/verify-email', authController.verifyEmail);
router.put('/change-password', authMiddleware.protect, authController.changePassword);

/**
 * 🔐 Two-Factor Authentication
 */
router.post('/enable-2fa', authController.setup2FA);
router.post('/verify-2fa', authController.verifyAndEnable2FA);
router.post('/disable-2fa', authController.disable2FA);

module.exports = router;
