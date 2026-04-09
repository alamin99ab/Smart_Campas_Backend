const mongoose = require('mongoose');
const TeacherAssignment = require('../models/TeacherAssignment');
const Class = require('../models/Class');
const AuditLog = require('../models/AuditLog');
const {
    AssignmentServiceError,
    assignTeacherSubjectToClasses,
    getTeacherAssignments: getAssignmentsFromService,
    getTeacherLoad: getTeacherLoadFromService,
    updateTeacherAssignment: updateAssignmentFromService
} = require('../services/teacherAssignmentService');

const sendSuccess = (res, status, code, message, data) => {
    return res.status(status).json({
        success: true,
        code,
        message,
        data
    });
};

const sendError = (res, status, code, message, data = null) => {
    return res.status(status).json({
        success: false,
        code,
        message,
        data
    });
};

const handleControllerError = (res, error, fallbackCode, fallbackMessage) => {
    if (error instanceof AssignmentServiceError) {
        return sendError(res, error.status, error.code, error.message, error.details || null);
    }

    if (typeof error?.message === 'string' && error.message.includes('Transaction numbers are only allowed')) {
        return sendError(
            res,
            503,
            'TRANSACTION_UNAVAILABLE',
            'This operation requires MongoDB replica set support for transaction safety'
        );
    }

    console.error(`${fallbackCode}:`, error);
    return sendError(res, 500, fallbackCode, fallbackMessage, {
        error: error.message
    });
};

const isPrivilegedAssignmentViewer = (role) => role === 'principal' || role === 'admin';

