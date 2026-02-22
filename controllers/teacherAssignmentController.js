const TeacherAssignment = require('../models/TeacherAssignment');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

exports.assignSubject = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const { teacherId, subject, classes, sections, periodsPerWeek, academicYear, semester } = req.body;

        if (!teacherId || !subject || !academicYear) {
            return res.status(400).json({ success: false, message: 'Teacher, subject, and academic year are required' });
        }

        const teacher = await User.findOne({
            _id: teacherId,
            schoolCode: req.user.schoolCode,
            role: 'teacher'
        });

        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher not found' });
        }

        const assignment = await TeacherAssignment.create({
            schoolCode: req.user.schoolCode,
            teacher: teacherId,
            subject,
            classes: classes || [],
            sections: sections || [],
            periodsPerWeek: periodsPerWeek || 0,
            academicYear,
            semester,
            assignedBy: req.user._id
        });

        await AuditLog.create({
            user: req.user._id,
            action: 'TEACHER_SUBJECT_ASSIGNED',
            details: { teacherId, subject, classes },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(201).json({ success: true, data: assignment });
    } catch (err) {
        console.error('Assign subject error:', err);
        res.status(500).json({ success: false, message: 'Failed to assign subject' });
    }
};

exports.getTeacherAssignments = async (req, res) => {
    try {
        const { teacherId, subject, academicYear } = req.query;
        const query = { schoolCode: req.user.schoolCode, isActive: true };
        if (teacherId) query.teacher = teacherId;
        if (subject) query.subject = subject;
        if (academicYear) query.academicYear = academicYear;

        const assignments = await TeacherAssignment.find(query)
            .populate('teacher', 'name email')
            .populate('assignedBy', 'name')
            .sort({ subject: 1 })
            .lean();

        res.json({ success: true, data: assignments });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch assignments' });
    }
};

exports.getTeacherLoad = async (req, res) => {
    try {
        const { teacherId } = req.params;
        const { academicYear } = req.query;

        const query = {
            teacher: teacherId,
            schoolCode: req.user.schoolCode,
            isActive: true
        };
        if (academicYear) query.academicYear = academicYear;

        const assignments = await TeacherAssignment.find(query).lean();

        const loadSummary = {
            totalSubjects: assignments.length,
            totalPeriodsPerWeek: assignments.reduce((sum, a) => sum + (a.periodsPerWeek || 0), 0),
            classes: [...new Set(assignments.flatMap(a => a.classes || []))],
            subjects: assignments.map(a => ({
                subject: a.subject,
                classes: a.classes,
                periodsPerWeek: a.periodsPerWeek
            }))
        };

        res.json({ success: true, data: loadSummary });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch teacher load' });
    }
};

exports.updateAssignment = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const assignment = await TeacherAssignment.findOne({
            _id: req.params.id,
            schoolCode: req.user.schoolCode
        });

        if (!assignment) {
            return res.status(404).json({ success: false, message: 'Assignment not found' });
        }

        const { classes, sections, periodsPerWeek, isActive } = req.body;
        if (classes !== undefined) assignment.classes = classes;
        if (sections !== undefined) assignment.sections = sections;
        if (periodsPerWeek !== undefined) assignment.periodsPerWeek = periodsPerWeek;
        if (isActive !== undefined) assignment.isActive = isActive;
        await assignment.save();

        res.json({ success: true, data: assignment });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update assignment' });
    }
};

exports.deleteAssignment = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const result = await TeacherAssignment.deleteOne({
            _id: req.params.id,
            schoolCode: req.user.schoolCode
        });

        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Assignment not found' });
        }

        res.json({ success: true, message: 'Assignment deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete assignment' });
    }
};
