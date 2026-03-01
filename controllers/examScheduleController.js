/**
 * Exam Schedule / Exam Routine – CRUD and publish
 */
const ExamSchedule = require('../models/ExamSchedule');
const Exam = require('../models/Exam');
const School = require('../models/School');
const AuditLog = require('../models/AuditLog');
const { createNotification } = require('../utils/createNotification');
const User = require('../models/User');

exports.createExamSchedule = async (req, res) => {
    try {
        const { examId, examName, academicYear, academicSessionId, slots } = req.body;
        if (!examName || !academicYear || !slots || !Array.isArray(slots)) {
            return res.status(400).json({ success: false, message: 'examName, academicYear, and slots array required' });
        }
        const school = await School.findOne({ schoolCode: req.user.schoolCode });
        if (!school) return res.status(404).json({ success: false, message: 'School not found' });

        const schedule = await ExamSchedule.create({
            schoolId: school._id,
            schoolCode: req.user.schoolCode,
            examId,
            examName,
            academicSessionId,
            academicYear,
            slots: slots.map(s => ({
                date: s.date ? new Date(s.date) : null,
                startTime: s.startTime,
                endTime: s.endTime,
                subjectId: s.subjectId,
                subjectName: s.subjectName,
                classLevel: s.classLevel,
                section: s.section,
                roomNumber: s.roomNumber,
                fullMarks: s.fullMarks || 100,
                passMarks: s.passMarks || 33
            })),
            createdBy: req.user._id
        });

        await AuditLog.create({
            user: req.user._id,
            action: 'EXAM_SCHEDULE_CREATED',
            details: { scheduleId: schedule._id, examName },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(201).json({ success: true, data: schedule });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ success: false, message: 'Exam schedule already exists for this exam' });
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getExamSchedules = async (req, res) => {
    try {
        const { examId, academicYear, isPublished } = req.query;
        const query = { schoolCode: req.user.schoolCode };
        if (examId) query.examId = examId;
        if (academicYear) query.academicYear = academicYear;
        if (isPublished !== undefined) query.isPublished = isPublished === 'true';

        const schedules = await ExamSchedule.find(query)
            .populate('slots.subjectId', 'subjectName subjectCode')
            .sort({ createdAt: -1 })
            .lean();

        res.json({ success: true, data: schedules });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateExamSchedule = async (req, res) => {
    try {
        const schedule = await ExamSchedule.findOne({ _id: req.params.id, schoolCode: req.user.schoolCode });
        if (!schedule) return res.status(404).json({ success: false, message: 'Exam schedule not found' });
        if (schedule.isPublished) return res.status(400).json({ success: false, message: 'Cannot edit published schedule. Unpublish first.' });

        const { examName, slots } = req.body;
        if (examName) schedule.examName = examName;
        if (slots && Array.isArray(slots)) schedule.slots = slots.map(s => ({
            date: s.date ? new Date(s.date) : null,
            startTime: s.startTime,
            endTime: s.endTime,
            subjectId: s.subjectId,
            subjectName: s.subjectName,
            classLevel: s.classLevel,
            section: s.section,
            roomNumber: s.roomNumber,
            fullMarks: s.fullMarks || 100,
            passMarks: s.passMarks || 33
        }));
        await schedule.save();
        res.json({ success: true, data: schedule });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.publishExamSchedule = async (req, res) => {
    try {
        const schedule = await ExamSchedule.findOne({ _id: req.params.id, schoolCode: req.user.schoolCode });
        if (!schedule) return res.status(404).json({ success: false, message: 'Exam schedule not found' });

        schedule.isPublished = true;
        schedule.publishedAt = new Date();
        schedule.publishedBy = req.user._id;
        await schedule.save();

        const recipientIds = await User.find({ schoolCode: req.user.schoolCode, role: { $in: ['teacher', 'student'] }, isActive: true })
            .select('_id').limit(500).lean().then(users => users.map(u => u._id));

        await createNotification({
            title: 'Exam Routine Published',
            body: `Exam schedule for ${schedule.examName} (${schedule.academicYear}) has been published.`,
            type: 'notice',
            link: `/exam-schedule/${schedule._id}`,
            schoolCode: req.user.schoolCode,
            recipients: recipientIds.length ? recipientIds : [req.user._id]
        });

        await AuditLog.create({
            user: req.user._id,
            action: 'EXAM_SCHEDULE_PUBLISHED',
            details: { scheduleId: schedule._id, examName: schedule.examName },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ success: true, message: 'Exam routine published.', data: schedule });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
