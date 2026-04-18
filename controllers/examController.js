/**
 * EXAM CONTROLLER
 * School exam event + class test workflow (multi-tenant safe)
 */

const mongoose = require('mongoose');
const Exam = require('../models/Exam');
const ExamSchedule = require('../models/ExamSchedule');
const Class = require('../models/Class');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const TeacherAssignment = require('../models/TeacherAssignment');
const Result = require('../models/Result');

const EXAM_CATEGORIES = ['school_exam', 'class_test', 'special_exam'];
const EXAM_STATUSES = ['draft', 'scheduled', 'active', 'completed', 'archived'];

const EXAM_TYPE_LABEL_BY_KEY = {
    mid_term: 'Midterm',
    final: 'Final',
    half_yearly: 'Half Yearly',
    annual: 'Annual',
    test_exam: 'Test Exam',
    class_test: 'Class Test',
    quiz: 'Quiz',
    assessment: 'Assessment',
    practical: 'Practical',
    assignment: 'Assignment',
    other: 'Other'
};

const EXAM_TYPE_KEY_ALIASES = {
    midterm: 'mid_term',
    mid_term: 'mid_term',
    'mid-term': 'mid_term',
    final: 'final',
    half_yearly: 'half_yearly',
    'half-yearly': 'half_yearly',
    halfyearly: 'half_yearly',
    annual: 'annual',
    test_exam: 'test_exam',
    'test-exam': 'test_exam',
    testexam: 'test_exam',
    class_test: 'class_test',
    'class-test': 'class_test',
    classtest: 'class_test',
    quiz: 'quiz',
    assessment: 'assessment',
    practical: 'practical',
    assignment: 'assignment',
    other: 'other'
};

const CLASS_TEST_TYPE_KEYS = new Set(['class_test', 'quiz', 'assessment']);

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));
const toObjectId = (value) => (isValidObjectId(value) ? new mongoose.Types.ObjectId(String(value)) : null);

const parsePositiveNumber = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
};

const parseDateValue = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toSectionToken = (value) => {
    const raw = String(value || '').trim();
    return raw ? raw.toUpperCase() : '';
};

const toList = (value) => {
    if (value === undefined || value === null) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        return value.split(',').map((entry) => entry.trim()).filter(Boolean);
    }
    return [value];
};

const parseObjectIdArray = (value) => {
    const seen = new Set();
    const ids = [];
    toList(value).forEach((entry) => {
        if (!isValidObjectId(entry)) return;
        const id = String(entry);
        if (seen.has(id)) return;
        seen.add(id);
        ids.push(new mongoose.Types.ObjectId(id));
    });
    return ids;
};

const normalizeExamTypeKey = (value) => {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    const normalized = raw.replace(/\s+/g, '_');
    return EXAM_TYPE_KEY_ALIASES[normalized] || normalized;
};

const normalizeExamTypeLabel = (value) => {
    const key = normalizeExamTypeKey(value);
    if (!key) return '';
    return EXAM_TYPE_LABEL_BY_KEY[key] || String(value).trim();
};

const buildExamTypeQuery = (value) => {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const key = normalizeExamTypeKey(raw);
    const canonical = EXAM_TYPE_LABEL_BY_KEY[key] || raw;
    const options = new Set([raw, canonical, key]);
    if (key === 'mid_term') options.add('Mid Term');
    if (key === 'class_test') options.add('Class Test');
    if (key === 'test_exam') options.add('Test Exam');
    return { $in: [...options] };
};

const deriveCategory = ({ category, examType, classId, subjectId, specialExam }, existingCategory = null) => {
    if (category !== undefined && category !== null && category !== '') {
        return String(category).trim().toLowerCase();
    }

    if (existingCategory) {
        return existingCategory;
    }

    if (specialExam === true) {
        return 'special_exam';
    }

    const typeKey = normalizeExamTypeKey(examType);
    if (CLASS_TEST_TYPE_KEYS.has(typeKey) && (classId || subjectId)) {
        return 'class_test';
    }
    if (typeKey === 'test_exam') {
        return 'special_exam';
    }
    return 'school_exam';
};

const getSchoolContext = (req) => {
    const schoolCode = String(req.tenant?.schoolCode || req.user?.schoolCode || '').trim().toUpperCase();
    const schoolId = toObjectId(req.tenant?.schoolId || req.user?.schoolId);
    return { schoolCode, schoolId };
};

const makeSchoolQuery = ({ schoolCode, schoolId }) => {
    const clauses = [];
    if (schoolId) clauses.push({ schoolId });
    if (schoolCode) clauses.push({ schoolCode });
    if (!clauses.length) return null;
    return clauses.length === 1 ? clauses[0] : { $or: clauses };
};

