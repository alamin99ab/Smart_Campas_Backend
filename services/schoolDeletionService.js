const mongoose = require('mongoose');

const logger = require('../utils/logger');
const School = require('../models/School');
const User = require('../models/User');
const Student = require('../models/Student');
const Teacher = require('../models/Teacher');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const AcademicSession = require('../models/AcademicSession');
const Room = require('../models/Room');
const Attendance = require('../models/Attendance');
const AdvancedAttendance = require('../models/AdvancedAttendance');
const Routine = require('../models/Routine');
const ClassRoutine = require('../models/ClassRoutine');
const AdvancedRoutine = require('../models/AdvancedRoutine');
const Exam = require('../models/Exam');
const ExamSchedule = require('../models/ExamSchedule');
const Result = require('../models/Result');
const Notice = require('../models/Notice');
const Notification = require('../models/Notification');
const Fee = require('../models/Fee');
const FeeStructure = require('../models/FeeStructure');
const PaymentHistory = require('../models/PaymentHistory');
const Assignment = require('../models/Assignment');
const SchoolEvent = require('../models/SchoolEvent');
const Admission = require('../models/Admission');
const LeaveRequest = require('../models/LeaveRequest');
const Substitution = require('../models/Substitution');
const TeacherAbsenceRequest = require('../models/TeacherAbsenceRequest');
const TeacherAssignment = require('../models/TeacherAssignment');
const Subscription = require('../models/Subscription');
const AuditLog = require('../models/AuditLog');

const SCHOOL_DELETE_WARNING_THRESHOLD = Number(process.env.SCHOOL_DELETE_WARNING_THRESHOLD || 100000);
const SCHOOL_DELETE_MAX_TRANSACTION_DOCS = Number(process.env.SCHOOL_DELETE_MAX_TRANSACTION_DOCS || 50000);
const SCHOOL_DELETE_BATCH_SIZE = Number(process.env.SCHOOL_DELETE_BATCH_SIZE || 1000);

const SCHOOL_DEPENDENCIES = [
    { key: 'notifications', model: Notification, supportsSchoolCode: true },
    { key: 'auditLogs', model: AuditLog, supportsSchoolCode: true },
    { key: 'attendance', model: Attendance, supportsSchoolCode: true },
    { key: 'advancedAttendance', model: AdvancedAttendance, supportsSchoolCode: false },
    { key: 'results', model: Result, supportsSchoolCode: true },
    { key: 'fees', model: Fee, supportsSchoolCode: true },
    { key: 'paymentHistory', model: PaymentHistory, supportsSchoolCode: true },
    { key: 'assignments', model: Assignment, supportsSchoolCode: true },
    { key: 'examSchedules', model: ExamSchedule, supportsSchoolCode: true },
    { key: 'exams', model: Exam, supportsSchoolCode: true },
    { key: 'teacherAssignments', model: TeacherAssignment, supportsSchoolCode: true },
    { key: 'teacherAbsenceRequests', model: TeacherAbsenceRequest, supportsSchoolCode: true },
    { key: 'substitutions', model: Substitution, supportsSchoolCode: true },
    { key: 'leaveRequests', model: LeaveRequest, supportsSchoolCode: true },
    { key: 'classRoutines', model: ClassRoutine, supportsSchoolCode: true },
    { key: 'routines', model: Routine, supportsSchoolCode: true },
    { key: 'advancedRoutines', model: AdvancedRoutine, supportsSchoolCode: false },
    { key: 'schoolEvents', model: SchoolEvent, supportsSchoolCode: true },
    { key: 'notices', model: Notice, supportsSchoolCode: true },
    { key: 'admissions', model: Admission, supportsSchoolCode: true },
    { key: 'academicSessions', model: AcademicSession, supportsSchoolCode: true },
    { key: 'feeStructures', model: FeeStructure, supportsSchoolCode: true },
    { key: 'rooms', model: Room, supportsSchoolCode: true },
    { key: 'sections', model: Section, supportsSchoolCode: true },
    { key: 'subjects', model: Subject, supportsSchoolCode: true },
    { key: 'classes', model: ClassModel, supportsSchoolCode: true },
    { key: 'students', model: Student, supportsSchoolCode: true },
    { key: 'teachers', model: Teacher, supportsSchoolCode: true },
    { key: 'users', model: User, supportsSchoolCode: true },
    { key: 'subscriptions', model: Subscription, supportsSchoolCode: false }
];

