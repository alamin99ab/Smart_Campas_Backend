/**
 * Leave Management Controller - Teacher leave requests
 */
const LeaveRequest = require('../models/LeaveRequest');
const Substitution = require('../models/Substitution');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const School = require('../models/School');

exports.applyLeave = async (req, res) => {
    try {
        const { leaveType, startDate, endDate, reason } = req.body;
        if (!startDate || !endDate) {
            return res.status(400).json({ success: false, message: 'Start and end date required' });
        }
        const school = await School.findOne({ schoolCode: req.user.schoolCode });
        if (!school) return res.status(404).json({ success: false, message: 'School not found' });

        const leave = await LeaveRequest.create({
            schoolId: school._id,
            schoolCode: req.user.schoolCode,
            teacherId: req.user._id,
            leaveType: leaveType || 'Personal',
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            reason
        });
        res.status(201).json({ success: true, data: leave });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getMyLeaves = async (req, res) => {
    try {
        const leaves = await LeaveRequest.find({
            teacherId: req.user._id,
            schoolCode: req.user.schoolCode
        }).sort({ startDate: -1 }).lean();
        res.json({ success: true, data: leaves });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getAllLeaves = async (req, res) => {
    try {
        const { status, teacherId } = req.query;
        const query = { schoolCode: req.user.schoolCode };
        if (status) query.status = status;
        if (teacherId) query.teacherId = teacherId;

        const leaves = await LeaveRequest.find(query)
            .populate('teacherId', 'name email')
            .populate('approvedBy', 'name')
            .sort({ startDate: -1 })
            .lean();
        res.json({ success: true, data: leaves });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.approveLeave = async (req, res) => {
    try {
        const leave = await LeaveRequest.findOne({
            _id: req.params.id,
            schoolCode: req.user.schoolCode,
            status: 'pending'
        });
        if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });

        leave.status = 'approved';
        leave.approvedBy = req.user._id;
        leave.approvedAt = new Date();
        await leave.save();

        await AuditLog.create({
            user: req.user._id,
            action: 'LEAVE_APPROVED',
            details: { leaveId: leave._id, teacherId: leave.teacherId },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
        res.json({ success: true, data: leave });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.rejectLeave = async (req, res) => {
    try {
        const { rejectionReason } = req.body;
        const leave = await LeaveRequest.findOne({
            _id: req.params.id,
            schoolCode: req.user.schoolCode,
            status: 'pending'
        });
        if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });

        leave.status = 'rejected';
        leave.approvedBy = req.user._id;
        leave.approvedAt = new Date();
        leave.rejectionReason = rejectionReason;
        await leave.save();

        await AuditLog.create({
            user: req.user._id,
            action: 'LEAVE_REJECTED',
            details: { leaveId: leave._id },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
        res.json({ success: true, data: leave });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * @desc    Get all leave applications
 * @route   GET /api/leave/applications
 * @access  Principal/Admin
 */
exports.getLeaveApplications = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const schoolCode = req.user.schoolCode;

        const query = { schoolCode };
        if (status) query.status = status;

        const leaves = await LeaveRequest.find(query)
            .populate('applicant', 'name email role')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await LeaveRequest.countDocuments(query);

        res.json({
            success: true,
            data: leaves,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * @desc    Get available substitutes
 * @route   GET /api/leave/available-substitutes
 * @access  Principal/Admin
 */
exports.getAvailableSubstitutes = async (req, res) => {
    try {
        const { subjectId, date } = req.query;
        const schoolCode = req.user.schoolCode;

        const substitutes = await User.find({
            schoolCode,
            role: 'teacher',
            subjects: subjectId,
            isActive: true
        }).select('name email subjects');

        res.json({ success: true, data: substitutes });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * @desc    Get my substitute assignments
 * @route   GET /api/leave/my-assignments
 * @access  Teacher
 */
exports.getMySubstituteAssignments = async (req, res) => {
    try {
        const teacherId = req.user._id;
        const schoolCode = req.user.schoolCode;

        const assignments = await Substitution.find({
            substituteTeacher: teacherId,
            schoolCode
        }).populate('originalTeacher', 'name')
        .populate('class', 'className')
        .populate('subject', 'subjectName')
        .sort({ date: -1 });

        res.json({ success: true, data: assignments });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * @desc    Get leave statistics
 * @route   GET /api/leave/statistics
 * @access  Principal/Admin
 */
exports.getLeaveStatistics = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        
        const stats = await LeaveRequest.aggregate([
            { $match: { schoolCode } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({ success: true, data: stats });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * @desc    Respond to substitute assignment
 * @route   POST /api/leave/substitute/respond
 * @access  Teacher only
 */
exports.respondToSubstituteAssignment = async (req, res) => {
    try {
        const { assignmentId, response } = req.body;
        const teacherId = req.user._id;

        res.json({ 
            success: true, 
            message: `Substitute assignment ${response}`,
            data: { assignmentId, response, teacherId }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
