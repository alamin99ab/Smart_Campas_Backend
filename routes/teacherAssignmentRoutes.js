const express = require('express');
const router = express.Router();
const {
    assignSubject,
    getTeacherAssignments,
    getTeacherAssignmentsByTeacher,
    getTeacherLoad,
    updateAssignment,
    deleteAssignment
} = require('../controllers/teacherAssignmentController');
const { protect } = require('../middleware/authMiddleware');
const { ensureTenantIsolation, addSchoolScope } = require('../middleware/multiTenant');

const allowAssignmentReaders = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            data: null
        });
    }

    if (!['principal', 'admin', 'teacher'].includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            message: 'Only principal/admin/teacher can access assignment data',
            data: null
        });
    }

    return next();
};

const allowAssignmentWriters = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            data: null
        });
    }

    if (!['principal', 'admin'].includes(req.user.role)) {
        return res.status(403).json({
            success: false,
            code: 'FORBIDDEN',
            message: 'Only principal/admin can modify teacher assignments',
            data: null
        });
    }

    return next();
};

router.use(protect);
router.use(ensureTenantIsolation);
router.use(addSchoolScope);

router.post('/', allowAssignmentWriters, assignSubject);
router.get('/', allowAssignmentReaders, getTeacherAssignments);
router.get('/teacher/:teacherId/load', allowAssignmentReaders, getTeacherLoad);
router.get('/teacher/:teacherId', allowAssignmentReaders, getTeacherAssignmentsByTeacher);
router.put('/:id', allowAssignmentWriters, updateAssignment);
router.delete('/:id', allowAssignmentWriters, deleteAssignment);

module.exports = router;