class SchoolDeletionError extends Error {
    constructor(message, statusCode = 500, code = 'SCHOOL_DELETE_ERROR') {
        super(message);
        this.name = 'SchoolDeletionError';
        this.statusCode = statusCode;
        this.code = code;
    }
}

const asObjectId = (value) => {
    if (!value || !mongoose.Types.ObjectId.isValid(value)) {
        throw new SchoolDeletionError('Invalid school id', 400, 'INVALID_SCHOOL_ID');
    }
    return value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(value);
};

const applySession = (query, session) => {
    if (session) {
        query.session(session);
    }
    return query;
};

const buildScopedFilter = ({ schoolId, schoolCode, supportsSchoolCode }) => {
    if (!supportsSchoolCode) {
        return { schoolId };
    }

    return {
        $or: [
            { schoolId },
            {
                schoolCode,
                $or: [
                    { schoolId: { $exists: false } },
                    { schoolId: null },
                    { schoolId: { $type: 'string' } }
                ]
            }
        ]
    };
};

const countScopedDocuments = async ({ model, filter, session }) => {
    const query = model.countDocuments(filter);
    const result = await applySession(query, session);
    return Number(result || 0);
};

const deleteModelInBatches = async ({ model, filter, session, batchSize }) => {
    let deleted = 0;

    while (true) {
        let idQuery = model.find(filter).select({ _id: 1 }).limit(batchSize).lean();
        idQuery = applySession(idQuery, session);
        const ids = await idQuery;
        if (!ids.length) {
            break;
        }

        const deleteResult = await model.deleteMany(
            { _id: { $in: ids.map((doc) => doc._id) } },
            session ? { session } : {}
        );
        deleted += Number(deleteResult.deletedCount || 0);
    }

    return deleted;
};

const deleteScopedDocuments = async ({ model, filter, session, expectedCount, batchSize }) => {
    if (expectedCount === 0) {
        return 0;
    }

    if (expectedCount <= batchSize) {
        const deleteResult = await model.deleteMany(filter, session ? { session } : {});
        return Number(deleteResult.deletedCount || 0);
    }

    return deleteModelInBatches({ model, filter, session, batchSize });
};

const isTransactionUnavailableError = (error) => {
    const message = `${error?.message || ''}`.toLowerCase();
    return (
        message.includes('transaction numbers are only allowed on a replica set member or mongos') ||
        message.includes('replica set') ||
        message.includes('transactions are not supported')
    );
};

const buildDeletionPlan = ({ schoolId, schoolCode }) =>
    SCHOOL_DEPENDENCIES.map((dependency) => ({
        ...dependency,
        filter: buildScopedFilter({
            schoolId,
            schoolCode,
            supportsSchoolCode: dependency.supportsSchoolCode
        })
    }));

const executeDeletePlan = async ({
    plan,
    dryRun,
    session,
    batchSize
}) => {
    const deleted = {};
    let totalDeleted = 0;

    for (const item of plan) {
        const count = await countScopedDocuments({
            model: item.model,
            filter: item.filter,
            session
        });

        if (dryRun) {
            deleted[item.key] = count;
            totalDeleted += count;
            continue;
        }

        const deletedCount = await deleteScopedDocuments({
            model: item.model,
            filter: item.filter,
            session,
            expectedCount: count,
            batchSize
        });
        deleted[item.key] = deletedCount;
        totalDeleted += deletedCount;
    }

    return { deleted, totalDeleted };
};

