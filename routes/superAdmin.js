const express = require('express');

const router = express.Router();

const authController = require('../controllers/authController');
const {
    createSchool,
    getAllSchools,
    getSchool,
    updateSchool,
    deleteSchool,
    getSystemAnalytics,
    getSuperAdminDashboard,
    updateSystemSettings,
    getSystemSettings,
    getAllUsers,
    createUser,
    getUserDetails,
    updateUser,
    toggleUserBlock,
    resetUserPassword
} = require('../controllers/superAdminController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.post('/login', authController.loginUser);

router.post('/schools', protect, authorize('super_admin'), createSchool);
router.get('/schools', protect, authorize('super_admin'), getAllSchools);
router.get('/schools/:id', protect, authorize('super_admin'), getSchool);
router.put('/schools/:id', protect, authorize('super_admin'), updateSchool);
router.delete('/schools/:id', protect, authorize('super_admin'), deleteSchool);

router.get('/statistics', protect, authorize('super_admin'), getSystemAnalytics);
router.get('/dashboard', protect, authorize('super_admin'), getSuperAdminDashboard);

router.get('/users', protect, authorize('super_admin'), getAllUsers);
router.get('/users/:id', protect, authorize('super_admin'), getUserDetails);
router.post('/users', protect, authorize('super_admin'), createUser);
router.put('/users/:id', protect, authorize('super_admin'), updateUser);
router.patch('/users/:id/toggle-block', protect, authorize('super_admin'), toggleUserBlock);
router.post('/users/:userId/reset-password', protect, authorize('super_admin'), resetUserPassword);

router.get('/settings', protect, authorize('super_admin'), getSystemSettings);
router.put('/settings', protect, authorize('super_admin'), updateSystemSettings);

module.exports = router;
