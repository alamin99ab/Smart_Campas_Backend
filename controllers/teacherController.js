/**
 * 👨‍🏫 TEACHER CONTROLLER
 * Industry-level Teacher management for Smart Campus System
 */

const User = require('../models/User');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Attendance = require('../models/Attendance');
const Result = require('../models/Result');
const Notice = require('../models/Notice');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Get teacher's assigned classes and subjects
 * @route   GET /api/teacher/dashboard
 * @access  Teacher only
 */
exports.getTeacherDashboard = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const schoolCode = req.user.schoolCode;

        // Get subjects assigned to this teacher
        const assignedSubjects = await Subject.find({
            schoolCode,
            'teachers.teacherId': teacherId,
            'teachers.isActive': true
        }).populate('teachers.teacherId', 'name email');

        // Get classes where teacher is assigned
        const assignedClasses = await Class.find({
            schoolCode,
            'subjects.teacherId': teacherId
        }).populate('classTeacher', 'name email')
          .populate('subjects.subjectId', 'subjectName subjectCode')
          .populate('subjects.teacherId', 'name email');

        // Get today's schedule
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
        const Routine = require('../models/Routine');
        const todaySchedule = await Routine.find({
            schoolCode,
            'schedule.day': today,
            'schedule.periods.teacherId': teacherId
        }).populate('classId', 'className section')
          .populate('schedule.periods.subjectId', 'subjectName')
          .populate('schedule.periods.teacherId', 'name');

        res.status(200).json({
            success: true,
            data: {
                assignedSubjects,
                assignedClasses,
                todaySchedule,
                summary: {
                    totalSubjects: assignedSubjects.length,
                    totalClasses: assignedClasses.length,
                    todayPeriods: todaySchedule.reduce((acc, routine) => {
                        const daySchedule = routine.schedule.find(s => s.day === today);
                        return acc + (daySchedule ? daySchedule.periods.filter(p => 
                            p.teacherId.toString() === teacherId.toString() && !p.isBreak
                        ).length : 0);
                    }, 0)
                }
            }
        });

    } catch (error) {
        console.error('Error getting teacher dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving dashboard data',
            error: error.message
        });
    }
};

/**
 * @desc    Take attendance for a class
 * @route   POST /api/teacher/attendance
 * @access  Teacher only
 */
exports.takeAttendance = async (req, res) => {
    try {
        const { classId, subjectId, date, attendanceData } = req.body;
        const teacherId = req.user.id;
        const schoolCode = req.user.schoolCode;

        // Verify teacher is assigned to this class and subject
        const classDoc = await Class.findOne({
            _id: classId,
            schoolCode,
            'subjects.teacherId': teacherId,
            'subjects.subjectId': subjectId
        });

        if (!classDoc) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to take attendance for this class/subject'
            });
        }

        // Create attendance record
        const attendance = new Attendance({
            schoolCode,
            classId,
            subjectId,
            teacherId,
            date: new Date(date),
            attendance: attendanceData.map(record => ({
                studentId: record.studentId,
                status: record.status, // Present, Absent, Late, Excused
                remarks: record.remarks || ''
            }))
        });

        await attendance.save();

        // Log audit
        await AuditLog.create({
            userId: teacherId,
            action: 'TAKE_ATTENDANCE',
            details: `Attendance taken for class ${classDoc.className}-${classDoc.section}`,
            schoolCode
        });

        res.status(201).json({
            success: true,
            message: 'Attendance recorded successfully',
            data: attendance
        });

    } catch (error) {
        console.error('Error taking attendance:', error);
        res.status(500).json({
            success: false,
            message: 'Error recording attendance',
            error: error.message
        });
    }
};

/**
 * @desc    Get attendance records
 * @route   GET /api/teacher/attendance
 * @access  Teacher only
 */
