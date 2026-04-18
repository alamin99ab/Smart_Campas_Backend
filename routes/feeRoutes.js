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
const { ensureTenantIsolation, addSchoolScope } = require('../middleware/multiTenant');
const { validate, schemas, validateObjectId } = require('../middleware/validationMiddleware');

router.use(protect);
router.use(ensureTenantIsolation);
router.use(addSchoolScope);
router.use(checkSchoolStatus);

// Fee management
router.get('/', 
    validate(schemas.fee.search, 'query'), 
    authorize('principal', 'admin', 'accountant', 'student', 'parent'), 
    getFees
);
router.post('/structure', authorize('principal', 'admin'), createFeeStructure);
router.get('/structure', authorize('principal', 'admin'), getFeeStructures);
router.put('/structure/:id', 
    validateObjectId('id'), 
    authorize('principal', 'admin'), 
    updateFeeStructure
);
router.post('/collect', 
    validate(schemas.fee.payment), 
    authorize('principal', 'accountant'), 
    collectPayment
);
router.post('/update', 
    validate(schemas.fee.create), 
    authorize('principal', 'admin'), 
    updateFee
);
router.get('/report', authorize('principal', 'admin'), getFeeReport);
router.get('/due-list', authorize('principal', 'admin'), getDueList);
router.get('/export', authorize('principal', 'admin'), exportFeeReport);
router.get('/summary-pdf', authorize('principal'), generateFeeSummaryPDF);

// Student specific
router.get('/clearance/:studentId', 
    validateObjectId('studentId'), 
    authorize('principal', 'admin', 'accountant', 'student', 'parent'), 
    getClearance
);
router.get('/history/:studentId', 
    validateObjectId('studentId'), 
    authorize('principal', 'admin', 'accountant', 'student', 'parent'), 
    getStudentFeeHistory
);

// Special permission (Principal only)
router.put('/special-permission/:studentId', 
    validateObjectId('studentId'), 
    principalOnly, 
    giveSpecialPermission
);
router.put('/revoke-permission/:studentId', 
    validateObjectId('studentId'), 
    principalOnly, 
    revokeSpecialPermission
);

module.exports = router;
