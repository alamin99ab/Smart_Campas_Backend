const ClassRoutine = require('../models/ClassRoutine');
const AuditLog = require('../models/AuditLog');
const Teacher = require('../models/Teacher');
const User = require('../models/User');
const { createNotification } = require('../utils/createNotification');

async function checkRoutineConflicts(schoolCode, day, periods, academicYear, excludeRoutineId = null) {
    const errors = [];
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const teacherPeriodCount = {};
    const periodTeacherMap = {};
    const periodRoomMap = {};

    for (const p of periods) {
        const pid = p.period || p.periodNumber;
        const tid = p.teacher?.toString?.() || p.teacher;
        const room = (p.room || p.roomNumber || '').toString().trim();

        if (tid) {
            periodTeacherMap[pid] = periodTeacherMap[pid] || [];
            if (!periodTeacherMap[pid].includes(tid)) periodTeacherMap[pid].push(tid);
        }
        if (room) {
            periodRoomMap[pid] = periodRoomMap[pid] || [];
            if (!periodRoomMap[pid].includes(room)) periodRoomMap[pid].push(room);
        }
    }

    const existingRoutines = await ClassRoutine.find({
        schoolCode,
        day,
        academicYear,
        isActive: true,
        ...(excludeRoutineId && { _id: { $ne: excludeRoutineId } })
    }).lean();

    for (const r of existingRoutines) {
        for (const p of r.periods || []) {
            const pid = p.period || p.periodNumber;
            const tid = p.teacher?.toString?.();
            const room = (p.room || '').toString().trim();
            if (tid) {
                periodTeacherMap[pid] = periodTeacherMap[pid] || [];
                if (!periodTeacherMap[pid].includes(tid)) periodTeacherMap[pid].push(tid);
            }
            if (room) {
                periodRoomMap[pid] = periodRoomMap[pid] || [];
                if (!periodRoomMap[pid].includes(room)) periodRoomMap[pid].push(room);
            }
        }
    }

    for (const p of periods) {
        const pid = p.period || p.periodNumber;
        const tid = p.teacher?.toString?.() || p.teacher;
        const room = (p.room || p.roomNumber || '').toString().trim();

        if (periodTeacherMap[pid]?.filter(t => t === tid).length > 1) {
            errors.push({ type: 'TEACHER_CONFLICT', period: pid, message: 'Same teacher assigned at same time slot' });
        }
        if (room && periodRoomMap[pid]?.filter(r => r === room).length > 1) {
            errors.push({ type: 'ROOM_CONFLICT', period: pid, room, message: 'Same room booked at same time slot' });
        }

        if (tid) {
            teacherPeriodCount[tid] = (teacherPeriodCount[tid] || 0) + 1;
        }
    }

    const allRoutines = await ClassRoutine.find({
        schoolCode,
        academicYear,
        isActive: true,
        ...(excludeRoutineId && { _id: { $ne: excludeRoutineId } })
    }).lean();

    const teacherWeeklyCount = {};
    for (const r of allRoutines) {
        for (const p of r.periods || []) {
            const tid = p.teacher?.toString?.();
            if (tid) teacherWeeklyCount[tid] = (teacherWeeklyCount[tid] || 0) + 1;
        }
    }
    for (const tid of Object.keys(teacherPeriodCount)) {
        teacherWeeklyCount[tid] = (teacherWeeklyCount[tid] || 0) + (teacherPeriodCount[tid] || 0);
    }

    for (const [tid, count] of Object.entries(teacherWeeklyCount)) {
        const teacher = await Teacher.findOne({ userId: tid, schoolCode }).lean();
        const maxLoad = teacher?.maxPeriodsPerWeek ?? 30;
        if (count > maxLoad) {
            errors.push({ type: 'TEACHER_LOAD_EXCEEDED', teacherId: tid, count, maxLoad, message: `Teacher load exceeded (${count} > ${maxLoad})` });
        }
    }

    return errors;
}

