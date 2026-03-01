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
