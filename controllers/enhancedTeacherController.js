/**
 * 👨‍🏫 ENHANCED TEACHER CONTROLLER
 * Industry-level enhanced teacher controller with additional features
 */

const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
const User = require('../models/User');
const Notice = require('../models/Notice');
const Result = require('../models/Result');
const Attendance = require('../models/Attendance');
const Assignment = require('../models/Assignment');
const Exam = require('../models/Exam');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Routine = require('../models/Routine');
const mongoose = require('mongoose');

// @desc    Get Enhanced Teacher Dashboard
// @route   GET /api/teacher/enhanced-dashboard
// @access  Private (Teacher)
exports.getEnhancedDashboard = async (req, res) => {
    try {
        const teacher = await Teacher.findOne({ userId: req.user.id })
            .populate('assignedClasses.classId')
            .populate('assignedSubjects.subjectId');

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher profile not found'
            });
        }

        // Get today's classes
        const today = new Date();
        const dayName = today.toLocaleDateString('en-US', { weekday: 'long' });
        
        const todayClasses = await Routine.aggregate([
            {
                $match: {
                    schoolCode: req.user.schoolCode,
                    'schedule.day': dayName
                }
            },
            { $unwind: '$schedule' },
            { $match: { 'schedule.day': dayName } },
            { $unwind: '$schedule.periods' },
            {
                $match: {
                    'schedule.periods.teacherId': teacher._id
                }
            },
            {
                $lookup: {
                    from: 'subjects',
                    localField: 'schedule.periods.subjectId',
                    foreignField: '_id',
                    as: 'subject'
                }
            },
            {
                $lookup: {
                    from: 'classes',
                    localField: 'classId',
                    foreignField: '_id',
                    as: 'class'
                }
            },
            { $sort: { 'schedule.periods.startTime': 1 } }
        ]);

        // Get pending assignments to grade
        const pendingAssignments = await Assignment.find({
            teacherId: teacher._id,
            schoolCode: req.user.schoolCode,
            'submissions.graded': { $ne: true }
        })
        .populate('classId')
        .populate('subjectId')
        .sort({ dueDate: -1 })
        .limit(5);

        // Get recent attendance
        const recentAttendance = await Attendance.find({
            teacherId: teacher._id,
            schoolCode: req.user.schoolCode,
            date: { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) }
        })
        .populate('classId')
        .populate('subjectId')
        .sort({ date: -1 })
        .limit(5);

        // Get student count in assigned classes
        const classIds = teacher.assignedClasses.map(c => c.classId._id);
        const totalStudents = await Student.countDocuments({
            classId: { $in: classIds },
            schoolCode: req.user.schoolCode,
            isActive: true
        });

        // Get upcoming exams
        const upcomingExams = await Exam.find({
            classId: { $in: classIds },
            schoolCode: req.user.schoolCode,
            examDate: { $gte: today },
            examDate: { $lte: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000) }
        })
        .populate('classId')
        .populate('subjectId')
        .sort({ examDate: 1 })
        .limit(5);

        // Get notices created by teacher
        const recentNotices = await Notice.find({
            createdBy: req.user.id,
            schoolCode: req.user.schoolCode
        })
        .sort({ createdAt: -1 })
        .limit(3);

        res.status(200).json({
            success: true,
            data: {
                teacher: {
                    name: teacher.name,
                    email: teacher.email,
                    employeeId: teacher.employeeId,
                    department: teacher.department,
                    subjects: teacher.assignedSubjects,
                    classes: teacher.assignedClasses
                },
                schedule: {
                    today: todayClasses,
                    totalClasses: todayClasses.length
                },
                academics: {
                    totalStudents,
                    pendingAssignments: pendingAssignments.length,
                    upcomingExams: upcomingExams.length
                },
                recent: {
                    assignments: pendingAssignments,
                    attendance: recentAttendance,
                    notices: recentNotices
                }
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching dashboard data'
        });
    }
};

