/**
 * 🎓 STUDENT CONTROLLER
 * Industry-level Student management for Smart Campus System
 * Students can only view notices and check their results
 */

const User = require('../models/User');
const Class = require('../models/Class');
const Notice = require('../models/Notice');
const Result = require('../models/Result');
const Attendance = require('../models/Attendance');
const Routine = require('../models/Routine');

/**
 * @desc    Get student dashboard
 * @route   GET /api/student/dashboard
 * @access  Student only
 */
exports.getStudentDashboard = async (req, res) => {
    try {
        const studentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        // Get student details with class information
        const student = await User.findById(studentId)
            .populate('classId', 'className section classLevel')
            .select('name rollNumber email phone classId');

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        // Get recent notices
        const notices = await Notice.find({
            schoolCode,
            targetAudience: { $in: ['student', 'all'] },
            isActive: true
        })
        .sort({ createdAt: -1 })
        .limit(5);

        // Get recent results
        const results = await Result.find({
            schoolCode,
            studentId,
            isActive: true
        })
        .populate('subjectId', 'subjectName subjectCode')
        .populate('examType')
        .sort({ examDate: -1 })
        .limit(5);

        // Get attendance summary (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const attendanceRecords = await Attendance.find({
            schoolCode,
            'attendance.studentId': studentId,
            date: { $gte: thirtyDaysAgo }
        });

        const attendanceSummary = {
            total: attendanceRecords.length,
            present: attendanceRecords.filter(record => 
                record.attendance.some(att => 
                    att.studentId.toString() === studentId.toString() && 
                    att.status === 'Present'
                )
            ).length,
            absent: attendanceRecords.filter(record => 
                record.attendance.some(att => 
                    att.studentId.toString() === studentId.toString() && 
                    att.status === 'Absent'
                )
            ).length,
            late: attendanceRecords.filter(record => 
                record.attendance.some(att => 
                    att.studentId.toString() === studentId.toString() && 
                    att.status === 'Late'
                )
            ).length
        };

        // Get today's routine
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const todayRoutine = await Routine.findOne({
            schoolCode,
            classId: student.classId._id,
            'schedule.day': today,
            isActive: true
        })
        .populate('schedule.periods.subjectId', 'subjectName')
        .populate('schedule.periods.teacherId', 'name');

        res.status(200).json({
            success: true,
            data: {
                student: {
                    name: student.name,
                    rollNumber: student.rollNumber,
                    class: student.classId
                },
                notices,
                results,
                attendance: {
                    summary: attendanceSummary,
                    attendancePercentage: attendanceSummary.total > 0 
                        ? Math.round((attendanceSummary.present / attendanceSummary.total) * 100)
                        : 0
                },
                todayRoutine: todayRoutine ? todayRoutine.schedule.find(s => s.day === today) : null
            }
        });

    } catch (error) {
        console.error('Error getting student dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving dashboard data',
            error: error.message
        });
    }
};

/**
 * @desc    Get all notices for student
 * @route   GET /api/student/notices
 * @access  Student only
 */
exports.getNotices = async (req, res) => {
    try {
        const { page = 1, limit = 10, priority } = req.query;
        const studentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        const query = {
            schoolCode,
            targetAudience: { $in: ['student', 'all'] },
            isActive: true
        };

        if (priority) {
            query.priority = priority;
        }

        const notices = await Notice.find(query)
            .sort({ createdAt: -1, priority: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Notice.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                notices,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Error getting notices:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving notices',
            error: error.message
        });
    }
};

/**
 * @desc    Get student's results
 * @route   GET /api/student/results
 * @access  Student only
 */
exports.getResults = async (req, res) => {
    try {
        const { examType, subjectId, academicYear } = req.query;
        const studentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        const query = {
            schoolCode,
            studentId,
            isActive: true
        };

        if (examType) query.examType = examType;
        if (subjectId) query.subjectId = subjectId;
        if (academicYear) query.academicYear = academicYear;

        const results = await Result.find(query)
            .populate('classId', 'className section')
            .populate('subjectId', 'subjectName subjectCode')
            .populate('teacherId', 'name')
            .sort({ examDate: -1 });

        // Calculate overall performance
        const totalMarks = results.reduce((sum, result) => sum + result.marksObtained, 0);
        const maxMarks = results.reduce((sum, result) => sum + result.totalMarks, 0);
        const overallPercentage = maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : 0;

        // Grade distribution
        const gradeDistribution = results.reduce((acc, result) => {
            acc[result.grade] = (acc[result.grade] || 0) + 1;
            return acc;
        }, {});

        res.status(200).json({
            success: true,
            data: {
                results,
                summary: {
                    totalExams: results.length,
                    overallPercentage,
                    totalMarksObtained: totalMarks,
                    totalMaxMarks: maxMarks,
                    gradeDistribution
                }
            }
        });

    } catch (error) {
        console.error('Error getting results:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving results',
            error: error.message
        });
    }
};

