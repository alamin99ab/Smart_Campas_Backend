/**
 * EXAM CONTROLLER
 * Exam management for principals
 */

const mongoose = require('mongoose');
const Exam = require('../models/Exam');
const Class = require('../models/Class');
const Subject = require('../models/Subject');

const ALLOWED_EXAM_TYPES = ['Quiz', 'Midterm', 'Final', 'Practical', 'Assignment', 'Other'];

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(value);

const parsePositiveNumber = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
};

const normalizeExamPayload = (payload = {}, { partial = false } = {}) => {
    const normalized = {};

    const rawName = payload.name ?? payload.examName;
    if (rawName !== undefined) normalized.name = String(rawName).trim();

    if (payload.description !== undefined) {
        normalized.description = String(payload.description || '').trim();
    }

    if (payload.examType !== undefined) normalized.examType = payload.examType;
    if (payload.classId !== undefined) normalized.classId = payload.classId;
    if (payload.subjectId !== undefined) normalized.subjectId = payload.subjectId;

    const rawDate = payload.date ?? payload.startDate;
    if (rawDate !== undefined) {
        const parsedDate = new Date(rawDate);
        normalized.date = Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    }

    if (payload.duration !== undefined) {
        normalized.duration = parsePositiveNumber(payload.duration);
    }

    if (payload.totalMarks !== undefined) {
        normalized.totalMarks = parsePositiveNumber(payload.totalMarks);
    }

    if (payload.isActive !== undefined) normalized.isActive = Boolean(payload.isActive);

    if (!partial) {
        normalized.examType = normalized.examType || 'Final';
    }

    return normalized;
};

