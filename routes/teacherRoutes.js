const express = require('express');
const router = express.Router();
const {
    getTeachers,
    getTeacherById,
    createTeacher,
    updateTeacher,
    deleteTeacher,
    assignSubjects,
    getTeacherSchedule,
    uploadPhoto
} = require('../controllers/teacherController');
const { protect, authorize } = require('../middleware/authMiddleware');
const { principalOnly } = require('../middleware/roleMiddleware');
const { upload } = require('../middleware/uploadMiddleware');

// All routes protected
router.use(protect);

// CRUD operations
router.route('/')
    .get(getTeachers)
    .post(authorize('principal', 'admin'), createTeacher);

router.route('/:id')
    .get(getTeacherById)
    .put(authorize('principal', 'admin', 'teacher'), updateTeacher)
    .delete(principalOnly, deleteTeacher);

// Subject assignment
router.post('/:id/subjects', authorize('principal', 'admin'), assignSubjects);
router.get('/:id/schedule', getTeacherSchedule);

// Photo upload
router.post('/:id/photo', authorize('principal', 'admin', 'teacher'), upload.single('photo'), uploadPhoto);

module.exports = router;
