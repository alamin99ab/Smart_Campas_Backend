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
const { upload } = require('../middleware/uploadMiddleware');

router.post('/apply', applyAdmission);
router.post('/:id/documents', protect, upload.array('documents', 10), uploadDocuments);
router.put('/:id/approve', protect, authorize('principal', 'admin'), approveAdmission);
router.post('/:id/confirm', protect, confirmRegistration);
router.get('/', protect, getAdmissions);
router.get('/:id', protect, getAdmissionById);

module.exports = router;