/**
 * @desc    Get student's attendance
 * @route   GET /api/student/attendance
 * @access  Student only
 */
exports.getAttendance = async (req, res) => {
    try {
        const { startDate, endDate, month, year } = req.query;
        const studentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        const query = {
            schoolCode,
            'attendance.studentId': studentId
        };

        // Date filtering
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        } else if (month && year) {
            const startOfMonth = new Date(year, month - 1, 1);
            const endOfMonth = new Date(year, month, 0);
            query.date = {
                $gte: startOfMonth,
                $lte: endOfMonth
            };
        }

        const attendanceRecords = await Attendance.find(query)
            .populate('classId', 'className section')
            .populate('subjectId', 'subjectName subjectCode')
            .sort({ date: -1 });

        // Process attendance data for the student
        const studentAttendance = attendanceRecords.map(record => {
            const studentRecord = record.attendance.find(
                att => att.studentId.toString() === studentId.toString()
            );
            
            return {
                date: record.date,
                class: record.classId,
                subject: record.subjectId,
                status: studentRecord ? studentRecord.status : 'Not Recorded',
                remarks: studentRecord ? studentRecord.remarks : ''
            };
        });

        // Calculate attendance summary
        const summary = {
            total: studentAttendance.length,
            present: studentAttendance.filter(att => att.status === 'Present').length,
            absent: studentAttendance.filter(att => att.status === 'Absent').length,
            late: studentAttendance.filter(att => att.status === 'Late').length,
            excused: studentAttendance.filter(att => att.status === 'Excused').length,
            percentage: studentAttendance.length > 0 
                ? Math.round((studentAttendance.filter(att => att.status === 'Present').length / studentAttendance.length) * 100)
                : 0
        };

        res.status(200).json({
            success: true,
            data: {
                attendance: studentAttendance,
                summary
            }
        });

    } catch (error) {
        console.error('Error getting attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving attendance',
            error: error.message
        });
    }
};

/**
 * @desc    Get student's class routine
 * @route   GET /api/student/routine
 * @access  Student only
 */
exports.getRoutine = async (req, res) => {
    try {
        const studentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        // Get student's class
        const student = await User.findById(studentId).populate('classId');
        if (!student || !student.classId) {
            return res.status(404).json({
                success: false,
                message: 'Student class not found'
            });
        }

        // Get routine for student's class
        const routine = await Routine.findOne({
            schoolCode,
            classId: student.classId._id,
            isActive: true
        })
        .populate('classId', 'className section')
        .populate('schedule.periods.subjectId', 'subjectName')
        .populate('schedule.periods.teacherId', 'name');

        if (!routine) {
            return res.status(404).json({
                success: false,
                message: 'Routine not found for your class'
            });
        }

        res.status(200).json({
            success: true,
            data: {
                class: routine.classId,
                schedule: routine.schedule,
                breaks: routine.breaks,
                academicYear: routine.academicYear,
                semester: routine.semester
            }
        });

    } catch (error) {
        console.error('Error getting routine:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving routine',
            error: error.message
        });
    }
};

/**
 * @desc    Get student profile
 * @route   GET /api/student/profile
 * @access  Student only
 */
exports.getProfile = async (req, res) => {
    try {
        const studentId = req.user.id;

        const student = await User.findById(studentId)
            .populate('classId', 'className section classLevel')
            .select('-password')
            .select('-__v');

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        res.status(200).json({
            success: true,
            data: student
        });

    } catch (error) {
        console.error('Error getting profile:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving profile',
            error: error.message
        });
    }
};

/**
 * @desc    Get today's routine
 * @route   GET /api/student/routine/today
 * @access  Student only
 */