exports.getAttendanceRecords = async (req, res) => {
    try {
        const { classId, subjectId, startDate, endDate } = req.query;
        const teacherId = req.user.id;
        const schoolCode = req.user.schoolCode;

        const query = { schoolCode, teacherId };
        if (classId) query.classId = classId;
        if (subjectId) query.subjectId = subjectId;
        if (startDate && endDate) {
            query.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const attendanceRecords = await Attendance.find(query)
            .populate('classId', 'className section')
            .populate('subjectId', 'subjectName subjectCode')
            .populate('attendance.studentId', 'name rollNumber email')
            .sort({ date: -1 });

        res.status(200).json({
            success: true,
            data: attendanceRecords
        });

    } catch (error) {
        console.error('Error getting attendance records:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving attendance records',
            error: error.message
        });
    }
};

/**
 * @desc    Input student results
 * @route   POST /api/teacher/results
 * @access  Teacher only
 */
exports.inputResults = async (req, res) => {
    try {
        const { classId, subjectId, examType, examDate, results } = req.body;
        const teacherId = req.user.id;
        const schoolCode = req.user.schoolCode;

        // Verify teacher is assigned to this class and subject
        const classDoc = await Class.findOne({
            _id: classId,
            schoolCode,
            'subjects.teacherId': teacherId,
            'subjects.subjectId': subjectId
        });

        if (!classDoc) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to input results for this class/subject'
            });
        }

        // Get subject details for validation
        const subject = await Subject.findById(subjectId);
        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        // Create result records
        const resultPromises = results.map(async (resultData) => {
            const result = new Result({
                schoolCode,
                classId,
                subjectId,
                studentId: resultData.studentId,
                teacherId,
                examType, // Midterm, Final, Quiz, Assignment
                examDate: new Date(examDate),
                marksObtained: resultData.marksObtained,
                totalMarks: resultData.totalMarks || subject.totalMarks,
                grade: calculateGrade(resultData.marksObtained, subject.totalMarks, subject.passingMarks),
                remarks: resultData.remarks || '',
                academicYear: new Date().getFullYear().toString()
            });

            return result.save();
        });

        const savedResults = await Promise.all(resultPromises);

        // Log audit
        await AuditLog.create({
            userId: teacherId,
            action: 'INPUT_RESULTS',
            details: `Results input for ${examType} - ${subject.subjectName}`,
            schoolCode
        });

        res.status(201).json({
            success: true,
            message: 'Results saved successfully',
            data: savedResults
        });

    } catch (error) {
        console.error('Error inputting results:', error);
        res.status(500).json({
            success: false,
            message: 'Error saving results',
            error: error.message
        });
    }
};

/**
 * @desc    Get results for teacher's classes
 * @route   GET /api/teacher/results
 * @access  Teacher only
 */
exports.getResults = async (req, res) => {
    try {
        const { classId, subjectId, examType, studentId } = req.query;
        const teacherId = req.user.id;
        const schoolCode = req.user.schoolCode;

        const query = { schoolCode, teacherId };
        if (classId) query.classId = classId;
        if (subjectId) query.subjectId = subjectId;
        if (examType) query.examType = examType;
        if (studentId) query.studentId = studentId;

        const results = await Result.find(query)
            .populate('classId', 'className section')
            .populate('subjectId', 'subjectName subjectCode')
            .populate('studentId', 'name rollNumber email')
            .sort({ examDate: -1 });

        res.status(200).json({
            success: true,
            data: results
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
 * @desc    Get students in teacher's class
 * @route   GET /api/teacher/students/:classId
 * @access  Teacher only
 */
exports.getClassStudents = async (req, res) => {
    try {
        const { classId } = req.params;
        const teacherId = req.user.id;
        const schoolCode = req.user.schoolCode;

        // Verify teacher is assigned to this class
        const classDoc = await Class.findOne({
            _id: classId,
            schoolCode,
            'subjects.teacherId': teacherId
        });

        if (!classDoc) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to view students of this class'
            });
        }

        // Get students in this class
        const students = await User.find({
            schoolCode,
            role: 'student',
            classId: classId,
            isActive: true
        }).select('name rollNumber email phone parentInfo')
          .sort({ rollNumber: 1 });

        res.status(200).json({
            success: true,
            data: {
                class: {
                    className: classDoc.className,
                    section: classDoc.section,
                    classLevel: classDoc.classLevel
                },
                students
            }
        });

    } catch (error) {
        console.error('Error getting class students:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving students',
            error: error.message
        });
    }
};

