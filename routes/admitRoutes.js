const express = require('express');
const router = express.Router();
const {
    downloadAdmitCard,
    downloadBulkAdmitCards,
    getAdmitTemplate,
    updateAdmitTemplate
} = require('../controllers/admitController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { checkSchoolStatus } = require('../middleware/schoolMiddleware');

router.use(protect);
router.use(checkSchoolStatus);

// Admit card generation
router.get('/:studentId', downloadAdmitCard);
router.post('/bulk', authorize('principal', 'teacher'), downloadBulkAdmitCards);

// Template management (Principal only)
router.get('/template/:schoolCode', getAdmitTemplate);
router.put('/template', authorize('principal'), updateAdmitTemplate);

module.exports = router;