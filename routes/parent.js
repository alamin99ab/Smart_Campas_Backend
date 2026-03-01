/**
 * 🎓 PARENT ROUTES
 * Complete parent dashboard routes
 */

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, checkFeatureAccess } = require('../middleware/multiTenant');

// Apply middleware to all routes
router.use(protect);
router.use(ensureTenantIsolation);
router.use(authorize('parent'));

// Import controller
const parentController = require('../controllers/parentController');

/**
 * 🏠 Parent Dashboard
 */

router.get('/dashboard', parentController.getParentDashboard);

router.get('/children', parentController.getChildren);

router.get('/attendance/:studentId', parentController.getChildAttendance);

router.get('/results/:studentId', parentController.getChildResults);

router.get('/fees/:studentId', parentController.getChildFees);

/**
 * 👤 Parent Profile Management
 */

router.get('/profile', parentController.getParentProfile);

router.put('/profile', parentController.updateParentProfile);

module.exports = router;
