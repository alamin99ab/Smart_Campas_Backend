/**
 * 💰 ACCOUNTANT ROUTES
 * Complete accountant dashboard routes
 */

const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, checkFeatureAccess } = require('../middleware/multiTenant');

// Apply middleware to all routes
router.use(protect);
router.use(ensureTenantIsolation);
router.use(authorize('accountant'));

// Import controller
const accountantController = require('../controllers/accountantController');

/**
 * 📊 Accountant Dashboard
 */

router.get('/dashboard', accountantController.getAccountantDashboard);

router.get('/collection-report', accountantController.getCollectionReport);

router.get('/outstanding-fees', accountantController.getOutstandingFees);

/**
 * 💰 Fee Management
 */

router.post('/record-payment', accountantController.recordPayment);

router.get('/fee-structures', accountantController.getFeeStructures);

router.post('/fee-structures', accountantController.createFeeStructure);

router.post('/generate-invoices', accountantController.generateInvoices);

module.exports = router;
