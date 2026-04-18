/**
 * Exam Schedule / Exam Routine - CRUD and publish
 */
const mongoose = require('mongoose');
const ExamSchedule = require('../models/ExamSchedule');
const Exam = require('../models/Exam');
const Class = require('../models/Class');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const AuditLog = require('../models/AuditLog');
const { createNotification } = require('../utils/createNotification');
const User = require('../models/User');

const isValidObjectId = (value) => mongoose.Types.ObjectId.isValid(String(value || ''));

const parseDateValue = (value) => {
    if (value === undefined || value === null || value === '') return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parsePositiveNumber = (value, fallback = null) => {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getSchoolContext = (req) => ({
    schoolCode: String(req.tenant?.schoolCode || req.user?.schoolCode || '').trim().toUpperCase(),
    schoolId: req.tenant?.schoolId || req.user?.schoolId || null
});

const normalizeSlots = async ({ slots, schoolCode, defaultClassId = null, defaultSubjectId = null }) => {
    if (!Array.isArray(slots) || !slots.length) {
        return { error: 'slots array is required' };
    }

    const classIds = [...new Set(
        [
            ...slots.map((slot) => (slot.classId ? String(slot.classId) : defaultClassId)),
            ...(defaultClassId ? [String(defaultClassId)] : [])
        ]
            .filter((id) => isValidObjectId(id))
    )];
    const subjectIds = [...new Set(
        [
            ...slots.map((slot) => (slot.subjectId ? String(slot.subjectId) : defaultSubjectId)),
            ...(defaultSubjectId ? [String(defaultSubjectId)] : [])
        ]
            .filter((id) => isValidObjectId(id))
    )];
    const sectionIds = [...new Set(
        slots
            .map((slot) => (slot.sectionId ? String(slot.sectionId) : null))
            .filter((id) => isValidObjectId(id))
    )];

    const [classRows, subjectRows, sectionRows] = await Promise.all([
        classIds.length
            ? Class.find({ _id: { $in: classIds }, schoolCode, isActive: true }).select('_id className section').lean()
            : [],
        subjectIds.length
            ? Subject.find({ _id: { $in: subjectIds }, schoolCode, isActive: true }).select('_id subjectName').lean()
            : [],
        sectionIds.length
            ? Section.find({ _id: { $in: sectionIds }, schoolCode }).select('_id sectionName name classId').lean()
            : []
    ]);

    if (classRows.length !== classIds.length) {
        return { error: 'One or more classId values are invalid for this school' };
    }
    if (subjectRows.length !== subjectIds.length) {
        return { error: 'One or more subjectId values are invalid for this school' };
    }
    if (sectionRows.length !== sectionIds.length) {
        return { error: 'One or more sectionId values are invalid for this school' };
    }

    const classMap = new Map(classRows.map((row) => [String(row._id), row]));
    const subjectMap = new Map(subjectRows.map((row) => [String(row._id), row]));
    const sectionMap = new Map(sectionRows.map((row) => [String(row._id), row]));

    const normalized = [];
    for (const row of slots) {
        const classId = row.classId ? String(row.classId) : (defaultClassId ? String(defaultClassId) : null);
        const subjectId = row.subjectId ? String(row.subjectId) : (defaultSubjectId ? String(defaultSubjectId) : null);
        const sectionId = row.sectionId ? String(row.sectionId) : null;

        if (!classId || !isValidObjectId(classId)) {
            return { error: 'Each slot requires a valid classId' };
        }
        if (!subjectId || !isValidObjectId(subjectId)) {
            return { error: 'Each slot requires a valid subjectId' };
        }
        const parsedDate = parseDateValue(row.date);
        if (!parsedDate) {
            return { error: 'Each slot requires a valid date' };
        }
        if (!row.startTime || !row.endTime) {
            return { error: 'Each slot requires startTime and endTime' };
        }

        const classDoc = classMap.get(classId);
        const subjectDoc = subjectMap.get(subjectId);
        const sectionDoc = sectionId ? sectionMap.get(sectionId) : null;
        if (sectionDoc && String(sectionDoc.classId) !== classId) {
            return { error: 'sectionId does not belong to slot classId' };
        }

        normalized.push({
            date: parsedDate,
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
            totalMarks: parsePositiveNumber(row.totalMarks || row.fullMarks, 100),
            passMarks: Number.isFinite(Number(row.passMarks)) ? Number(row.passMarks) : 33,
            subjectName: row.subjectName || subjectDoc?.subjectName || '',
            classLevel: row.classLevel || classDoc?.className || '',
            section: String(row.section || sectionDoc?.sectionName || sectionDoc?.name || classDoc?.section || '')
                .trim()
                .toUpperCase(),
            roomNumber: String(row.roomNumber || '').trim(),
            fullMarks: parsePositiveNumber(row.fullMarks || row.totalMarks, 100)
        });
    }

    return { slots: normalized };
};

exports.createExamSchedule = async (req, res) => {
    try {
        const school = getSchoolContext(req);
        const { examId, examName, academicYear, academicSessionId } = req.body;
        const slotsInput = req.body.slots || req.body.schedules;

        let exam = null;
        if (examId && isValidObjectId(examId)) {
            exam = await Exam.findOne({
                _id: new mongoose.Types.ObjectId(String(examId)),
                schoolCode: school.schoolCode,
                isActive: true
            }).select('_id name classId subjectId startDate date').lean();
        } else if (examName) {
            exam = await Exam.findOne({
                schoolCode: school.schoolCode,
                isActive: true,
                name: { $regex: new RegExp(`^${String(examName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
            })
                .select('_id name classId subjectId startDate date')
                .sort({ startDate: -1, date: -1, createdAt: -1 })
                .lean();
        }

        if (!exam) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        const normalized = await normalizeSlots({
            slots: slotsInput,
            schoolCode: school.schoolCode,
            defaultClassId: exam.classId || null,
            defaultSubjectId: exam.subjectId || null
        });
        if (normalized.error) {
            return res.status(400).json({ success: false, message: normalized.error });
        }

        const derivedAcademicYear = String(
            academicYear
            || (exam.startDate ? new Date(exam.startDate).getFullYear() : null)
            || (exam.date ? new Date(exam.date).getFullYear() : new Date().getFullYear())
        );

        const schedule = await ExamSchedule.findOneAndUpdate(
            { schoolCode: school.schoolCode, examId: exam._id },
            {
                $set: {
                    ...(school.schoolId ? { schoolId: school.schoolId } : {}),
                    schoolCode: school.schoolCode,
                    examId: exam._id,
                    examName: examName || exam.name,
                    academicSessionId: academicSessionId || null,
                    academicYear: derivedAcademicYear,
                    slots: normalized.slots,
                    isPublished: false,
                    updatedAt: new Date()
                },
                $setOnInsert: {
                    createdBy: req.user._id
                }
            },
            {
                upsert: true,
                new: true,
                runValidators: true,
                setDefaultsOnInsert: true
            }
        );

        await AuditLog.create({
            user: req.user._id,
            action: 'EXAM_SCHEDULE_CREATED',
            details: {
                scheduleId: schedule._id,
                examId: exam._id,
                examName: schedule.examName,
                slotCount: schedule.slots?.length || 0
            },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.status(201).json({ success: true, data: schedule });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.getExamSchedules = async (req, res) => {
    try {
        const { examId, academicYear, isPublished, classId, subjectId } = req.query;
        const school = getSchoolContext(req);
        const query = { schoolCode: school.schoolCode };

        if (examId) {
            if (!isValidObjectId(examId)) {
                return res.status(400).json({ success: false, message: 'Invalid examId' });
            }
            query.examId = new mongoose.Types.ObjectId(String(examId));
        }
        if (academicYear) query.academicYear = String(academicYear);
        if (isPublished !== undefined) query.isPublished = String(isPublished) === 'true';
        if (classId) {
            if (!isValidObjectId(classId)) {
                return res.status(400).json({ success: false, message: 'Invalid classId' });
            }
            query['slots.classId'] = new mongoose.Types.ObjectId(String(classId));
        }
        if (subjectId) {
            if (!isValidObjectId(subjectId)) {
                return res.status(400).json({ success: false, message: 'Invalid subjectId' });
            }
            query['slots.subjectId'] = new mongoose.Types.ObjectId(String(subjectId));
        }

        const schedules = await ExamSchedule.find(query)
            .populate('examId', 'name category examType status')
            .populate('slots.classId', 'className section')
            .populate('slots.sectionId', 'sectionName name')
            .populate('slots.subjectId', 'subjectName subjectCode')
            .populate('slots.invigilatorId', 'name')
            .populate('slots.roomId', 'name roomNumber')
            .sort({ createdAt: -1 })
            .lean();

        return res.json({ success: true, data: schedules });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateExamSchedule = async (req, res) => {
    try {
        const school = getSchoolContext(req);
        const schedule = await ExamSchedule.findOne({
            _id: req.params.id,
            schoolCode: school.schoolCode
        });
        if (!schedule) return res.status(404).json({ success: false, message: 'Exam schedule not found' });
        if (schedule.isPublished) return res.status(400).json({ success: false, message: 'Cannot edit published schedule. Unpublish first.' });

        const { examName, academicYear, academicSessionId } = req.body;
        const slotsInput = req.body.slots || req.body.schedules;

        if (examName) schedule.examName = String(examName).trim();
        if (academicYear) schedule.academicYear = String(academicYear);
        if (academicSessionId !== undefined) schedule.academicSessionId = academicSessionId || null;

        if (slotsInput !== undefined) {
            const examDefaults = await Exam.findOne({
                _id: schedule.examId,
                schoolCode: school.schoolCode
            }).select('classId subjectId').lean();

            const normalized = await normalizeSlots({
                slots: slotsInput,
                schoolCode: school.schoolCode,
                defaultClassId: examDefaults?.classId || null,
                defaultSubjectId: examDefaults?.subjectId || null
            });
            if (normalized.error) {
                return res.status(400).json({ success: false, message: normalized.error });
            }
            schedule.slots = normalized.slots;
        }

        schedule.updatedAt = new Date();
        await schedule.save();

        return res.json({ success: true, data: schedule });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};

exports.publishExamSchedule = async (req, res) => {
    try {
        const school = getSchoolContext(req);
        const schedule = await ExamSchedule.findOne({ _id: req.params.id, schoolCode: school.schoolCode });
        if (!schedule) return res.status(404).json({ success: false, message: 'Exam schedule not found' });

        schedule.isPublished = true;
        schedule.publishedAt = new Date();
        schedule.publishedBy = req.user._id;
        await schedule.save();

        const recipientIds = await User.find({
            schoolCode: school.schoolCode,
            role: { $in: ['teacher', 'student'] },
            isActive: true
        })
            .select('_id')
            .limit(500)
            .lean()
            .then((users) => users.map((user) => user._id));

        await createNotification({
            title: 'Exam Routine Published',
            body: `Exam schedule for ${schedule.examName} (${schedule.academicYear}) has been published.`,
            type: 'notice',
            link: `/exam-schedule/${schedule._id}`,
            schoolCode: school.schoolCode,
            recipients: recipientIds.length ? recipientIds : [req.user._id]
        });

        await AuditLog.create({
            user: req.user._id,
            action: 'EXAM_SCHEDULE_PUBLISHED',
            details: { scheduleId: schedule._id, examName: schedule.examName },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        return res.json({ success: true, message: 'Exam routine published.', data: schedule });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
};
