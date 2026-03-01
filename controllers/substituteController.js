/**
 * 👨‍🏫 SUBSTITUTE & ABSENCE CONTROLLER
 * Advanced teacher leave and substitute management system
 */
const Substitution = require('../models/Substitution');
const LeaveRequest = require('../models/LeaveRequest');
const TeacherAbsence = require('../models/TeacherAbsence');
const AdvancedRoutine = require('../models/AdvancedRoutine');
const ClassRoutine = require('../models/ClassRoutine');
const Teacher = require('../models/Teacher');
const User = require('../models/User');
const School = require('../models/School');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');

exports.assignSubstitute = async (req, res) => {
    try {
        const { date, day, periodNumber, className, section, subjectId, originalTeacherId, substituteTeacherId, leaveRequestId, remarks } = req.body;
        if (!date || !originalTeacherId || !substituteTeacherId) {
            return res.status(400).json({ success: false, message: 'Date, original teacher, and substitute teacher required' });
        }
        const school = await School.findOne({ schoolCode: req.user.schoolCode });
        if (!school) return res.status(404).json({ success: false, message: 'School not found' });

        const sub = await Substitution.create({
            schoolId: school._id,
            schoolCode: req.user.schoolCode,
            date: new Date(date),
            day: day || getDayName(new Date(date)),
            periodNumber,
            className,
            section,
            subjectId,
            originalTeacherId,
            substituteTeacherId,
            leaveRequestId,
            assignedBy: req.user._id,
            remarks
        });

        await AuditLog.create({
            user: req.user._id,
            action: 'SUBSTITUTE_ASSIGNED',
            details: { substitutionId: sub._id, originalTeacherId, substituteTeacherId },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
        res.status(201).json({ success: true, data: sub });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.suggestSubstitutes = async (req, res) => {
    try {
        const { date, periodNumber, originalTeacherId } = req.query;
        if (!date || !periodNumber) {
            return res.status(400).json({ success: false, message: 'Date and period number required' });
        }
        const d = new Date(date);
        const day = getDayName(d);

        const existingRoutines = await ClassRoutine.find({
            schoolCode: req.user.schoolCode,
            day,
            'periods.period': parseInt(periodNumber)
        }).lean();

        const busyTeacherIds = new Set();
        existingRoutines.forEach(r => {
            r.periods?.forEach(p => {
                if (p.period === parseInt(periodNumber) && p.teacher) busyTeacherIds.add(p.teacher.toString());
            });
        });

        const substitutions = await Substitution.find({
            schoolCode: req.user.schoolCode,
            date: d,
            periodNumber: parseInt(periodNumber),
            status: 'scheduled'
        }).select('substituteTeacherId').lean();

        substitutions.forEach(s => busyTeacherIds.add(s.substituteTeacherId?.toString()));

        const excludeIds = [...busyTeacherIds];
        if (originalTeacherId) excludeIds.push(originalTeacherId);
        const teachers = await Teacher.find({
            schoolCode: req.user.schoolCode,
            isActive: true,
            userId: { $nin: excludeIds }
        }).populate('userId', 'name email').limit(10).lean();

        res.json({ success: true, data: teachers });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getSubstitutions = async (req, res) => {
    try {
        const { date, teacherId } = req.query;
        const query = { schoolCode: req.user.schoolCode };
        if (date) query.date = new Date(date);
        if (teacherId) query.$or = [{ originalTeacherId: teacherId }, { substituteTeacherId: teacherId }];

        const subs = await Substitution.find(query)
            .populate('originalTeacherId', 'name email')
            .populate('substituteTeacherId', 'name email')
            .sort({ date: -1, periodNumber: 1 })
            .lean();
        res.json({ success: true, data: subs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

function getDayName(date) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[date.getDay()];
}