const deleteSchoolService = async ({
    schoolId,
    confirm = false,
    dryRun = false,
    force = false,
    allowUnsafeWithoutTransaction = false,
    confirmSchoolCode = ''
}) => {
    const schoolObjectId = asObjectId(schoolId);
    const school = await School.findById(schoolObjectId).select('_id schoolCode schoolName').lean();

    if (!school) {
        throw new SchoolDeletionError('School not found', 404, 'SCHOOL_NOT_FOUND');
    }

    if (!dryRun && !confirm) {
        throw new SchoolDeletionError(
            'Confirmation is required. Pass confirm=true to delete this school.',
            400,
            'DELETE_CONFIRMATION_REQUIRED'
        );
    }

    const normalizedConfirmSchoolCode = `${confirmSchoolCode || ''}`.trim().toUpperCase();
    if (normalizedConfirmSchoolCode && normalizedConfirmSchoolCode !== school.schoolCode) {
        throw new SchoolDeletionError(
            `confirmSchoolCode mismatch. Expected ${school.schoolCode}.`,
            400,
            'CONFIRM_SCHOOL_CODE_MISMATCH'
        );
    }

    const plan = buildDeletionPlan({
        schoolId: schoolObjectId,
        schoolCode: school.schoolCode
    });

    const preview = await executeDeletePlan({
        plan,
        dryRun: true,
        session: null,
        batchSize: SCHOOL_DELETE_BATCH_SIZE
    });

    const warnings = [];
    if (preview.totalDeleted > SCHOOL_DELETE_WARNING_THRESHOLD) {
        warnings.push(
            `High volume delete detected (${preview.totalDeleted} documents across ${plan.length} collections).`
        );
    }

    if (!dryRun && preview.totalDeleted > SCHOOL_DELETE_MAX_TRANSACTION_DOCS && !force) {
        throw new SchoolDeletionError(
            `Delete impact (${preview.totalDeleted}) exceeds safe transaction threshold (${SCHOOL_DELETE_MAX_TRANSACTION_DOCS}). Re-run with force=true after dry-run validation.`,
            409,
            'DELETE_FORCE_REQUIRED'
        );
    }

    if (dryRun) {
        return {
            school,
            dryRun: true,
            warnings,
            transactionUsed: false,
            fallbackWithoutTransaction: false,
            deleted: preview.deleted,
            summary: {
                collections: plan.length,
                totalMatchedDocuments: preview.totalDeleted,
                schoolDocument: 1
            }
        };
    }

    const mustFallbackToNonTransaction = preview.totalDeleted > SCHOOL_DELETE_MAX_TRANSACTION_DOCS;
    let transactionUsed = false;
    let fallbackWithoutTransaction = false;
    let deleteResult = null;

    const runDelete = async (session) => {
        const deletePlanResult = await executeDeletePlan({
            plan,
            dryRun: false,
            session,
            batchSize: SCHOOL_DELETE_BATCH_SIZE
        });

        const schoolDeleteResult = await School.deleteOne(
            { _id: schoolObjectId },
            session ? { session } : {}
        );

        return {
            ...deletePlanResult,
            schoolDeletedCount: Number(schoolDeleteResult.deletedCount || 0)
        };
    };

    if (mustFallbackToNonTransaction) {
        if (!allowUnsafeWithoutTransaction) {
            throw new SchoolDeletionError(
                'Delete requires non-transaction fallback for this data size. Re-run with allowUnsafeWithoutTransaction=true only after dry-run review.',
                409,
                'NON_TRANSACTION_FALLBACK_REQUIRED'
            );
        }
        fallbackWithoutTransaction = true;
        warnings.push('Transaction skipped due to large delete volume; executed as controlled batched deletes.');
        deleteResult = await runDelete(null);
    } else {
        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                transactionUsed = true;
                deleteResult = await runDelete(session);
            });
        } catch (error) {
            if (!allowUnsafeWithoutTransaction || !isTransactionUnavailableError(error)) {
                throw error;
            }

            fallbackWithoutTransaction = true;
            warnings.push('Transaction unavailable; executed in controlled non-transaction mode.');
            logger.warn('School delete fallback to non-transaction mode', {
                schoolId: school._id.toString(),
                schoolCode: school.schoolCode,
                reason: error.message
            });
            deleteResult = await runDelete(null);
        } finally {
            await session.endSession();
        }
    }

    const totalDeleted = deleteResult.totalDeleted + deleteResult.schoolDeletedCount;

    logger.audit('School deletion executed', {
        schoolId: school._id.toString(),
        schoolCode: school.schoolCode,
        transactionUsed,
        fallbackWithoutTransaction,
        totalDeleted
    });

    return {
        school,
        dryRun: false,
        warnings,
        transactionUsed,
        fallbackWithoutTransaction,
        deleted: {
            ...deleteResult.deleted,
            school: deleteResult.schoolDeletedCount
        },
        summary: {
            collections: plan.length + 1,
            totalDeletedDocuments: totalDeleted
        }
    };
};

module.exports = {
    deleteSchoolService,
    SCHOOL_DEPENDENCIES,
    SchoolDeletionError
};