// @desc    Create Assignment
// @route   POST /api/teacher/assignments
// @access  Private (Teacher)
exports.createAssignment = async (req, res) => {
    try {
        const teacher = await Teacher.findOne({ userId: req.user.id });
        
        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher profile not found'
            });
        }

        const {
            title,
            description,
            classId,
            subjectId,
            dueDate,
            maxMarks,
            attachments,
            instructions
        } = req.body;

        // Verify teacher is assigned to this class and subject
        const isAssigned = teacher.assignedClasses.some(
            c => c.classId.toString() === classId
        ) && teacher.assignedSubjects.some(
            s => s.subjectId.toString() === subjectId
        );

        if (!isAssigned) {
            return res.status(403).json({
                success: false,
                message: 'You are not assigned to this class or subject'
            });
        }

        const assignment = await Assignment.create({
            title,
            description,
            classId,
            subjectId,
            teacherId: teacher._id,
            dueDate: new Date(dueDate),
            maxMarks,
            attachments: attachments || [],
            instructions,
            schoolCode: req.user.schoolCode
        });

        // Populate for response
        await assignment.populate('classId');
        await assignment.populate('subjectId');

        res.status(201).json({
            success: true,
            message: 'Assignment created successfully',
            data: assignment
        });
    } catch (error) {
        console.error('Create assignment error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating assignment'
        });
    }
};

// @desc    Get Teacher Assignments
// @route   GET /api/teacher/assignments
// @access  Private (Teacher)
exports.getAssignments = async (req, res) => {
    try {
        const teacher = await Teacher.findOne({ userId: req.user.id });
        
        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher profile not found'
            });
        }

        const { status, classId, page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        let query = {
            teacherId: teacher._id,
            schoolCode: req.user.schoolCode
        };

        if (classId) {
            query.classId = classId;
        }

        if (status === 'active') {
            query.dueDate = { $gte: new Date() };
        } else if (status === 'expired') {
            query.dueDate = { $lt: new Date() };
        }

        const assignments = await Assignment.find(query)
            .populate('classId')
            .populate('subjectId')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Assignment.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                assignments,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get assignments error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching assignments'
        });
    }
};

// @desc    Grade Assignment
// @route   PUT /api/teacher/assignments/:id/grade
// @access  Private (Teacher)
exports.gradeAssignment = async (req, res) => {
    try {
        const teacher = await Teacher.findOne({ userId: req.user.id });
        const { submissionId, marks, feedback } = req.body;

        const assignment = await Assignment.findById(req.params.id);
        
        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }

        if (assignment.teacherId.toString() !== teacher._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to grade this assignment'
            });
        }

        // Find and update the submission
        const submission = assignment.submissions.id(submissionId);
        if (!submission) {
            return res.status(404).json({
                success: false,
                message: 'Submission not found'
            });
        }

        submission.marks = marks;
        submission.feedback = feedback;
        submission.graded = true;
        submission.gradedAt = new Date();
        submission.gradedBy = teacher._id;

        await assignment.save();

        res.status(200).json({
            success: true,
            message: 'Assignment graded successfully',
            data: assignment
        });
    } catch (error) {
        console.error('Grade assignment error:', error);
        res.status(500).json({
            success: false,
            message: 'Error grading assignment'
        });
    }
};

// @desc    Create Exam
// @route   POST /api/teacher/exams
// @access  Private (Teacher)
exports.createExam = async (req, res) => {
    try {
        const teacher = await Teacher.findOne({ userId: req.user.id });
        
        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher profile not found'
            });
        }

        const {
            title,
            description,
            classId,
            subjectId,
            examDate,
            duration,
            totalMarks,
            passingMarks,
            examType,
            instructions
        } = req.body;

        // Verify teacher is assigned to this class and subject
        const isAssigned = teacher.assignedClasses.some(
            c => c.classId.toString() === classId
        ) && teacher.assignedSubjects.some(
            s => s.subjectId.toString() === subjectId
        );

        if (!isAssigned) {
            return res.status(403).json({
                success: false,
                message: 'You are not assigned to this class or subject'
            });
        }

        const exam = await Exam.create({
            title,
            description,
            classId,
            subjectId,
            teacherId: teacher._id,
            examDate: new Date(examDate),
            duration,
            totalMarks,
            passingMarks,
            examType,
            instructions,
            schoolCode: req.user.schoolCode
        });

        await exam.populate('classId');
        await exam.populate('subjectId');

        res.status(201).json({
            success: true,
            message: 'Exam created successfully',
            data: exam
        });
    } catch (error) {
        console.error('Create exam error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating exam'
        });
    }
};

