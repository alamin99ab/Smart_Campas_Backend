const express = require('express');
const router = express.Router();
const {
    updateFee,
    getClearance,
    giveSpecialPermission,
    revokeSpecialPermission,
    getFeeReport,
    getStudentFeeHistory,
    getDueList,
    exportFeeReport,
    generateFeeSummaryPDF,
    getFees,
    collectPayment
} = require('../controllers/feeController');
const {
    createFeeStructure,
    getFeeStructures,
    updateFeeStructure
} = require('../controllers/feeStructureController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { principalOnly, accountantOnly } = require('../middleware/roleMiddleware');
const { checkSchoolStatus } = require('../middleware/schoolMiddleware');

router.use(protect);
router.use(checkSchoolStatus);

// Fee management
router.get('/', getFees);
router.post('/structure', authorize('principal', 'admin'), createFeeStructure);
router.get('/structure', authorize('principal', 'admin', 'accountant'), getFeeStructures);
router.put('/structure/:id', authorize('principal', 'admin'), updateFeeStructure);
router.post('/collect', authorize('principal', 'accountant'), collectPayment);
router.post('/update', authorize('principal', 'accountant'), updateFee);
router.get('/report', authorize('principal', 'accountant'), getFeeReport);
router.get('/due-list', authorize('principal', 'accountant'), getDueList);
router.get('/export', authorize('principal', 'accountant'), exportFeeReport);
router.get('/summary-pdf', authorize('principal'), generateFeeSummaryPDF);

// Student specific
router.get('/clearance/:studentId', getClearance);
router.get('/history/:studentId', getStudentFeeHistory);

// Special permission (Principal only)
router.put('/special-permission/:studentId', principalOnly, giveSpecialPermission);
router.put('/revoke-permission/:studentId', principalOnly, revokeSpecialPermission);

module.exports = router;