exports.checkConflicts = async (req, res) => {
    try {
        const { studentClass, section, day, periods, academicYear } = req.body;
        if (!day || !periods || !Array.isArray(periods) || !academicYear) {
            return res.status(400).json({ success: false, message: 'Day, periods, and academic year required' });
        }
        const errors = await checkRoutineConflicts(req.user.schoolCode, day, periods, academicYear);
        res.json({ success: true, data: { valid: errors.length === 0, conflicts: errors } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.createRoutine = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin' && req.user.role !== 'teacher') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { studentClass, section, day, periods, academicYear, semester } = req.body;

        if (!studentClass || !day || !periods || !Array.isArray(periods) || !academicYear) {
            return res.status(400).json({ success: false, message: 'Class, day, periods, and academic year are required' });
        }

        const conflicts = await checkRoutineConflicts(req.user.schoolCode, day, periods, academicYear);
        if (conflicts.length > 0) {
            return res.status(400).json({ success: false, message: 'Routine conflicts detected', conflicts });
        }

        const routine = await ClassRoutine.create({
            schoolCode: req.user.schoolCode,
            studentClass,
            section: section || null,
            day,
            periods,
            academicYear,
            semester,
            createdBy: req.user._id
        });

        await AuditLog.create({
            user: req.user._id,
            action: 'ROUTINE_CREATED',
            details: { routineId: routine._id, class: studentClass, day },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(201).json({ success: true, data: routine });
    } catch (err) {
        console.error('Create routine error:', err);
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'Routine already exists for this class/day/year' });
        }
        res.status(500).json({ success: false, message: 'Failed to create routine' });
    }
};

exports.getRoutines = async (req, res) => {
    try {
        const { studentClass, section, day, academicYear } = req.query;
        const query = { schoolCode: req.user.schoolCode, isActive: true };
        if (studentClass) query.studentClass = studentClass;
        if (section) query.section = section;
        if (day) query.day = day;
        if (academicYear) query.academicYear = academicYear;

        const routines = await ClassRoutine.find(query)
            .populate('periods.teacher', 'name email')
            .populate('createdBy', 'name')
            .sort({ studentClass: 1, day: 1 })
            .lean();

        res.json({ success: true, data: routines });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch routines' });
    }
};

exports.getRoutineById = async (req, res) => {
    try {
        const routine = await ClassRoutine.findOne({
            _id: req.params.id,
            schoolCode: req.user.schoolCode
        }).populate('periods.teacher', 'name email').lean();

        if (!routine) {
            return res.status(404).json({ success: false, message: 'Routine not found' });
        }

        res.json({ success: true, data: routine });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch routine' });
    }
};

exports.updateRoutine = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin' && req.user.role !== 'teacher') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const routine = await ClassRoutine.findOne({
            _id: req.params.id,
            schoolCode: req.user.schoolCode
        });

        if (!routine) {
            return res.status(404).json({ success: false, message: 'Routine not found' });
        }

        const { periods, isActive } = req.body;
        if (periods) {
            const conflicts = await checkRoutineConflicts(req.user.schoolCode, routine.day, periods, routine.academicYear, routine._id);
            if (conflicts.length > 0) {
                return res.status(400).json({ success: false, message: 'Routine conflicts detected', conflicts });
            }
            routine.periods = periods;
        }
        if (isActive !== undefined) routine.isActive = isActive;
        routine.updatedBy = req.user._id;
        await routine.save();

        await AuditLog.create({
            user: req.user._id,
            action: 'ROUTINE_UPDATED',
            details: { routineId: routine._id },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ success: true, data: routine });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update routine' });
    }
};

exports.deleteRoutine = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const result = await ClassRoutine.deleteOne({
            _id: req.params.id,
            schoolCode: req.user.schoolCode
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Routine not found' });
        }

        res.json({ success: true, message: 'Routine deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete routine' });
    }
};

// @desc    Publish routine – notify students & teachers
// @route   PUT /api/routine/:id/publish
// @access  Private (Principal/Admin)
exports.publishRoutine = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        const routine = await ClassRoutine.findOne({
            _id: req.params.id,
            schoolCode: req.user.schoolCode
        });
        if (!routine) return res.status(404).json({ success: false, message: 'Routine not found' });

        routine.isPublished = true;
        routine.publishedAt = new Date();
        routine.publishedBy = req.user._id;
        await routine.save();

        const teacherIds = [...new Set((routine.periods || []).map(p => p.teacher?.toString()).filter(Boolean))];
        const recipientIds = await User.find({
            schoolCode: req.user.schoolCode,
            role: { $in: ['teacher', 'student'] },
            isActive: true
        }).select('_id').limit(500).lean().then(users => users.map(u => u._id));

        await createNotification({
            title: 'Routine Published',
            body: `Class routine for ${routine.studentClass}${routine.section ? ' - ' + routine.section : ''} (${routine.academicYear}) has been published.`,
            type: 'notice',
            link: `/routine/${routine._id}`,
            schoolCode: req.user.schoolCode,
            recipients: recipientIds.length ? recipientIds : [req.user._id]
        });

        await AuditLog.create({
            user: req.user._id,
            action: 'ROUTINE_PUBLISHED',
            details: { routineId: routine._id, class: routine.studentClass },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ success: true, message: 'Routine published. Students and teachers notified.', data: routine });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