const normalizeExamPayload = (payload = {}, { partial = false, existing = null } = {}) => {
    const normalized = {};

    const rawName = payload.name ?? payload.examName ?? payload.title;
    if (rawName !== undefined) normalized.name = String(rawName).trim();

    const rawDescription = payload.description ?? payload.instructions;
    if (rawDescription !== undefined) {
        normalized.description = String(rawDescription || '').trim();
    }

    const rawExamType = payload.examType !== undefined
        ? payload.examType
        : (payload.type !== undefined ? payload.type : (!partial ? 'Final' : undefined));
    if (rawExamType !== undefined) {
        normalized.examType = normalizeExamTypeLabel(rawExamType);
    }

    const nextCategory = deriveCategory(
        {
            category: payload.category,
            examType: rawExamType ?? existing?.examType,
            classId: payload.classId ?? existing?.classId,
            subjectId: payload.subjectId ?? existing?.subjectId,
            specialExam: payload.specialExam
        },
        partial ? existing?.category : null
    );
    normalized.category = nextCategory;

    if (payload.status !== undefined) {
        normalized.status = String(payload.status || '').trim().toLowerCase();
    }

    if (payload.classId !== undefined) normalized.classId = payload.classId;
    if (payload.sectionId !== undefined) normalized.sectionId = payload.sectionId;
    if (payload.subjectId !== undefined) normalized.subjectId = payload.subjectId;

    if (payload.targetClasses !== undefined) {
        normalized.targetClasses = parseObjectIdArray(payload.targetClasses);
    }
    if (payload.targetSections !== undefined) {
        normalized.targetSections = [...new Set(toList(payload.targetSections).map(toSectionToken).filter(Boolean))];
    }

    const parsedStartDate = parseDateValue(payload.startDate ?? payload.date);
    if (payload.startDate !== undefined || payload.date !== undefined) {
        normalized.startDate = parsedStartDate;
        normalized.date = parsedStartDate;
    }

    const parsedEndDate = parseDateValue(payload.endDate ?? payload.deadline);
    if (payload.endDate !== undefined || payload.deadline !== undefined) {
        normalized.endDate = parsedEndDate;
    }

    if (payload.date !== undefined && payload.startDate === undefined) {
        normalized.date = parseDateValue(payload.date);
    }

    if (payload.duration !== undefined) {
        normalized.duration = parsePositiveNumber(payload.duration);
    }

    if (payload.totalMarks !== undefined || payload.maxMarks !== undefined) {
        normalized.totalMarks = parsePositiveNumber(payload.totalMarks ?? payload.maxMarks);
    }

    if (payload.isActive !== undefined) {
        normalized.isActive = Boolean(payload.isActive);
    }

    if (!partial && !normalized.status) {
        normalized.status = 'draft';
    }

    if (normalized.classId && !normalized.targetClasses) {
        normalized.targetClasses = [toObjectId(normalized.classId)].filter(Boolean);
    }

    return normalized;
};

const mapClassRef = (row) => ({
    _id: row?._id || null,
    className: row?.className || null,
    section: row?.section || null
});

const mapExamDoc = (exam) => ({
    _id: exam._id,
    name: exam.name,
    description: exam.description || '',
    examType: exam.examType,
    category: exam.category || 'school_exam',
    status: exam.status || 'draft',
    classId: exam.classId?._id || exam.classId || null,
    class: exam.classId ? mapClassRef(exam.classId) : null,
    sectionId: exam.sectionId?._id || exam.sectionId || null,
    section: exam.sectionId
        ? {
            _id: exam.sectionId._id || exam.sectionId,
            sectionName: exam.sectionId.sectionName || exam.sectionId.name || null
        }
        : null,
    subjectId: exam.subjectId?._id || exam.subjectId || null,
    subject: exam.subjectId
        ? {
            _id: exam.subjectId._id || exam.subjectId,
            subjectName: exam.subjectId.subjectName || null,
            subjectCode: exam.subjectId.subjectCode || null
        }
        : null,
    targetClasses: Array.isArray(exam.targetClasses)
        ? exam.targetClasses.map((row) => ({
            _id: row?._id || row,
            className: row?.className || null,
            section: row?.section || null
        }))
        : [],
    targetSections: Array.isArray(exam.targetSections) ? exam.targetSections : [],
    startDate: exam.startDate || exam.date || null,
    endDate: exam.endDate || null,
    date: exam.date || exam.startDate || null,
    duration: exam.duration || null,
    totalMarks: exam.totalMarks || null,
    isActive: exam.isActive,
    resultsPublished: exam.resultsPublished,
    publishedDate: exam.publishedDate,
    schoolCode: exam.schoolCode,
    createdBy: exam.createdBy || null,
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt
});

