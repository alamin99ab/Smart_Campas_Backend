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

// Setup endpoint - Create Super Admin if not exists (for initial deployment)
router.post('/setup', async (req, res) => {
    try {
        const User = require('../models/User');
        const bcrypt = require('bcryptjs');
        
        // Check if super admin already exists
        const existingAdmin = await User.findOne({ role: 'super_admin' });
        if (existingAdmin) {
            return res.status(400).json({ 
                success: false,
                message: 'Super Admin already exists. Please login with existing credentials.'
            });
        }
        
        // Get credentials from environment or request body
        const adminEmail = process.env.SUPER_ADMIN_EMAIL || req.body.email;
        const adminPassword = process.env.SUPER_ADMIN_PASSWORD || req.body.password;
        const adminName = process.env.SUPER_ADMIN_NAME || req.body.name || 'Super Administrator';
        
        if (!adminEmail || !adminPassword) {
            return res.status(400).json({
                success: false,
                message: 'SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD must be set in environment variables'
            });
        }
        
        const hashedPassword = await bcrypt.hash(adminPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
        const superAdmin = new User({
            name: adminName,
            email: adminEmail,
            password: hashedPassword,
            phone: process.env.SUPER_ADMIN_PHONE || '',
            role: 'super_admin',
            isApproved: true,
            emailVerified: true,
            isActive: true
        });
        
        await superAdmin.save();
        
        res.status(201).json({
            success: true,
            message: 'Super Admin created successfully',
            data: {
                email: adminEmail,
                name: adminName
            }
        });
    } catch (error) {
        console.error('Setup error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

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
