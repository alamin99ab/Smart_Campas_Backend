const mongoose = require('mongoose');
const TeacherAssignment = require('../models/TeacherAssignment');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Class = require('../models/Class');

class AssignmentServiceError extends Error {
    constructor(status, code, message, details = null) {
        super(message);
        this.status = status;
        this.code = code;
        this.details = details;
    }
}

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const toUniqueIdStrings = (ids = []) => {
    return [...new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean).map(String))];
};

const getPopulatedAssignmentById = async (assignmentId) => {
    return TeacherAssignment.findById(assignmentId)
        .populate('teacher', 'name email role schoolCode')
        .populate('subject', 'subjectName subjectCode classLevels')
        .populate('classes', 'className section classLevel academicYear')
        .populate('assignedBy', 'name email role')
        .lean();
};

const syncClassSubjectMapping = ({
    classDoc,
    teacher,
    subject,
    removeSubjectId,
    shouldContainNewSubject,
    periodsPerWeek
}) => {
    const removeSubjectIdString = removeSubjectId ? String(removeSubjectId) : null;

    if (removeSubjectIdString) {
        const removeIndex = (classDoc.subjects || []).findIndex(
            (item) =>
                String(item.subjectId) === removeSubjectIdString &&
                String(item.teacherId) === String(teacher._id)
        );
        if (removeIndex >= 0) {
            classDoc.subjects.splice(removeIndex, 1);
        }
    }

    if (!shouldContainNewSubject) {
        return;
    }

    const subjectIndex = (classDoc.subjects || []).findIndex(
        (item) => String(item.subjectId) === String(subject._id)
    );

    const payload = {
        subjectId: subject._id,
        subjectName: subject.subjectName,
        subjectCode: subject.subjectCode,
        teacherId: teacher._id,
        teacherName: teacher.name,
        periodsPerWeek,
        isActive: true
    };

    if (subjectIndex >= 0) {
        classDoc.subjects[subjectIndex] = {
            ...(classDoc.subjects[subjectIndex].toObject ? classDoc.subjects[subjectIndex].toObject() : classDoc.subjects[subjectIndex]),
            ...payload
        };
    } else {
        classDoc.subjects.push(payload);
    }
};

