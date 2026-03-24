/**
 * 🎓 PROMOTION ROUTES
 * Academic promotion management
 */

const express = require('express');
const router = express.Router();
const promotionController = require('../controllers/promotionController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// Principal and Super Admin only
router.get('/eligible', authorize('principal', 'super_admin'), promotionController.getEligibleStudents);
router.post('/run', authorize('principal', 'super_admin'), promotionController.runPromotion);
router.get('/history', authorize('principal', 'super_admin'), promotionController.getPromotionHistory);
router.get('/classes', authorize('principal', 'super_admin'), promotionController.getPromotionClasses);
router.post('/renumber', authorize('principal', 'super_admin'), promotionController.renumberStudents);

module.exports = router;
