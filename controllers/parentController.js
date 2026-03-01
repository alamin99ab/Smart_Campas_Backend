/**
 * 🎓 PARENT CONTROLLER
 * Complete parent dashboard implementation
 */

const User = require('../models/User');
const Student = require('../models/Student');
const Attendance = require('../models/AdvancedAttendance');
const Result = require('../models/Result');
const Fee = require('../models/Fee');
const Notice = require('../models/Notice');

/**
 * @desc    Get parent dashboard
 * @route   GET /api/parent/dashboard
 * @access  Parent only
 */
exports.getParentDashboard = async (req, res) => {
    try {
        const parentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        // Get children of this parent
        const children = await Student.find({ 
            parentId, 
            schoolCode,
            isActive: true 
        }).populate('classId', 'className')
          .populate('sectionId', 'sectionName');

        // Get children's attendance summary
        const attendanceSummary = await Promise.all(
            children.map(async (child) => {
                const attendance = await Attendance.find({
                    studentId: child._id,
                    schoolCode
                }).sort({ date: -1 }).limit(30);
                
                const presentCount = attendance.filter(a => a.status === 'present').length;
                const totalCount = attendance.length;
                const percentage = totalCount > 0 ? (presentCount / totalCount) * 100 : 0;

                return {
                    studentId: child._id,
                    studentName: child.name,
                    attendancePercentage: Math.round(percentage),
                    lastAttendance: attendance[0] || null
                };
            })
        );

        // Get children's recent results
        const resultsSummary = await Promise.all(
            children.map(async (child) => {
                const results = await Result.find({
                    studentId: child._id,
                    schoolCode
                }).sort({ createdAt: -1 }).limit(5);

                return {
                    studentId: child._id,
                    studentName: child.name,
                    recentResults: results
                };
            })
        );

        // Get fee status for children
        const feeSummary = await Promise.all(
            children.map(async (child) => {
                const fees = await Fee.find({
                    studentId: child._id,
                    schoolCode
                }).sort({ dueDate: -1 }).limit(3);

                const totalDue = fees.reduce((sum, fee) => sum + (fee.amount - fee.paidAmount), 0);
                const upcomingFees = fees.filter(fee => fee.status === 'unpaid');

                return {
                    studentId: child._id,
                    studentName: child.name,
                    totalDue,
                    upcomingFees: upcomingFees.length,
                    nextDueDate: upcomingFees[0]?.dueDate || null
                };
            })
        );

        // Get notices relevant to parents
        const notices = await Notice.find({
            schoolCode,
            isActive: true,
            $or: [
                { targetRoles: { $in: ['parent'] } },
                { targetRoles: { $size: 0 } }
            ]
        }).sort({ createdAt: -1 }).limit(10);

        const dashboard = {
            children: children.map(child => ({
                id: child._id,
                name: child.name,
                className: child.classId?.className || 'N/A',
                sectionName: child.sectionId?.sectionName || 'N/A',
                rollNumber: child.rollNumber,
                profileImage: child.profileImage
            })),
            attendanceSummary,
            resultsSummary,
            feeSummary,
            recentNotices: notices,
            summary: {
                totalChildren: children.length,
                childrenWithLowAttendance: attendanceSummary.filter(a => a.attendancePercentage < 75).length,
                totalFeesDue: feeSummary.reduce((sum, f) => sum + f.totalDue, 0),
                upcomingExams: 0 // Can be calculated from results
            }
        };

        res.status(200).json({
            success: true,
            data: dashboard
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
 * @desc    Get children details
 * @route   GET /api/parent/children
 * @access  Parent only
 */
exports.getChildren = async (req, res) => {
    try {
        const parentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        const children = await Student.find({ 
            parentId, 
            schoolCode,
            isActive: true 
        })
        .populate('classId', 'className')
        .populate('sectionId', 'sectionName')
        .populate('subjects.subjectId', 'subjectName');

        res.status(200).json({
            success: true,
            data: children
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
 * @desc    Get child attendance
 * @route   GET /api/parent/attendance/:studentId
 * @access  Parent only
 */
exports.getChildAttendance = async (req, res) => {
    try {
        const { studentId } = req.params;
        const parentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        // Verify parent owns this child
        const student = await Student.findOne({ _id: studentId, parentId, schoolCode });
        if (!student) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const attendance = await Attendance.find({
            studentId,
            schoolCode
        }).sort({ date: -1 }).limit(100);

        // Calculate attendance statistics
        const presentCount = attendance.filter(a => a.status === 'present').length;
        const absentCount = attendance.filter(a => a.status === 'absent').length;
        const leaveCount = attendance.filter(a => a.status === 'leave').length;
        const totalCount = attendance.length;
        const percentage = totalCount > 0 ? (presentCount / totalCount) * 100 : 0;

        res.status(200).json({
            success: true,
            data: {
                attendance,
                statistics: {
                    present: presentCount,
                    absent: absentCount,
                    leave: leaveCount,
                    total: totalCount,
                    percentage: Math.round(percentage)
                }
            }
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
 * @desc    Get child results
 * @route   GET /api/parent/results/:studentId
 * @access  Parent only
 */
exports.getChildResults = async (req, res) => {
    try {
        const { studentId } = req.params;
        const parentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        // Verify parent owns this child
        const student = await Student.findOne({ _id: studentId, parentId, schoolCode });
        if (!student) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const results = await Result.find({
            studentId,
            schoolCode
        })
        .populate('examId', 'examName examType')
        .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: results
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
 * @desc    Get child fees
 * @route   GET /api/parent/fees/:studentId
 * @access  Parent only
 */
exports.getChildFees = async (req, res) => {
    try {
        const { studentId } = req.params;
        const parentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        // Verify parent owns this child
        const student = await Student.findOne({ _id: studentId, parentId, schoolCode });
        if (!student) {
            return res.status(403).json({
                success: false,
                message: 'Access denied'
            });
        }

        const fees = await Fee.find({
            studentId,
            schoolCode
        }).sort({ dueDate: -1 });

        const totalDue = fees.reduce((sum, fee) => sum + (fee.amount - fee.paidAmount), 0);
        const paidAmount = fees.reduce((sum, fee) => sum + fee.paidAmount, 0);

        res.status(200).json({
            success: true,
            data: {
                fees,
                summary: {
                    totalFees: fees.reduce((sum, fee) => sum + fee.amount, 0),
                    totalPaid: paidAmount,
                    totalDue,
                    unpaidCount: fees.filter(f => f.status === 'unpaid').length
                }
            }
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
 * @desc    Get parent profile
 * @route   GET /api/parent/profile
 * @access  Parent only
 */
exports.getParentProfile = async (req, res) => {
    try {
        const parentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        const parent = await User.findById(parentId).select('-password');
        
        if (!parent) {
            return res.status(404).json({
                success: false,
                message: 'Parent not found'
            });
        }

        res.status(200).json({
            success: true,
            data: parent
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
 * @desc    Update parent profile
 * @route   PUT /api/parent/profile
 * @access  Parent only
 */
exports.updateParentProfile = async (req, res) => {
    try {
        const parentId = req.user.id;
        const { name, email, phone, address } = req.body;

        const parent = await User.findByIdAndUpdate(
            parentId,
            { name, email, phone, address },
            { new: true, runValidators: true }
        ).select('-password');

        if (!parent) {
            return res.status(404).json({
                success: false,
                message: 'Parent not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: parent
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};
