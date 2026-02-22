const ClassRoutine = require('../models/ClassRoutine');
const AuditLog = require('../models/AuditLog');

exports.createRoutine = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin' && req.user.role !== 'teacher') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { studentClass, section, day, periods, academicYear, semester } = req.body;

        if (!studentClass || !day || !periods || !Array.isArray(periods) || !academicYear) {
            return res.status(400).json({ success: false, message: 'Class, day, periods, and academic year are required' });
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
        if (periods) routine.periods = periods;
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
