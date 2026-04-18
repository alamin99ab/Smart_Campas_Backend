const express = require('express');
const router = express.Router();
const {
    applyAdmission,
    uploadDocuments,
    approveAdmission,
    confirmRegistration,
    getAdmissions,
    getAdmissionById
} = require('../controllers/admissionController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, addSchoolScope } = require('../middleware/multiTenant');
const { upload } = require('../middleware/uploadMiddleware');

router.post('/apply', applyAdmission);
router.use(protect);
router.use(ensureTenantIsolation);
router.use(addSchoolScope);

router.post('/:id/documents', upload.array('documents', 10), uploadDocuments);
router.put('/:id/approve', authorize('principal', 'admin'), approveAdmission);
router.post('/:id/confirm', authorize('principal', 'admin'), confirmRegistration);
router.get('/', getAdmissions);
router.get('/:id', getAdmissionById);

module.exports = router;