const enforceTeacherReadAccess = ({ requester, teacherId }) => {
    if (!requester) {
        throw new AssignmentServiceError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    if (requester.role === 'teacher' && String(requester._id || requester.id) !== String(teacherId)) {
        throw new AssignmentServiceError(403, 'FORBIDDEN', 'Teachers can only access their own assignments');
    }
};

const assignTeacherSubjectToClasses = async ({
    requester,
    schoolCode,
    teacherId,
    subjectId,
    classIds,
    periodsPerWeek = 5,
    academicYear,
    semester
}) => {
    if (!requester) {
        throw new AssignmentServiceError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    if (!schoolCode) {
        throw new AssignmentServiceError(400, 'SCHOOL_SCOPE_REQUIRED', 'School context is required');
    }
    const schoolId = requester?.schoolId || null;

    if (!teacherId || !subjectId) {
        throw new AssignmentServiceError(400, 'VALIDATION_ERROR', 'teacherId and subjectId are required');
    }

    if (!isValidObjectId(teacherId) || !isValidObjectId(subjectId)) {
        throw new AssignmentServiceError(400, 'INVALID_ID', 'teacherId or subjectId is not a valid ObjectId');
    }

    const classIdStrings = toUniqueIdStrings(classIds);
    if (classIdStrings.length === 0) {
        throw new AssignmentServiceError(400, 'VALIDATION_ERROR', 'At least one classId is required');
    }

    const invalidClassId = classIdStrings.find((id) => !isValidObjectId(id));
    if (invalidClassId) {
        throw new AssignmentServiceError(400, 'INVALID_ID', `Invalid classId: ${invalidClassId}`);
    }

    const session = await mongoose.startSession();
    let assignmentId;

    try {
        await session.withTransaction(async () => {
            const [teacher, subject, classes] = await Promise.all([
                User.findOne({ _id: teacherId, schoolCode, role: 'teacher', isActive: true }).session(session),
                Subject.findOne({ _id: subjectId, schoolCode, isActive: true }).session(session),
                Class.find({ _id: { $in: classIdStrings }, schoolCode, isActive: true }).session(session)
            ]);

            if (!teacher) {
                throw new AssignmentServiceError(404, 'TEACHER_NOT_FOUND', 'Teacher not found in this school');
            }

            if (!subject) {
                throw new AssignmentServiceError(404, 'SUBJECT_NOT_FOUND', 'Subject not found in this school');
            }

            if (classes.length !== classIdStrings.length) {
                const found = new Set(classes.map((doc) => String(doc._id)));
                const missing = classIdStrings.filter((id) => !found.has(id));
                throw new AssignmentServiceError(404, 'CLASS_NOT_FOUND', 'One or more classes were not found in this school', { missingClassIds: missing });
            }

            const resolvedAcademicYear = academicYear || classes[0].academicYear;
            if (!resolvedAcademicYear) {
                throw new AssignmentServiceError(400, 'ACADEMIC_YEAR_REQUIRED', 'academicYear is required');
            }

            const yearMismatch = classes.find((doc) => doc.academicYear && doc.academicYear !== resolvedAcademicYear);
            if (yearMismatch) {
                throw new AssignmentServiceError(400, 'CLASS_ACADEMIC_YEAR_MISMATCH', 'All assigned classes must belong to the same academic year');
            }

            const classObjectIds = classes.map((doc) => doc._id);
            const sections = [...new Set(classes.map((doc) => doc.section).filter(Boolean))];

            const assignment = await TeacherAssignment.findOneAndUpdate(
                {
                    schoolCode,
                    teacher: teacher._id,
                    subject: subject._id,
                    academicYear: resolvedAcademicYear
                },
                {
                    $set: {
                        ...(schoolId ? { schoolId } : {}),
                        schoolCode,
                        teacher: teacher._id,
                        subject: subject._id,
                        subjectName: subject.subjectName,
                        periodsPerWeek: Number.isFinite(Number(periodsPerWeek)) ? Number(periodsPerWeek) : 5,
                        semester: semester || null,
                        assignedBy: requester._id || requester.id,
                        isActive: true
                    },
                    $addToSet: {
                        classes: { $each: classObjectIds },
                        sections: { $each: sections }
                    },
                    $setOnInsert: {
                        assignedAt: new Date()
                    }
                },
                {
                    new: true,
                    upsert: true,
                    runValidators: true,
                    session
                }
            );

            assignmentId = assignment._id;

            for (const classDoc of classes) {
                const subjectIndex = (classDoc.subjects || []).findIndex(
                    (item) => String(item.subjectId) === String(subject._id)
                );

                const classSubjectPayload = {
                    subjectId: subject._id,
                    subjectName: subject.subjectName,
                    subjectCode: subject.subjectCode,
                    teacherId: teacher._id,
                    teacherName: teacher.name,
                    periodsPerWeek: Number.isFinite(Number(periodsPerWeek)) ? Number(periodsPerWeek) : 5,
                    isActive: true
                };

                if (subjectIndex >= 0) {
                    classDoc.subjects[subjectIndex] = {
                        ...(classDoc.subjects[subjectIndex].toObject ? classDoc.subjects[subjectIndex].toObject() : classDoc.subjects[subjectIndex]),
                        ...classSubjectPayload
                    };
                } else {
                    classDoc.subjects.push(classSubjectPayload);
                }

                await classDoc.save({ session });
            }
        });
    } catch (error) {
        if (error instanceof AssignmentServiceError) {
            throw error;
        }

        if (typeof error?.message === 'string' && error.message.includes('Transaction numbers are only allowed')) {
            throw new AssignmentServiceError(
                503,
                'TRANSACTION_UNAVAILABLE',
                'Teacher assignment requires MongoDB replica set support for transaction safety'
            );
        }

        throw new AssignmentServiceError(500, 'TEACHER_ASSIGNMENT_FAILED', 'Failed to assign teacher to subject', { error: error.message });
    } finally {
        await session.endSession();
    }

    const populatedAssignment = await getPopulatedAssignmentById(assignmentId);
    return {
        assignment: populatedAssignment
    };
};

const getTeacherAssignments = async ({
    requester,
    schoolCode,
    teacherId,
    subjectId,
    academicYear,
    includeInactive = false
}) => {
    if (!requester) {
        throw new AssignmentServiceError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    if (!schoolCode) {
        throw new AssignmentServiceError(400, 'SCHOOL_SCOPE_REQUIRED', 'School context is required');
    }

    const allowedRoles = new Set(['principal', 'admin', 'teacher']);
    if (!allowedRoles.has(requester.role)) {
        throw new AssignmentServiceError(403, 'FORBIDDEN', 'Role is not allowed to access teacher assignments');
    }

    const query = { schoolCode };
    if (!includeInactive) {
        query.isActive = true;
    }

    if (teacherId) {
        if (!isValidObjectId(teacherId)) {
            throw new AssignmentServiceError(400, 'INVALID_ID', 'teacherId is not a valid ObjectId');
        }
        enforceTeacherReadAccess({ requester, teacherId });
        query.teacher = teacherId;
    } else if (requester.role === 'teacher') {
        query.teacher = requester._id || requester.id;
    }

    if (subjectId) {
        if (!isValidObjectId(subjectId)) {
            throw new AssignmentServiceError(400, 'INVALID_ID', 'subjectId is not a valid ObjectId');
        }
        query.subject = subjectId;
    }

    if (academicYear) {
        query.academicYear = academicYear;
    }

    return TeacherAssignment.find(query)
        .populate('teacher', 'name email role schoolCode')
        .populate('subject', 'subjectName subjectCode classLevels')
        .populate('classes', 'className section classLevel academicYear')
        .populate('assignedBy', 'name email role')
        .sort({ updatedAt: -1 })
        .lean();
};

const getTeacherLoad = async ({ requester, schoolCode, teacherId, academicYear }) => {
    enforceTeacherReadAccess({ requester, teacherId });

    const assignments = await getTeacherAssignments({
        requester,
        schoolCode,
        teacherId,
        academicYear
    });

    const uniqueClassMap = new Map();
    assignments.forEach((assignment) => {
        (assignment.classes || []).forEach((classDoc) => {
            uniqueClassMap.set(String(classDoc._id), classDoc);
        });
    });

    return {
        teacherId: String(teacherId),
        totalSubjects: assignments.length,
        totalPeriodsPerWeek: assignments.reduce((sum, item) => sum + (item.periodsPerWeek || 0), 0),
        classes: Array.from(uniqueClassMap.values()),
        subjects: assignments.map((item) => ({
            assignmentId: item._id,
            subject: item.subject,
            classes: item.classes || [],
            periodsPerWeek: item.periodsPerWeek || 0,
            academicYear: item.academicYear,
            semester: item.semester || null
        }))
    };
};

const updateTeacherAssignment = async ({
    requester,
    schoolCode,
    assignmentId,
    subjectId,
    classIds,
    classId,
    periodsPerWeek,
    academicYear,
    semester,
    isActive
}) => {
    if (!requester) {
        throw new AssignmentServiceError(401, 'UNAUTHORIZED', 'Authentication required');
    }

    if (!schoolCode) {
        throw new AssignmentServiceError(400, 'SCHOOL_SCOPE_REQUIRED', 'School context is required');
    }
    const schoolId = requester?.schoolId || null;

    if (!assignmentId || !isValidObjectId(assignmentId)) {
        throw new AssignmentServiceError(400, 'INVALID_ID', 'assignmentId is not a valid ObjectId');
    }

    const requestedClassIds = classIds !== undefined
        ? toUniqueIdStrings(classIds)
        : (classId !== undefined ? toUniqueIdStrings(classId) : null);

    if (requestedClassIds) {
        const invalidClassId = requestedClassIds.find((id) => !isValidObjectId(id));
        if (invalidClassId) {
            throw new AssignmentServiceError(400, 'INVALID_ID', `Invalid classId: ${invalidClassId}`);
        }
    }

    if (subjectId !== undefined && !isValidObjectId(subjectId)) {
        throw new AssignmentServiceError(400, 'INVALID_ID', 'subjectId is not a valid ObjectId');
    }

    const normalizedPeriods = periodsPerWeek === undefined
        ? undefined
        : Number(periodsPerWeek);

    if (normalizedPeriods !== undefined && !Number.isFinite(normalizedPeriods)) {
        throw new AssignmentServiceError(400, 'VALIDATION_ERROR', 'periodsPerWeek must be a number');
    }

    const session = await mongoose.startSession();
    let updatedAssignmentId = null;

    try {
        await session.withTransaction(async () => {
            const assignment = await TeacherAssignment.findOne({
                _id: assignmentId,
                schoolCode
            }).session(session);

            if (!assignment) {
                throw new AssignmentServiceError(404, 'TEACHER_ASSIGNMENT_NOT_FOUND', 'Assignment not found');
            }

            const targetSubjectId = subjectId || String(assignment.subject);
            const oldSubjectId = String(assignment.subject);
            const oldClassIds = (assignment.classes || []).map((id) => String(id));
            const targetClassIds = requestedClassIds !== null ? requestedClassIds : oldClassIds;

            if (targetClassIds.length === 0) {
                throw new AssignmentServiceError(400, 'VALIDATION_ERROR', 'At least one classId is required');
            }

            const [teacher, subject, targetClasses] = await Promise.all([
                User.findOne({
                    _id: assignment.teacher,
                    schoolCode,
                    role: 'teacher',
                    isActive: true
                }).session(session),
                Subject.findOne({
                    _id: targetSubjectId,
                    schoolCode,
                    isActive: true
                }).session(session),
                Class.find({
                    _id: { $in: targetClassIds },
                    schoolCode,
                    isActive: true
                }).session(session)
            ]);

            if (!teacher) {
                throw new AssignmentServiceError(404, 'TEACHER_NOT_FOUND', 'Teacher not found in this school');
            }

            if (!subject) {
                throw new AssignmentServiceError(404, 'SUBJECT_NOT_FOUND', 'Subject not found in this school');
            }

            if (targetClasses.length !== targetClassIds.length) {
                const found = new Set(targetClasses.map((doc) => String(doc._id)));
                const missing = targetClassIds.filter((id) => !found.has(id));
                throw new AssignmentServiceError(
                    404,
                    'CLASS_NOT_FOUND',
                    'One or more classes were not found in this school',
                    { missingClassIds: missing }
                );
            }

            const targetAcademicYear = academicYear || assignment.academicYear || targetClasses[0]?.academicYear;
            if (!targetAcademicYear) {
                throw new AssignmentServiceError(400, 'ACADEMIC_YEAR_REQUIRED', 'academicYear is required');
            }

            const mismatchClass = targetClasses.find(
                (classDoc) => classDoc.academicYear && classDoc.academicYear !== targetAcademicYear
            );
            if (mismatchClass) {
                throw new AssignmentServiceError(
                    400,
                    'CLASS_ACADEMIC_YEAR_MISMATCH',
                    'All assigned classes must belong to the same academic year'
                );
            }

            const conflictingAssignment = await TeacherAssignment.findOne({
                _id: { $ne: assignment._id },
                schoolCode,
                teacher: teacher._id,
                subject: subject._id,
                academicYear: targetAcademicYear
            }).select('_id').session(session);

            if (conflictingAssignment) {
                throw new AssignmentServiceError(
                    409,
                    'DUPLICATE_ASSIGNMENT',
                    'An assignment for this teacher, subject, and academic year already exists'
                );
            }

            assignment.subject = subject._id;
            assignment.subjectName = subject.subjectName;
            assignment.classes = targetClasses.map((doc) => doc._id);
            assignment.sections = [...new Set(targetClasses.map((doc) => doc.section).filter(Boolean))];
            assignment.academicYear = targetAcademicYear;
            if (schoolId && !assignment.schoolId) {
                assignment.schoolId = schoolId;
            }

            if (normalizedPeriods !== undefined) {
                assignment.periodsPerWeek = normalizedPeriods;
            }
            if (semester !== undefined) {
                assignment.semester = semester;
            }
            if (isActive !== undefined) {
                assignment.isActive = Boolean(isActive);
            }

            await assignment.save({ session });
            updatedAssignmentId = assignment._id;

            const affectedClassIds = [...new Set([...oldClassIds, ...targetClassIds])];
            if (affectedClassIds.length > 0) {
                const affectedClassDocs = await Class.find({
                    _id: { $in: affectedClassIds },
                    schoolCode
                }).session(session);

                const targetClassSet = new Set(targetClassIds);
                const periods = assignment.periodsPerWeek || 0;
                const subjectChanged = oldSubjectId !== String(subject._id);

                for (const classDoc of affectedClassDocs) {
                    const classId = String(classDoc._id);
                    const inTargetClasses = assignment.isActive && targetClassSet.has(classId);
                    const shouldRemoveOld = subjectChanged || !inTargetClasses;

                    syncClassSubjectMapping({
                        classDoc,
                        teacher,
                        subject,
                        removeSubjectId: shouldRemoveOld ? oldSubjectId : null,
                        shouldContainNewSubject: inTargetClasses,
                        periodsPerWeek: periods
                    });

                    await classDoc.save({ session });
                }
            }
        });
    } catch (error) {
        if (error instanceof AssignmentServiceError) {
            throw error;
        }

        if (typeof error?.message === 'string' && error.message.includes('Transaction numbers are only allowed')) {
            throw new AssignmentServiceError(
                503,
                'TRANSACTION_UNAVAILABLE',
                'Teacher assignment update requires MongoDB replica set support for transaction safety'
            );
        }

        throw new AssignmentServiceError(
            500,
            'TEACHER_ASSIGNMENT_UPDATE_FAILED',
            'Failed to update teacher assignment',
            { error: error.message }
        );
    } finally {
        await session.endSession();
    }

    return getPopulatedAssignmentById(updatedAssignmentId);
};

module.exports = {
    AssignmentServiceError,
    assignTeacherSubjectToClasses,
    getTeacherAssignments,
    getTeacherLoad,
    enforceTeacherReadAccess,
    updateTeacherAssignment
};
