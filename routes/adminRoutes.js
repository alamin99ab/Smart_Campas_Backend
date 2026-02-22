const express = require('express');
const router = express.Router();
const {
    createSchool,
    updateSchool,
    deleteSchool,
    uploadSchoolLogo,
    getAllSchools,
    getSchool,
    getStats,
    exportSchools
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { adminOnly } = require('../middleware/roleMiddleware');
const { upload } = require('../middleware/uploadMiddleware'); // multer setup

router.use(protect);

router.get('/stats', adminOnly, getStats);
router.get('/schools', adminOnly, getAllSchools);
router.get('/schools/export', adminOnly, exportSchools);
router.post('/school', adminOnly, createSchool);
router.put('/school/:id', adminOnly, updateSchool);
router.delete('/school/:id', adminOnly, deleteSchool);
router.post('/school/:id/logo', adminOnly, upload.single('logo'), uploadSchoolLogo);
router.get('/school/:id', adminOnly, getSchool);

module.exports = router;