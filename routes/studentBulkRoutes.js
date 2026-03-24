/**
 * 🎓 STUDENT BULK IMPORT ROUTES
 * Bulk student upload with CSV/JSON/Excel support
 */

const express = require('express');
const router = express.Router();
const studentBulkController = require('../controllers/studentBulkController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

// All routes require authentication and principal role
router.use(protect);
router.use(authorize('principal', 'super_admin'));

// File parsing and validation
router.post('/parse-file', upload.single('file'), studentBulkController.parseStudentFile);

// Import validated students
router.post('/import', studentBulkController.importStudents);

// Download template
router.get('/template', studentBulkController.getTemplate);

// Validate without importing
router.post('/validate', studentBulkController.validateStudents);

module.exports = router;
