const express = require('express');
const router = express.Router();
const {
    assignSubject,
    getTeacherAssignments,
    getTeacherLoad,
    updateAssignment,
    deleteAssignment
} = require('../controllers/teacherAssignmentController');
const { protect, authorize } = require('../middleware/authMiddleware');

router.use(protect);

router.post('/', authorize('principal', 'admin'), assignSubject);
router.get('/', getTeacherAssignments);
router.get('/teacher/:teacherId/load', getTeacherLoad);
router.put('/:id', authorize('principal', 'admin'), updateAssignment);
router.delete('/:id', authorize('principal', 'admin'), deleteAssignment);

module.exports = router;