/**
 * @desc    Create notice (for teachers)
 * @route   POST /api/teacher/notices
 * @access  Teacher only
 */
exports.createNotice = async (req, res) => {
    try {
        const { title, content, targetAudience, priority, attachments } = req.body;
        const teacherId = req.user.id;
        const schoolCode = req.user.schoolCode;

        const notice = new Notice({
            schoolCode,
            title,
            content,
            targetAudience: targetAudience || ['student'], // student, parent, teacher
            priority: priority || 'Normal', // Normal, Important, Urgent
            attachments: attachments || [],
            createdBy: teacherId,
            authorName: req.user.name,
            authorRole: 'teacher'
        });

        await notice.save();

        // Log audit
        await AuditLog.create({
            userId: teacherId,
            action: 'CREATE_NOTICE',
            details: `Notice created: ${title}`,
            schoolCode
        });

        res.status(201).json({
            success: true,
            message: 'Notice created successfully',
            data: notice
        });

    } catch (error) {
        console.error('Error creating notice:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating notice',
            error: error.message
        });
    }
};

// Helper function to calculate grade
function calculateGrade(marksObtained, totalMarks, passingMarks) {
    const percentage = (marksObtained / totalMarks) * 100;
    
    if (percentage >= 90) return 'A+';
    if (percentage >= 85) return 'A';
    if (percentage >= 80) return 'A-';
    if (percentage >= 75) return 'B+';
    if (percentage >= 70) return 'B';
    if (percentage >= 65) return 'B-';
    if (percentage >= 60) return 'C+';
    if (percentage >= 55) return 'C';
    if (percentage >= 50) return 'C-';
    if (percentage >= 45) return 'D';
    if (percentage >= passingMarks) return 'P'; // Pass
    return 'F'; // Fail
}

/**
 * @desc    Get teacher profile
 * @route   GET /api/teacher/profile
 * @access  Teacher only
 */
exports.getTeacherProfile = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const teacher = await User.findById(teacherId).select('-password');
        
        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found'
            });
        }

        res.status(200).json({
            success: true,
            data: teacher
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
 * @desc    Update teacher profile
 * @route   PUT /api/teacher/profile
 * @access  Teacher only
 */
exports.updateTeacherProfile = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const { name, email, phone, address, qualifications } = req.body;

        const teacher = await User.findByIdAndUpdate(
            teacherId,
            { name, email, phone, address, qualifications },
            { new: true, runValidators: true }
        ).select('-password');

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: teacher
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
 * @route   PUT /api/teacher/password
 * @access  Teacher only
 */
exports.changePassword = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const { currentPassword, newPassword } = req.body;

        const teacher = await User.findById(teacherId);
        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher not found'
            });
        }

        // Check current password
        const isMatch = await teacher.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Update password
        teacher.password = newPassword;
        await teacher.save();

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
 * @desc    Get my classes
 * @route   GET /api/teacher/my-classes
 * @access  Teacher only
 */
exports.getMyClasses = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const schoolCode = req.user.schoolCode;

        const classes = {
            classes: [],
            totalClasses: 0
        };

        res.status(200).json({
            success: true,
            data: classes
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
 * @desc    Get my subjects
 * @route   GET /api/teacher/my-subjects
 * @access  Teacher only
 */
exports.getMySubjects = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const schoolCode = req.user.schoolCode;

        const subjects = {
            subjects: [],
            totalSubjects: 0
        };

        res.status(200).json({
            success: true,
            data: subjects
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
 * @route   GET /api/teacher/my-routine
 * @access  Teacher only
 */
exports.getMyRoutine = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const schoolCode = req.user.schoolCode;

        const routine = {
            weeklySchedule: [],
            totalClasses: 0
        };

        res.status(200).json({
            success: true,
            data: routine
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
 * @desc    Get my students
 * @route   GET /api/teacher/my-students
 * @access  Teacher only
 */
exports.getMyStudents = async (req, res) => {
    try {
        const teacherId = req.user.id;
        const schoolCode = req.user.schoolCode;

        const students = {
            students: [],
            totalStudents: 0
        };

        res.status(200).json({
            success: true,
            data: students
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};
