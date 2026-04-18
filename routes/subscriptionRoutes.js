/**
 * 💰 SUBSCRIPTION ROUTES
 * Enterprise SaaS subscription management
 */

const express = require('express');
const router = express.Router();
const subscriptionController = require('../controllers/subscriptionController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, addSchoolScope } = require('../middleware/multiTenant');

// Public routes
router.get('/plans', subscriptionController.getPlanDetails);

router.use(protect);
router.use(ensureTenantIsolation);
router.use(addSchoolScope);

// Protected routes - Super Admin only
router.post('/', authorize('super_admin'), subscriptionController.createSubscription);
router.get('/', authorize('super_admin'), subscriptionController.getAllSubscriptions);
router.get('/expiring', authorize('super_admin'), subscriptionController.getExpiringSubscriptions);
router.get('/check-expired', authorize('super_admin'), subscriptionController.checkExpiredSubscriptions);

// Validate limits
router.post('/validate', subscriptionController.validateSubscriptionLimits);

// Protected routes - Super Admin or School Admin
router.get('/:schoolId', authorize('super_admin', 'principal', 'admin'), subscriptionController.getSubscription);
router.put('/:schoolId', authorize('super_admin'), subscriptionController.updateSubscription);
router.delete('/:schoolId', authorize('super_admin'), subscriptionController.cancelSubscription);

module.exports = router;
