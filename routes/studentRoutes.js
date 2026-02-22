const express = require('express');
const router = express.Router();
const {
    addStudent,
    getStudents,
    getStudentById,
    updateStudent,
    deleteStudent,
    uploadPhoto,
    getStudentsByClass,
    exportStudents,
    upload
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { principalOnly } = require('../middleware/roleMiddleware');

// All routes protected
router.use(protect);

// Export (principal/admin only)
router.get('/export', authorize('principal', 'admin'), exportStudents);

// By class (for attendance)
router.get('/by-class', getStudentsByClass);

// CRUD
router.route('/')
    .post(authorize('teacher', 'principal'), addStudent)
    .get(getStudents);

router.route('/:id')
    .get(getStudentById)
    .put(authorize('teacher', 'principal'), updateStudent)
    .delete(principalOnly, deleteStudent);

// Photo upload
router.post('/:id/photo', authorize('teacher', 'principal'), upload, uploadPhoto);

module.exports = router;