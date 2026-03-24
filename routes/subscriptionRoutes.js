/**
 * 💰 SUBSCRIPTION ROUTES
 * Enterprise SaaS subscription management
 */

const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes
router.get('/plans', subscriptionController.getPlanDetails);

// Protected routes - Super Admin only
router.post('/', protect, authorize('super_admin'), subscriptionController.createSubscription);
router.get('/', protect, authorize('super_admin'), subscriptionController.getAllSubscriptions);
router.get('/expiring', protect, authorize('super_admin'), subscriptionController.getExpiringSubscriptions);
router.get('/check-expired', protect, authorize('super_admin'), subscriptionController.checkExpiredSubscriptions);

// Protected routes - Super Admin or School Admin
router.get('/:schoolId', protect, subscriptionController.getSubscription);
router.put('/:schoolId', protect, authorize('super_admin'), subscriptionController.updateSubscription);
router.delete('/:schoolId', protect, authorize('super_admin'), subscriptionController.cancelSubscription);

// Validate limits
router.post('/validate', protect, subscriptionController.validateSubscriptionLimits);

module.exports = router;
