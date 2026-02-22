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