const fetchClassMap = async ({ classIds, schoolCode }) => {
    const ids = [...new Set((classIds || []).filter(Boolean).map((id) => String(id)))];
    if (!ids.length) return new Map();
    const rows = await Class.find({
        _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) },
        schoolCode,
        isActive: true
    }).select('_id className section').lean();
    return new Map(rows.map((row) => [String(row._id), row]));
};

const validateExamPayload = async ({ payload, existingExam, schoolCode }) => {
    if (!payload.name && !existingExam?.name) {
        return { ok: false, status: 400, message: 'name is required' };
    }
    if (!payload.examType && !existingExam?.examType) {
        return { ok: false, status: 400, message: 'examType is required' };
    }

    const category = payload.category || existingExam?.category || 'school_exam';
    if (!EXAM_CATEGORIES.includes(category)) {
        return { ok: false, status: 400, message: `Invalid category. Allowed: ${EXAM_CATEGORIES.join(', ')}` };
    }

    if (payload.status && !EXAM_STATUSES.includes(payload.status)) {
        return { ok: false, status: 400, message: `Invalid status. Allowed: ${EXAM_STATUSES.join(', ')}` };
    }

    if (payload.startDate !== undefined && !payload.startDate) {
        return { ok: false, status: 400, message: 'Invalid startDate/date value' };
    }
    if (payload.endDate !== undefined && !payload.endDate) {
        return { ok: false, status: 400, message: 'Invalid endDate/deadline value' };
    }
    if (payload.endDate && payload.startDate && payload.endDate < payload.startDate) {
        return { ok: false, status: 400, message: 'endDate cannot be earlier than startDate' };
    }
    if ('duration' in payload && !payload.duration) {
        return { ok: false, status: 400, message: 'duration must be a positive number' };
    }
    if ('totalMarks' in payload && !payload.totalMarks) {
        return { ok: false, status: 400, message: 'totalMarks must be a positive number' };
    }

    const resolvedClassId = payload.classId ?? existingExam?.classId;
    const resolvedSubjectId = payload.subjectId ?? existingExam?.subjectId;
    const resolvedTargetClasses = payload.targetClasses
        ?? (existingExam?.targetClasses || (resolvedClassId ? [resolvedClassId] : []));

    if (category === 'class_test') {
        if (!resolvedClassId || !isValidObjectId(resolvedClassId)) {
            return { ok: false, status: 400, message: 'classId is required for class_test' };
        }
        if (!resolvedSubjectId || !isValidObjectId(resolvedSubjectId)) {
            return { ok: false, status: 400, message: 'subjectId is required for class_test' };
        }
    }

    if (category === 'school_exam' || category === 'special_exam') {
        if (!resolvedTargetClasses || !resolvedTargetClasses.length) {
            return { ok: false, status: 400, message: `${category} requires at least one target class` };
        }
    }

    const classIdsToValidate = [
        ...new Set([
            ...(resolvedClassId ? [String(resolvedClassId)] : []),
            ...(resolvedTargetClasses || []).map((id) => String(id))
        ])
    ]
        .filter((id) => isValidObjectId(id))
        .map((id) => new mongoose.Types.ObjectId(id));

    if (classIdsToValidate.length) {
        const existingClasses = await Class.find({
            _id: { $in: classIdsToValidate },
            schoolCode,
            isActive: true
        }).select('_id').lean();
        if (existingClasses.length !== classIdsToValidate.length) {
            return { ok: false, status: 404, message: 'One or more class references are invalid for this school' };
        }
    }

    const sectionId = payload.sectionId ?? existingExam?.sectionId;
    if (sectionId !== undefined && sectionId !== null) {
        if (!isValidObjectId(sectionId)) {
            return { ok: false, status: 400, message: 'Invalid sectionId' };
        }
        const sectionQuery = {
            _id: new mongoose.Types.ObjectId(String(sectionId)),
            schoolCode
        };
        if (resolvedClassId && isValidObjectId(resolvedClassId)) {
            sectionQuery.classId = new mongoose.Types.ObjectId(String(resolvedClassId));
        }
        const section = await Section.findOne(sectionQuery).select('_id').lean();
        if (!section) {
            return { ok: false, status: 404, message: 'Section not found for this class/school' };
        }
    }

    if (resolvedSubjectId !== undefined && resolvedSubjectId !== null) {
        if (!isValidObjectId(resolvedSubjectId)) {
            return { ok: false, status: 400, message: 'Invalid subjectId' };
        }
        const subjectDoc = await Subject.findOne({
            _id: new mongoose.Types.ObjectId(String(resolvedSubjectId)),
            schoolCode,
            isActive: true
        }).select('_id').lean();
        if (!subjectDoc) {
            return { ok: false, status: 404, message: 'Subject not found for this school' };
        }
    }

    return { ok: true };
};