exports.assignSubject = async (req, res) => {
    try {
        if (!isPrivilegedAssignmentViewer(req.user?.role)) {
            return sendError(res, 403, 'FORBIDDEN', 'Only principal/admin can assign teachers');
        }

        const { teacherId, subject, subjectId, classes, classId, periodsPerWeek, academicYear, semester } = req.body;
        const classIds = Array.isArray(classes) && classes.length > 0 ? classes : (classId ? [classId] : []);

        const result = await assignTeacherSubjectToClasses({
            requester: req.user,
            schoolCode: req.user.schoolCode,
            teacherId,
            subjectId: subjectId || subject,
            classIds,
            periodsPerWeek,
            academicYear,
            semester
        });

        try {
            await AuditLog.create({
                user: req.user._id,
                action: 'TEACHER_SUBJECT_ASSIGNED',
                details: { teacherId, subjectId: subjectId || subject, classIds },
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
        } catch (auditError) {
            console.error('TEACHER_ASSIGNMENT_AUDIT_FAILED:', auditError.message);
        }

        return sendSuccess(
            res,
            201,
            'TEACHER_ASSIGNMENT_SAVED',
            'Teacher assignment saved successfully',
            result
        );
    } catch (error) {
        return handleControllerError(
            res,
            error,
            'TEACHER_ASSIGNMENT_CREATE_FAILED',
            'Failed to assign teacher'
        );
    }
};

exports.getTeacherAssignments = async (req, res) => {
    try {
        const { teacherId, subject, subjectId, academicYear, includeInactive } = req.query;
        const assignments = await getAssignmentsFromService({
            requester: req.user,
            schoolCode: req.user?.schoolCode,
            teacherId,
            subjectId: subjectId || subject,
            academicYear,
            includeInactive: includeInactive === 'true'
        });

        return sendSuccess(
            res,
            200,
            'TEACHER_ASSIGNMENTS_FETCHED',
            'Teacher assignments fetched successfully',
            assignments
        );
    } catch (error) {
        return handleControllerError(
            res,
            error,
            'TEACHER_ASSIGNMENTS_FETCH_FAILED',
            'Failed to fetch teacher assignments'
        );
    }
};

exports.getTeacherAssignmentsByTeacher = async (req, res) => {
    try {
        const { teacherId } = req.params;
        const { academicYear, includeInactive } = req.query;

        const assignments = await getAssignmentsFromService({
            requester: req.user,
            schoolCode: req.user?.schoolCode,
            teacherId,
            academicYear,
            includeInactive: includeInactive === 'true'
        });

        return sendSuccess(
            res,
            200,
            'TEACHER_ASSIGNMENTS_BY_TEACHER_FETCHED',
            'Teacher assignment details fetched successfully',
            assignments
        );
    } catch (error) {
        return handleControllerError(
            res,
            error,
            'TEACHER_ASSIGNMENT_DETAIL_FETCH_FAILED',
            'Failed to fetch teacher assignment details'
        );
    }
};

exports.getMyAssignments = async (req, res) => {
    try {
        const teacherId = req.user?._id || req.user?.id;
        const { academicYear, includeInactive } = req.query;
        const assignments = await getAssignmentsFromService({
            requester: req.user,
            schoolCode: req.user?.schoolCode,
            teacherId,
            academicYear,
            includeInactive: includeInactive === 'true'
        });

        return sendSuccess(
            res,
            200,
            'MY_TEACHER_ASSIGNMENTS_FETCHED',
            'My teacher assignments fetched successfully',
            assignments
        );
    } catch (error) {
        return handleControllerError(
            res,
            error,
            'MY_TEACHER_ASSIGNMENT_FETCH_FAILED',
            'Failed to fetch my assignments'
        );
    }
};

exports.getTeacherLoad = async (req, res) => {
    try {
        const { teacherId } = req.params;
        const { academicYear } = req.query;

        const loadSummary = await getTeacherLoadFromService({
            requester: req.user,
            schoolCode: req.user?.schoolCode,
            teacherId,
            academicYear
        });

        return sendSuccess(
            res,
            200,
            'TEACHER_LOAD_FETCHED',
            'Teacher load fetched successfully',
            loadSummary
        );
    } catch (error) {
        return handleControllerError(
            res,
            error,
            'TEACHER_LOAD_FETCH_FAILED',
            'Failed to fetch teacher load'
        );
    }
};

exports.updateAssignment = async (req, res) => {
    try {
        if (!isPrivilegedAssignmentViewer(req.user?.role)) {
            return sendError(res, 403, 'FORBIDDEN', 'Only principal/admin can update assignments');
        }
        const populated = await updateAssignmentFromService({
            requester: req.user,
            schoolCode: req.user.schoolCode,
            assignmentId: req.params.id,
            classIds: req.body.classes,
            classId: req.body.classId,
            subjectId: req.body.subjectId || req.body.subject,
            periodsPerWeek: req.body.periodsPerWeek,
            academicYear: req.body.academicYear,
            semester: req.body.semester,
            isActive: req.body.isActive
        });

        return sendSuccess(
            res,
            200,
            'TEACHER_ASSIGNMENT_UPDATED',
            'Assignment updated successfully',
            populated
        );
    } catch (error) {
        return handleControllerError(
            res,
            error,
            'TEACHER_ASSIGNMENT_UPDATE_FAILED',
            'Failed to update assignment'
        );
    }
};

exports.deleteAssignment = async (req, res) => {
    try {
        if (!isPrivilegedAssignmentViewer(req.user?.role)) {
            return sendError(res, 403, 'FORBIDDEN', 'Only principal/admin can delete assignments');
        }
        const session = await mongoose.startSession();
        let deletedAssignmentId = null;

        try {
            await session.withTransaction(async () => {
                const assignment = await TeacherAssignment.findOne({
                    _id: req.params.id,
                    schoolCode: req.user.schoolCode
                }).session(session);

                if (!assignment) {
                    throw new AssignmentServiceError(404, 'TEACHER_ASSIGNMENT_NOT_FOUND', 'Assignment not found');
                }

                const classIds = (assignment.classes || []).map((id) => String(id));
                if (classIds.length > 0) {
                    const classDocs = await Class.find({
                        _id: { $in: classIds },
                        schoolCode: req.user.schoolCode
                    }).session(session);

                    for (const classDoc of classDocs) {
                        const subjectIndex = (classDoc.subjects || []).findIndex(
                            (item) =>
                                String(item.subjectId) === String(assignment.subject) &&
                                String(item.teacherId) === String(assignment.teacher)
                        );

                        if (subjectIndex >= 0) {
                            classDoc.subjects.splice(subjectIndex, 1);
                            await classDoc.save({ session });
                        }
                    }
                }

                await TeacherAssignment.deleteOne({ _id: assignment._id }).session(session);
                deletedAssignmentId = assignment._id;
            });
        } finally {
            await session.endSession();
        }

        return sendSuccess(
            res,
            200,
            'TEACHER_ASSIGNMENT_DELETED',
            'Assignment deleted successfully',
            { id: deletedAssignmentId }
        );
    } catch (error) {
        return handleControllerError(
            res,
            error,
            'TEACHER_ASSIGNMENT_DELETE_FAILED',
            'Failed to delete assignment'
        );
    }
};