const mapExamDoc = (exam) => ({
    _id: exam._id,
    name: exam.name,
    description: exam.description || '',
    examType: exam.examType,
    classId: exam.classId?._id || exam.classId || null,
    class: exam.classId
        ? {
            _id: exam.classId._id || exam.classId,
            className: exam.classId.className || null,
            section: exam.classId.section || null
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
    date: exam.date,
    duration: exam.duration,
    totalMarks: exam.totalMarks,
    isActive: exam.isActive,
    resultsPublished: exam.resultsPublished,
    publishedDate: exam.publishedDate,
    schoolCode: exam.schoolCode,
    createdBy: exam.createdBy || null,
    createdAt: exam.createdAt,
    updatedAt: exam.updatedAt
});

const validateLinkedEntities = async ({ classId, subjectId, schoolCode }) => {
    if (classId !== undefined) {
        if (!isValidObjectId(classId)) {
            return { ok: false, status: 400, message: 'Invalid classId' };
        }
        const classDoc = await Class.findOne({ _id: classId, schoolCode }).select('_id');
        if (!classDoc) {
            return { ok: false, status: 404, message: 'Class not found for this school' };
        }
    }

    if (subjectId !== undefined) {
        if (!isValidObjectId(subjectId)) {
            return { ok: false, status: 400, message: 'Invalid subjectId' };
        }
        const subjectDoc = await Subject.findOne({ _id: subjectId, schoolCode }).select('_id');
        if (!subjectDoc) {
            return { ok: false, status: 404, message: 'Subject not found for this school' };
        }
    }

    return { ok: true };
};

/**
 * @desc    Create Exam
 * @route   POST /api/principal/exams
 * @access  Principal only
 */
exports.createExam = async (req, res) => {
    try {
        const schoolCode = req.tenant?.schoolCode || req.user.schoolCode;
        const payload = normalizeExamPayload(req.body, { partial: false });

        const requiredFields = ['name', 'examType', 'classId', 'subjectId', 'date', 'duration', 'totalMarks'];
        const missingFields = requiredFields.filter((field) => payload[field] === undefined || payload[field] === null || payload[field] === '');
        if (missingFields.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`
            });
        }

        if (!ALLOWED_EXAM_TYPES.includes(payload.examType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid examType. Allowed: ${ALLOWED_EXAM_TYPES.join(', ')}`
            });
        }

        if (!payload.date) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date value'
            });
        }

        if (!payload.duration || !payload.totalMarks) {
            return res.status(400).json({
                success: false,
                message: 'duration and totalMarks must be positive numbers'
            });
        }

        const linkCheck = await validateLinkedEntities({
            classId: payload.classId,
            subjectId: payload.subjectId,
            schoolCode
        });

        if (!linkCheck.ok) {
            return res.status(linkCheck.status).json({
                success: false,
                message: linkCheck.message
            });
        }

        const exam = new Exam({
            ...payload,
            schoolCode,
            createdBy: req.user._id || req.user.id
        });

        await exam.save();
        await exam.populate('classId', 'className section');
        await exam.populate('subjectId', 'subjectName subjectCode');

        res.status(201).json({
            success: true,
            message: 'Exam created successfully',
            data: mapExamDoc(exam)
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: Object.values(error.errors).map((entry) => entry.message).join(', ')
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Get all exams
 * @route   GET /api/principal/exams
 * @access  Principal only
 */
exports.getExams = async (req, res) => {
    try {
        const schoolCode = req.tenant?.schoolCode || req.user.schoolCode;
        const { classId, subjectId, examType, isActive } = req.query;

        const query = { schoolCode };
        if (classId) {
            if (!isValidObjectId(classId)) {
                return res.status(400).json({ success: false, message: 'Invalid classId' });
            }
            query.classId = classId;
        }
        if (subjectId) {
            if (!isValidObjectId(subjectId)) {
                return res.status(400).json({ success: false, message: 'Invalid subjectId' });
            }
            query.subjectId = subjectId;
        }
        if (examType) query.examType = examType;
        if (isActive !== undefined) query.isActive = String(isActive) === 'true';

        const exams = await Exam.find(query)
            .populate('classId', 'className section')
            .populate('subjectId', 'subjectName subjectCode')
            .sort({ date: -1, createdAt: -1 });

        res.status(200).json({
            success: true,
            data: exams.map(mapExamDoc)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Update Exam
 * @route   PUT /api/principal/exams/:id
 * @access  Principal only
 */
exports.updateExam = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolCode = req.tenant?.schoolCode || req.user.schoolCode;

        if (!isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid exam id'
            });
        }

        const payload = normalizeExamPayload(req.body, { partial: true });
        if (Object.keys(payload).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid fields provided for update'
            });
        }

        if (payload.examType && !ALLOWED_EXAM_TYPES.includes(payload.examType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid examType. Allowed: ${ALLOWED_EXAM_TYPES.join(', ')}`
            });
        }

        if ('date' in payload && !payload.date) {
            return res.status(400).json({
                success: false,
                message: 'Invalid date value'
            });
        }

        if ('duration' in payload && !payload.duration) {
            return res.status(400).json({
                success: false,
                message: 'duration must be a positive number'
            });
        }

        if ('totalMarks' in payload && !payload.totalMarks) {
            return res.status(400).json({
                success: false,
                message: 'totalMarks must be a positive number'
            });
        }

        const linkCheck = await validateLinkedEntities({
            classId: payload.classId,
            subjectId: payload.subjectId,
            schoolCode
        });

        if (!linkCheck.ok) {
            return res.status(linkCheck.status).json({
                success: false,
                message: linkCheck.message
            });
        }

        const exam = await Exam.findOne({ _id: id, schoolCode });

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found'
            });
        }

        Object.assign(exam, payload);
        await exam.save();
        await exam.populate('classId', 'className section');
        await exam.populate('subjectId', 'subjectName subjectCode');

        res.status(200).json({
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

        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Delete Exam
 * @route   DELETE /api/principal/exams/:id
 * @access  Principal only
 */
exports.deleteExam = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolCode = req.tenant?.schoolCode || req.user.schoolCode;

        if (!isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid exam id'
            });
        }

        const exam = await Exam.findOneAndDelete({ _id: id, schoolCode });

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Exam deleted successfully'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Publish Exam Results
 * @route   POST /api/principal/exams/:id/publish
 * @access  Principal only
 */
exports.publishExamResults = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolCode = req.tenant?.schoolCode || req.user.schoolCode;

        if (!isValidObjectId(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid exam id'
            });
        }

        const exam = await Exam.findOneAndUpdate(
            { _id: id, schoolCode },
            { resultsPublished: true, publishedDate: new Date() },
            { new: true }
        )
            .populate('classId', 'className section')
            .populate('subjectId', 'subjectName subjectCode');

        if (!exam) {
            return res.status(404).json({
                success: false,
                message: 'Exam not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Exam results published successfully',
            data: mapExamDoc(exam)
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};