const ensureTeacherCanCreateClassTest = async ({ req, classId, subjectId, schoolCode }) => {
    if (req.user.role !== 'teacher') return { ok: true };
    const teacherId = toObjectId(req.user._id || req.user.id);
    if (!teacherId) {
        return { ok: false, status: 403, message: 'Unauthorized teacher context' };
    }
    const assignment = await TeacherAssignment.findOne({
        schoolCode,
        teacher: teacherId,
        subject: toObjectId(subjectId),
        classes: { $in: [toObjectId(classId)] },
        isActive: true
    }).select('_id').lean();
    if (!assignment) {
        return { ok: false, status: 403, message: 'You are not authorized to create class tests for this class/subject' };
    }
    return { ok: true };
};

const resolvePublishClass = async ({ exam, classId, schoolCode }) => {
    let resolvedClassId = classId;
    if (!resolvedClassId && exam.classId) {
        resolvedClassId = String(exam.classId._id || exam.classId);
    }
    if (!resolvedClassId && Array.isArray(exam.targetClasses) && exam.targetClasses.length === 1) {
        resolvedClassId = String(exam.targetClasses[0]?._id || exam.targetClasses[0]);
    }

    if (!resolvedClassId || !isValidObjectId(resolvedClassId)) {
        return {
            error: {
                status: 400,
                message: 'classId is required for this exam publish scope'
            }
        };
    }

    const classDoc = await Class.findOne({
        _id: new mongoose.Types.ObjectId(String(resolvedClassId)),
        schoolCode,
        isActive: true
    }).select('_id className section').lean();
    if (!classDoc) {
        return { error: { status: 404, message: 'Class not found for this school' } };
    }

    const allowedClassIds = new Set(
        []
            .concat(exam.classId ? [exam.classId] : [])
            .concat(Array.isArray(exam.targetClasses) ? exam.targetClasses : [])
            .map((id) => String(id?._id || id))
            .filter(Boolean)
    );

    if (allowedClassIds.size && !allowedClassIds.has(String(classDoc._id))) {
        return { error: { status: 400, message: 'Selected class is outside the exam scope' } };
    }

    return { classDoc };
};

/**
 * @desc    Create Exam Event (school_exam/special_exam/legacy subject exam)
 * @route   POST /api/principal/exams
 * @access  Principal/Admin
 */