// @desc    Get Teacher Students
// @route   GET /api/teacher/students/:classId
// @access  Private (Teacher)
exports.getClassStudents = async (req, res) => {
    try {
        const teacher = await Teacher.findOne({ userId: req.user.id });
        const { classId } = req.params;
        const { page = 1, limit = 50, search } = req.query;
        const skip = (page - 1) * limit;

        // Verify teacher is assigned to this class
        const isAssigned = teacher.assignedClasses.some(
            c => c.classId.toString() === classId
        );

        if (!isAssigned) {
            return res.status(403).json({
                success: false,
                message: 'You are not assigned to this class'
            });
        }

        let query = {
            classId,
            schoolCode: req.user.schoolCode,
            isActive: true
        };

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { rollNumber: { $regex: search, $options: 'i' } }
            ];
        }

        const students = await Student.find(query)
            .populate('userId', 'email phone')
            .sort({ rollNumber: 1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Student.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                students,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching students'
        });
    }
};

// @desc    Get Teacher Performance Analytics
// @route   GET /api/teacher/analytics
// @access  Private (Teacher)
exports.getAnalytics = async (req, res) => {
    try {
        const teacher = await Teacher.findOne({ userId: req.user.id })
            .populate('assignedClasses.classId')
            .populate('assignedSubjects.subjectId');

        if (!teacher) {
            return res.status(404).json({
                success: false,
                message: 'Teacher profile not found'
            });
        }

        const classIds = teacher.assignedClasses.map(c => c.classId._id);

        // Get attendance analytics
        const attendanceStats = await Attendance.aggregate([
            {
                $match: {
                    teacherId: teacher._id,
                    schoolCode: req.user.schoolCode,
                    date: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 1)) }
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Get assignment completion stats
        const assignmentStats = await Assignment.aggregate([
            {
                $match: {
                    teacherId: teacher._id,
                    schoolCode: req.user.schoolCode,
                    dueDate: { $lt: new Date() }
                }
            },
            {
                $project: {
                    totalSubmissions: { $size: '$submissions' },
                    gradedSubmissions: {
                        $size: {
                            $filter: {
                                input: '$submissions',
                                cond: { $eq: ['$$this.graded', true] }
                            }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalAssignments: { $sum: 1 },
                    totalSubmissions: { $sum: '$totalSubmissions' },
                    totalGraded: { $sum: '$gradedSubmissions' }
                }
            }
        ]);

        // Get result analytics
        const resultStats = await Result.aggregate([
            {
                $match: {
                    schoolCode: req.user.schoolCode,
                    classId: { $in: classIds },
                    createdAt: { $gte: new Date(new Date().setMonth(new Date().getMonth() - 3)) }
                }
            },
            {
                $group: {
                    _id: '$grade',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                attendance: attendanceStats,
                assignments: assignmentStats[0] || { totalAssignments: 0, totalSubmissions: 0, totalGraded: 0 },
                results: resultStats,
                summary: {
                    totalClasses: teacher.assignedClasses.length,
                    totalSubjects: teacher.assignedSubjects.length,
                    totalStudents: await Student.countDocuments({
                        classId: { $in: classIds },
                        schoolCode: req.user.schoolCode,
                        isActive: true
                    })
                }
            }
        });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching analytics'
        });
    }
};

module.exports = {
    getEnhancedDashboard,
    createAssignment,
    getAssignments,
    gradeAssignment,
    createExam,
    getClassStudents,
    getAnalytics
};