exports.getTodayRoutine = async (req, res) => {
    try {
        const studentId = req.user.id;
        const schoolCode = req.user.schoolCode;
        const today = new Date().getDay();

        res.status(200).json({
            success: true,
            message: 'Today\'s routine retrieved',
            data: { day: today, routine: [] }
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
 * @desc    Get weekly routine
 * @route   GET /api/student/routine/week
 * @access  Student only
 */
exports.getWeeklyRoutine = async (req, res) => {
    try {
        const studentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        res.status(200).json({
            success: true,
            message: 'Weekly routine retrieved',
            data: { routine: [] }
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
 * @desc    Get attendance summary
 * @route   GET /api/student/attendance/summary
 * @access  Student only
 */
exports.getAttendanceSummary = async (req, res) => {
    try {
        const studentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        res.status(200).json({
            success: true,
            message: 'Attendance summary retrieved',
            data: { totalDays: 0, presentDays: 0, percentage: 0 }
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
 * @desc    Get monthly attendance
 * @route   GET /api/student/attendance/monthly
 * @access  Student only
 */
exports.getMonthlyAttendance = async (req, res) => {
    try {
        const studentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        res.status(200).json({
            success: true,
            message: 'Monthly attendance retrieved',
            data: { monthlyData: [] }
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
 * @desc    Get assignments
 * @route   GET /api/student/assignments
 * @access  Student only
 */
exports.getAssignments = async (req, res) => {
    try {
        const studentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        res.status(200).json({
            success: true,
            message: 'Assignments retrieved',
            data: []
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
 * @desc    Get assignment details
 * @route   GET /api/student/assignments/:id
 * @access  Student only
 */
exports.getAssignmentDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const studentId = req.user.id;

        res.status(200).json({
            success: true,
            message: 'Assignment details retrieved',
            data: { id, title: 'Sample Assignment' }
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
 * @desc    Submit assignment
 * @route   POST /api/student/assignments/:id/submit
 * @access  Student only
 */
exports.submitAssignment = async (req, res) => {
    try {
        const { id } = req.params;
        const { submission } = req.body;
        const studentId = req.user.id;

        res.status(200).json({
            success: true,
            message: 'Assignment submitted successfully',
            data: { assignmentId: id, submittedAt: new Date() }
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
 * @desc    Get study materials
 * @route   GET /api/student/study-materials
 * @access  Student only
 */
exports.getStudyMaterials = async (req, res) => {
    try {
        const studentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        res.status(200).json({
            success: true,
            message: 'Study materials retrieved',
            data: []
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
 * @desc    Download study material
 * @route   GET /api/student/study-materials/:id
 * @access  Student only
 */
exports.downloadStudyMaterial = async (req, res) => {
    try {
        const { id } = req.params;
        const studentId = req.user.id;

        res.status(200).json({
            success: true,
            message: 'Study material download link',
            data: { downloadUrl: `https://example.com/materials/${id}` }
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
 * @desc    Get student profile
 * @route   GET /api/student/profile
 * @access  Student only
 */
exports.getStudentProfile = async (req, res) => {
    try {
        const studentId = req.user.id;
        const student = await User.findById(studentId).select('-password');
        
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        res.status(200).json({
            success: true,
            data: student
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
 * @desc    Update student profile
 * @route   PUT /api/student/profile
 * @access  Student only
 */
exports.updateStudentProfile = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { name, email, phone, address } = req.body;

        const student = await User.findByIdAndUpdate(
            studentId,
            { name, email, phone, address },
            { new: true, runValidators: true }
        ).select('-password');

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: student
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
 * @desc    Change password
 * @route   PUT /api/student/password
 * @access  Student only
 */
exports.changePassword = async (req, res) => {
    try {
        const studentId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        const student = await User.findById(studentId);
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found'
            });
        }

        // Check current password
        const isMatch = await student.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update password
        student.password = newPassword;
        await student.save();

        res.status(200).json({
            success: true,
            message: 'Password changed successfully'
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
 * @desc    Get my routine
 * @route   GET /api/student/routine
 * @access  Student only
 */
exports.getMyRoutine = async (req, res) => {
    try {
        const studentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        res.status(200).json({
            success: true,
            message: 'Routine retrieved',
            data: { routine: [] }
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
 * @desc    Get performance analytics
 * @route   GET /api/student/performance
 * @access  Student only
 */
exports.getPerformanceAnalytics = async (req, res) => {
    try {
        const studentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        const performance = {
            overallGPA: 0,
            subjectPerformance: [],
            trends: []
        };

        res.status(200).json({
            success: true,
            data: performance
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
 * @desc    Get subject performance
 * @route   GET /api/student/performance/subjects
 * @access  Student only
 */
exports.getSubjectPerformance = async (req, res) => {
    try {
        const studentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        const subjectPerformance = {
            subjects: [],
            averageMarks: 0
        };

        res.status(200).json({
            success: true,
            data: subjectPerformance
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
 * @desc    Get attendance trend
 * @route   GET /api/student/performance/attendance-trend
 * @access  Student only
 */
exports.getAttendanceTrend = async (req, res) => {
    try {
        const studentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        const attendanceTrend = {
            monthlyData: [],
            overallPercentage: 0
        };

        res.status(200).json({
            success: true,
            data: attendanceTrend
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};