exports.createExam = async (req, res) => {
    try {
        const school = getSchoolContext(req);
        const payload = normalizeExamPayload(req.body, { partial: false });

        const validation = await validateExamPayload({
            payload,
            existingExam: null,
            schoolCode: school.schoolCode
        });
        if (!validation.ok) {
            return res.status(validation.status).json({ success: false, message: validation.message });
        }

        const exam = new Exam({
            ...payload,
            schoolCode: school.schoolCode,
            ...(school.schoolId ? { schoolId: school.schoolId } : {}),
            createdBy: req.user._id || req.user.id
        });

        await exam.save();
        await exam.populate('classId', 'className section');
        await exam.populate('sectionId', 'sectionName name');
        await exam.populate('subjectId', 'subjectName subjectCode');
        await exam.populate('targetClasses', 'className section');

        return res.status(201).json({
            success: true,
            message: 'Exam event created successfully',
            data: mapExamDoc(exam)
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: Object.values(error.errors).map((entry) => entry.message).join(', ')
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Create Class Test
 * @route   POST /api/principal/class-tests | POST /api/teacher/class-tests
 * @access  Principal/Admin/Teacher (scoped)
 */
exports.createClassTest = async (req, res) => {
    try {
        const school = getSchoolContext(req);
        const payload = normalizeExamPayload(
            {
                ...req.body,
                category: 'class_test',
                examType: req.body.examType || 'class_test'
            },
            { partial: false }
        );

        const validation = await validateExamPayload({
            payload,
            existingExam: null,
            schoolCode: school.schoolCode
        });
        if (!validation.ok) {
            return res.status(validation.status).json({ success: false, message: validation.message });
        }

        const teacherCheck = await ensureTeacherCanCreateClassTest({
            req,
            classId: payload.classId,
            subjectId: payload.subjectId,
            schoolCode: school.schoolCode
        });
        if (!teacherCheck.ok) {
            return res.status(teacherCheck.status).json({ success: false, message: teacherCheck.message });
        }

        if (!payload.startDate && !payload.date) {
            return res.status(400).json({
                success: false,
                message: 'date/startDate is required for class test'
            });
        }

        const exam = new Exam({
            ...payload,
            category: 'class_test',
            targetClasses: payload.targetClasses?.length
                ? payload.targetClasses
                : [toObjectId(payload.classId)].filter(Boolean),
            schoolCode: school.schoolCode,
            ...(school.schoolId ? { schoolId: school.schoolId } : {}),
            createdBy: req.user._id || req.user.id
        });

        await exam.save();
        await exam.populate('classId', 'className section');
        await exam.populate('sectionId', 'sectionName name');
        await exam.populate('subjectId', 'subjectName subjectCode');
        await exam.populate('targetClasses', 'className section');

        return res.status(201).json({
            success: true,
            message: 'Class test created successfully',
            data: mapExamDoc(exam)
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: Object.values(error.errors).map((entry) => entry.message).join(', ')
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    List Exams
 * @route   GET /api/principal/exams
 * @access  Principal/Admin
 */
exports.getExams = async (req, res) => {
    try {
        const school = getSchoolContext(req);
        const {
            classId,
            subjectId,
            examType,
            category,
            status,
            isActive,
            fromDate,
            toDate
        } = req.query;

        const query = { schoolCode: school.schoolCode };

        if (classId) {
            if (!isValidObjectId(classId)) {
                return res.status(400).json({ success: false, message: 'Invalid classId' });
            }
            const classOid = new mongoose.Types.ObjectId(String(classId));
            query.$or = [
                { classId: classOid },
                { targetClasses: classOid }
            ];
        }

        if (subjectId) {
            if (!isValidObjectId(subjectId)) {
                return res.status(400).json({ success: false, message: 'Invalid subjectId' });
            }
            query.subjectId = new mongoose.Types.ObjectId(String(subjectId));
        }

        if (examType) {
            query.examType = buildExamTypeQuery(examType);
        }

        if (category) {
            const normalizedCategory = String(category).trim().toLowerCase();
            if (!EXAM_CATEGORIES.includes(normalizedCategory)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid category. Allowed: ${EXAM_CATEGORIES.join(', ')}`
                });
            }
            query.category = normalizedCategory;
        }

        if (status) {
            const normalizedStatus = String(status).trim().toLowerCase();
            if (!EXAM_STATUSES.includes(normalizedStatus)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status. Allowed: ${EXAM_STATUSES.join(', ')}`
                });
            }
            query.status = normalizedStatus;
        }

        if (isActive !== undefined) {
            query.isActive = String(isActive) === 'true';
        }

        if (fromDate || toDate) {
            query.startDate = {};
            if (fromDate) {
                const parsedFrom = parseDateValue(fromDate);
                if (!parsedFrom) {
                    return res.status(400).json({ success: false, message: 'Invalid fromDate' });
                }
                query.startDate.$gte = parsedFrom;
            }
            if (toDate) {
                const parsedTo = parseDateValue(toDate);
                if (!parsedTo) {
                    return res.status(400).json({ success: false, message: 'Invalid toDate' });
                }
                query.startDate.$lte = parsedTo;
            }
        }

        const exams = await Exam.find(query)
            .populate('classId', 'className section')
            .populate('sectionId', 'sectionName name')
            .populate('subjectId', 'subjectName subjectCode')
            .populate('targetClasses', 'className section')
            .sort({ startDate: -1, date: -1, createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: exams.map(mapExamDoc)
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    List Class Tests
 * @route   GET /api/principal/class-tests | GET /api/teacher/class-tests
 * @access  Principal/Admin/Teacher
 */
exports.getClassTests = async (req, res) => {
    try {
        const school = getSchoolContext(req);
        const { classId, subjectId, status, isActive } = req.query;
        const query = {
            schoolCode: school.schoolCode,
            category: 'class_test'
        };

        if (status) {
            const normalizedStatus = String(status).trim().toLowerCase();
            if (!EXAM_STATUSES.includes(normalizedStatus)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid status. Allowed: ${EXAM_STATUSES.join(', ')}`
                });
            }
            query.status = normalizedStatus;
        }
        if (isActive !== undefined) {
            query.isActive = String(isActive) === 'true';
        }

        if (classId) {
            if (!isValidObjectId(classId)) {
                return res.status(400).json({ success: false, message: 'Invalid classId' });
            }
            query.classId = new mongoose.Types.ObjectId(String(classId));
        }
        if (subjectId) {
            if (!isValidObjectId(subjectId)) {
                return res.status(400).json({ success: false, message: 'Invalid subjectId' });
            }
            query.subjectId = new mongoose.Types.ObjectId(String(subjectId));
        }

        if (req.user.role === 'teacher') {
            const teacherId = toObjectId(req.user._id || req.user.id);
            const assignments = await TeacherAssignment.find({
                schoolCode: school.schoolCode,
                teacher: teacherId,
                isActive: true
            }).select('subject classes').lean();

            const allowedSubjectIds = [...new Set(assignments.map((row) => String(row.subject)).filter(Boolean))]
                .map((id) => new mongoose.Types.ObjectId(id));
            const allowedClassIds = [...new Set(assignments.flatMap((row) => row.classes || []).map((id) => String(id)).filter(Boolean))]
                .map((id) => new mongoose.Types.ObjectId(id));

            if (!allowedSubjectIds.length || !allowedClassIds.length) {
                return res.status(200).json({ success: true, data: [] });
            }

            query.subjectId = { $in: allowedSubjectIds };
            query.classId = { $in: allowedClassIds };
        }

        const tests = await Exam.find(query)
            .populate('classId', 'className section')
            .populate('sectionId', 'sectionName name')
            .populate('subjectId', 'subjectName subjectCode')
            .populate('targetClasses', 'className section')
            .sort({ startDate: -1, date: -1, createdAt: -1 });

        return res.status(200).json({
            success: true,
            data: tests.map(mapExamDoc)
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Update Exam
 * @route   PUT /api/principal/exams/:id
 * @access  Principal/Admin
 */
exports.updateExam = async (req, res) => {
    try {
        const { id } = req.params;
        const school = getSchoolContext(req);

        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid exam id' });
        }

        const exam = await Exam.findOne({
            _id: new mongoose.Types.ObjectId(String(id)),
            schoolCode: school.schoolCode
        });
        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        const payload = normalizeExamPayload(req.body, { partial: true, existing: exam });
        if (!Object.keys(payload).length) {
            return res.status(400).json({ success: false, message: 'No valid fields provided for update' });
        }

        const validation = await validateExamPayload({
            payload,
            existingExam: exam,
            schoolCode: school.schoolCode
        });
        if (!validation.ok) {
            return res.status(validation.status).json({ success: false, message: validation.message });
        }

        Object.assign(exam, payload);
        await exam.save();

        await exam.populate('classId', 'className section');
        await exam.populate('sectionId', 'sectionName name');
        await exam.populate('subjectId', 'subjectName subjectCode');
        await exam.populate('targetClasses', 'className section');

        return res.status(200).json({
            success: true,
            message: 'Exam updated successfully',
            data: mapExamDoc(exam)
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: Object.values(error.errors).map((entry) => entry.message).join(', ')
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Delete Exam
 * @route   DELETE /api/principal/exams/:id
 * @access  Principal/Admin
 */
exports.deleteExam = async (req, res) => {
    try {
        const { id } = req.params;
        const school = getSchoolContext(req);

        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid exam id' });
        }

        const exam = await Exam.findOneAndDelete({
            _id: new mongoose.Types.ObjectId(String(id)),
            schoolCode: school.schoolCode
        });

        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        await ExamSchedule.deleteMany({
            examId: exam._id,
            schoolCode: school.schoolCode
        });

        return res.status(200).json({
            success: true,
            message: 'Exam deleted successfully'
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Create/Replace schedule for exam event
 * @route   POST /api/principal/exams/:id/schedules
 * @access  Principal/Admin
 */
exports.upsertExamSchedules = async (req, res) => {
    try {
        const { id } = req.params;
        const school = getSchoolContext(req);

        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid exam id' });
        }

        const exam = await Exam.findOne({
            _id: new mongoose.Types.ObjectId(String(id)),
            schoolCode: school.schoolCode,
            isActive: true
        })
            .populate('classId', 'className section')
            .populate('targetClasses', 'className section')
            .lean();

        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        const slotsInput = Array.isArray(req.body) ? req.body : (req.body.slots || req.body.schedules);
        if (!Array.isArray(slotsInput) || !slotsInput.length) {
            return res.status(400).json({ success: false, message: 'slots array is required' });
        }

        const defaultClassId = exam.classId ? String(exam.classId._id || exam.classId) : null;
        const defaultSubjectId = exam.subjectId ? String(exam.subjectId._id || exam.subjectId) : null;

        const classIds = parseObjectIdArray([
            ...slotsInput.map((slot) => slot.classId).filter(Boolean),
            ...(defaultClassId ? [defaultClassId] : [])
        ]);
        const subjectIds = parseObjectIdArray([
            ...slotsInput.map((slot) => slot.subjectId).filter(Boolean),
            ...(defaultSubjectId ? [defaultSubjectId] : [])
        ]);
        const sectionIds = parseObjectIdArray(slotsInput.map((slot) => slot.sectionId).filter(Boolean));

        const [classMap, subjectRows, sectionRows] = await Promise.all([
            fetchClassMap({ classIds, schoolCode: school.schoolCode }),
            subjectIds.length
                ? Subject.find({ _id: { $in: subjectIds }, schoolCode: school.schoolCode, isActive: true })
                    .select('_id subjectName')
                    .lean()
                : [],
            sectionIds.length
                ? Section.find({ _id: { $in: sectionIds }, schoolCode: school.schoolCode })
                    .select('_id sectionName name classId')
                    .lean()
                : []
        ]);

        if (classIds.length && classMap.size !== classIds.length) {
            return res.status(404).json({ success: false, message: 'One or more classId values are invalid for this school' });
        }
        if (subjectIds.length && subjectRows.length !== subjectIds.length) {
            return res.status(404).json({ success: false, message: 'One or more subjectId values are invalid for this school' });
        }
        if (sectionIds.length && sectionRows.length !== sectionIds.length) {
            return res.status(404).json({ success: false, message: 'One or more sectionId values are invalid for this school' });
        }

        const allowedClassIds = new Set(
            []
                .concat(exam.classId ? [exam.classId] : [])
                .concat(exam.targetClasses || [])
                .map((row) => String(row?._id || row))
        );

        const subjectMap = new Map(subjectRows.map((row) => [String(row._id), row]));
        const sectionMap = new Map(sectionRows.map((row) => [String(row._id), row]));

        const slots = [];
        for (const row of slotsInput) {
            const classId = row.classId ? String(row.classId) : defaultClassId;
            const subjectId = row.subjectId ? String(row.subjectId) : defaultSubjectId;
            const sectionId = row.sectionId ? String(row.sectionId) : null;

            const date = parseDateValue(row.date);
            if (!date) {
                return res.status(400).json({ success: false, message: 'Each slot requires a valid date' });
            }
            if (!row.startTime || !row.endTime) {
                return res.status(400).json({ success: false, message: 'Each slot requires startTime and endTime' });
            }
            if (!classId || !isValidObjectId(classId)) {
                return res.status(400).json({ success: false, message: 'Each slot requires a valid classId' });
            }
            if (!subjectId || !isValidObjectId(subjectId)) {
                return res.status(400).json({ success: false, message: 'Each slot requires a valid subjectId' });
            }
            if (allowedClassIds.size && !allowedClassIds.has(classId)) {
                return res.status(400).json({ success: false, message: 'Schedule slot class is outside exam target classes' });
            }

            const sectionDoc = sectionId ? sectionMap.get(sectionId) : null;
            if (sectionId && !sectionDoc) {
                return res.status(404).json({ success: false, message: 'sectionId not found in this school' });
            }
            if (sectionDoc && String(sectionDoc.classId) !== classId) {
                return res.status(400).json({ success: false, message: 'sectionId does not belong to slot classId' });
            }

            const subjectDoc = subjectMap.get(subjectId);
            const classDoc = classMap.get(classId);
            slots.push({
                date,
                startTime: String(row.startTime).trim(),
                endTime: String(row.endTime).trim(),
                classId: new mongoose.Types.ObjectId(classId),
                sectionId: sectionId ? new mongoose.Types.ObjectId(sectionId) : null,
                subjectId: new mongoose.Types.ObjectId(subjectId),
                roomId: isValidObjectId(row.roomId) ? new mongoose.Types.ObjectId(String(row.roomId)) : null,
                invigilatorId: isValidObjectId(row.invigilatorId) ? new mongoose.Types.ObjectId(String(row.invigilatorId)) : null,
                status: row.status && ['scheduled', 'rescheduled', 'completed', 'cancelled'].includes(String(row.status).toLowerCase())
                    ? String(row.status).toLowerCase()
                    : 'scheduled',
                totalMarks: parsePositiveNumber(row.totalMarks || row.fullMarks) || (exam.totalMarks || 100),
                passMarks: Number.isFinite(Number(row.passMarks)) ? Number(row.passMarks) : 33,
                subjectName: row.subjectName || subjectDoc?.subjectName || '',
                classLevel: row.classLevel || classDoc?.className || '',
                section: row.section || sectionDoc?.sectionName || sectionDoc?.name || classDoc?.section || '',
                roomNumber: row.roomNumber || ''
            });
        }

        const academicYear = String(
            req.body.academicYear
            || (exam.startDate ? new Date(exam.startDate).getFullYear() : new Date().getFullYear())
        );

        const { withTransaction } = require('../utils/transactionHelper');
        
        const result = await withTransaction(async (session) => {
            const schedule = await ExamSchedule.findOneAndUpdate(
                { schoolCode: school.schoolCode, examId: exam._id },
                {
                    $set: {
                        schoolCode: school.schoolCode,
                        ...(school.schoolId ? { schoolId: school.schoolId } : {}),
                        examId: exam._id,
                        examName: exam.name,
                        academicYear,
                        academicSessionId: req.body.academicSessionId || null,
                        slots,
                        isPublished: false,
                        updatedAt: new Date()
                    },
                    $setOnInsert: {
                        createdBy: req.user._id || req.user.id
                    }
                },
                {
                    upsert: true,
                    new: true,
                    runValidators: true,
                    setDefaultsOnInsert: true
                },
                { session }
            )
                .populate('slots.classId', 'className section')
                .populate('slots.sectionId', 'sectionName name')
                .populate('slots.subjectId', 'subjectName subjectCode')
                .populate('slots.invigilatorId', 'name')
                .populate('slots.roomId', 'name roomNumber');

            await Exam.updateOne(
                { _id: exam._id, schoolCode: school.schoolCode },
                {
                    $set: {
                        status: 'scheduled',
                        startDate: exam.startDate || slots[0]?.date || exam.date,
                        endDate: exam.endDate || slots[slots.length - 1]?.date || exam.date
                    }
                },
                { session }
            );
            
            return schedule;
        });

        return res.status(200).json({
            success: true,
            message: 'Exam schedules saved successfully',
            data: result
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Get schedule by exam
 * @route   GET /api/principal/exams/:id/schedules
 * @access  Principal/Admin/Teacher/Student
 */
exports.getExamSchedulesByExam = async (req, res) => {
    try {
        const { id } = req.params;
        const school = getSchoolContext(req);

        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid exam id' });
        }

        const schedule = await ExamSchedule.findOne({
            examId: new mongoose.Types.ObjectId(String(id)),
            schoolCode: school.schoolCode
        })
            .populate('slots.classId', 'className section')
            .populate('slots.sectionId', 'sectionName name')
            .populate('slots.subjectId', 'subjectName subjectCode')
            .populate('slots.invigilatorId', 'name')
            .populate('slots.roomId', 'name roomNumber')
            .lean();

        return res.status(200).json({
            success: true,
            data: schedule || null
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Publish exam results for specific class scope
 * @route   POST /api/principal/exams/:id/publish
 * @access  Principal/Admin
 */
exports.publishExamResults = async (req, res) => {
    try {
        const { id } = req.params;
        const { classId } = req.body || {};
        const school = getSchoolContext(req);
        const schoolScope = makeSchoolQuery(school);

        if (!schoolScope) {
            return res.status(403).json({ success: false, message: 'School scope not found' });
        }
        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: 'Invalid exam id' });
        }

        const exam = await Exam.findOne({
            _id: new mongoose.Types.ObjectId(String(id)),
            schoolCode: school.schoolCode,
            isActive: true
        })
            .populate('classId', 'className section')
            .populate('targetClasses', 'className section')
            .lean();

        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        const classResolution = await resolvePublishClass({
            exam,
            classId,
            schoolCode: school.schoolCode
        });
        if (classResolution.error) {
            return res.status(classResolution.error.status).json({
                success: false,
                message: classResolution.error.message
            });
        }

        const classDoc = classResolution.classDoc;
        const sectionToken = toSectionToken(req.body?.section || classDoc.section || '');

        const anchorDate = exam.startDate || exam.date || exam.createdAt || new Date();
        const dayStart = new Date(anchorDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(anchorDate);
        dayEnd.setHours(23, 59, 59, 999);
        const examAcademicYear = String(new Date(anchorDate).getFullYear());

        const identityFilter = {
            $or: [
                { examId: exam._id },
                { examName: exam.name, academicYear: examAcademicYear },
                { examName: exam.name, examDate: { $gte: dayStart, $lte: dayEnd } }
            ]
        };

        const publishFilter = {
            $and: [
                schoolScope,
                {
                    studentClass: classDoc.className,
                    ...(sectionToken ? { section: sectionToken } : {}),
                    isActive: true,
                    'subjects.0': { $exists: true }
                },
                identityFilter
            ]
        };

        const totalResults = await Result.countDocuments(publishFilter);
        if (totalResults === 0) {
            return res.status(404).json({
                success: false,
                message: 'No result drafts found for this exam/class scope'
            });
        }

        const now = new Date();
        const publishUpdate = await Result.updateMany(
            {
                $and: [
                    publishFilter,
                    {
                        $or: [
                            { status: { $ne: 'published' } },
                            { status: { $exists: false }, isPublished: { $ne: true } }
                        ]
                    }
                ]
            },
            {
                $set: {
                    status: 'published',
                    isPublished: true,
                    publishedAt: now,
                    publishedBy: req.user._id,
                    isActive: true,
                    updatedBy: req.user._id,
                    updatedAt: now
                }
            }
        );

        await Exam.updateOne(
            { _id: exam._id, schoolCode: school.schoolCode },
            {
                $set: {
                    resultsPublished: true,
                    publishedDate: now
                }
            }
        );

        return res.status(200).json({
            success: true,
            message: 'Exam results published successfully (exam-wise bulk publish)',
            data: {
                examId: exam._id,
                examName: exam.name,
                classId: classDoc._id,
                className: classDoc.className,
                section: sectionToken || null,
                totalResults,
                updatedCount: publishUpdate.modifiedCount || 0
            }
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};
