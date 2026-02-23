/**
 * 🎓 ENHANCED STUDENT CONTROLLER
 * Industry-level enhanced student controller with additional features
 */

const Student = require('../models/Student');
const User = require('../models/User');
const Notice = require('../models/Notice');
const Result = require('../models/Result');
const Attendance = require('../models/Attendance');
const Routine = require('../models/Routine');
const Assignment = require('../models/Assignment');
const Fee = require('../models/Fee');
const Exam = require('../models/Exam');
const Library = require('../models/Library');
const Event = require('../models/Event');
const mongoose = require('mongoose');

// @desc    Get Enhanced Student Dashboard
// @route   GET /api/student/enhanced-dashboard
// @access  Private (Student)
exports.getEnhancedDashboard = async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.user.id })
            .populate('classId')
            .populate('sectionId');

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student profile not found'
            });
        }

        // Get recent notices
        const recentNotices = await Notice.find({
            targetAudience: { $in: ['student', 'all'] },
            schoolCode: req.user.schoolCode,
            isActive: true
        })
        .sort({ createdAt: -1 })
        .limit(5);

        // Get recent results
        const recentResults = await Result.find({
            studentId: student._id,
            schoolCode: req.user.schoolCode
        })
        .populate('subjectId')
        .sort({ createdAt: -1 })
        .limit(5);

        // Get attendance summary
        const attendanceSummary = await Attendance.aggregate([
            {
                $match: {
                    studentId: student._id,
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

        // Get pending assignments
        const pendingAssignments = await Assignment.find({
            classId: student.classId,
            schoolCode: req.user.schoolCode,
            dueDate: { $gt: new Date() },
            submissions: { $not: { $elemMatch: { studentId: student._id } } }
        })
        .populate('subjectId')
        .sort({ dueDate: 1 })
        .limit(5);

        // Get fee status
        const feeStatus = await Fee.findOne({
            studentId: student._id,
            schoolCode: req.user.schoolCode,
            status: 'pending'
        });

        // Get upcoming events
        const upcomingEvents = await Event.find({
            schoolCode: req.user.schoolCode,
            targetAudience: { $in: ['student', 'all'] },
            eventDate: { $gte: new Date() }
        })
        .sort({ eventDate: 1 })
        .limit(3);

        // Get library books issued
        const libraryBooks = await Library.find({
            studentId: student._id,
            schoolCode: req.user.schoolCode,
            returnDate: { $gte: new Date() }
        });

        const attendanceStats = {
            total: attendanceSummary.reduce((acc, curr) => acc + curr.count, 0),
            present: attendanceSummary.find(item => item._id === 'Present')?.count || 0,
            absent: attendanceSummary.find(item => item._id === 'Absent')?.count || 0,
            late: attendanceSummary.find(item => item._id === 'Late')?.count || 0
        };

        res.status(200).json({
            success: true,
            data: {
                student: {
                    name: student.name,
                    rollNumber: student.rollNumber,
                    class: student.classId?.name,
                    section: student.sectionId?.name,
                    profileImage: student.profileImage
                },
                academics: {
                    recentResults,
                    attendance: attendanceStats,
                    pendingAssignments: pendingAssignments.length
                },
                notices: recentNotices,
                fees: {
                    pending: feeStatus ? feeStatus.amount : 0,
                    dueDate: feeStatus?.dueDate
                },
                events: upcomingEvents,
                library: {
                    booksIssued: libraryBooks.length
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

// @desc    Get Student Assignments
// @route   GET /api/student/assignments
// @access  Private (Student)
exports.getAssignments = async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.user.id });
        
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student profile not found'
            });
        }

        const { status, page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        let query = {
            classId: student.classId,
            schoolCode: req.user.schoolCode
        };

        if (status === 'pending') {
            query.dueDate = { $gt: new Date() };
            query['submissions.studentId'] = { $ne: student._id };
        } else if (status === 'submitted') {
            query['submissions.studentId'] = student._id;
        } else if (status === 'overdue') {
            query.dueDate = { $lt: new Date() };
            query['submissions.studentId'] = { $ne: student._id };
        }

        const assignments = await Assignment.find(query)
            .populate('subjectId')
            .populate('teacherId')
            .sort({ dueDate: status === 'overdue' ? 1 : -1 })
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
        console.error('Assignments error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching assignments'
        });
    }
};

// @desc    Submit Assignment
// @route   POST /api/student/assignments/:id/submit
// @access  Private (Student)
exports.submitAssignment = async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.user.id });
        const { content, attachments } = req.body;

        const assignment = await Assignment.findById(req.params.id);
        
        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }

        if (assignment.dueDate < new Date()) {
            return res.status(400).json({
                success: false,
                message: 'Assignment submission deadline has passed'
            });
        }

        // Check if already submitted
        const existingSubmission = assignment.submissions.find(
            sub => sub.studentId.toString() === student._id.toString()
        );

        if (existingSubmission) {
            existingSubmission.content = content;
            existingSubmission.attachments = attachments;
            existingSubmission.submittedAt = new Date();
        } else {
            assignment.submissions.push({
                studentId: student._id,
                content,
                attachments,
                submittedAt: new Date()
            });
        }

        await assignment.save();

        res.status(200).json({
            success: true,
            message: 'Assignment submitted successfully',
            data: assignment
        });
    } catch (error) {
        console.error('Submit assignment error:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting assignment'
        });
    }
};

// @desc    Get Student Fees
// @route   GET /api/student/fees
// @access  Private (Student)
exports.getFees = async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.user.id });
        
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student profile not found'
            });
        }

        const { status, page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        let query = {
            studentId: student._id,
            schoolCode: req.user.schoolCode
        };

        if (status) {
            query.status = status;
        }

        const fees = await Fee.find(query)
            .sort({ dueDate: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Fee.countDocuments(query);

        // Calculate summary
        const summary = await Fee.aggregate([
            { $match: { studentId: student._id, schoolCode: req.user.schoolCode } },
            {
                $group: {
                    _id: '$status',
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                fees,
                summary,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Fees error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching fees'
        });
    }
};

// @desc    Get Student Library Books
// @route   GET /api/student/library
// @access  Private (Student)
exports.getLibraryBooks = async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.user.id });
        
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student profile not found'
            });
        }

        const { status, page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        let query = {
            studentId: student._id,
            schoolCode: req.user.schoolCode
        };

        if (status === 'current') {
            query.returnDate = { $gte: new Date() };
        } else if (status === 'returned') {
            query.returnDate = { $lt: new Date() };
        }

        const books = await Library.find(query)
            .populate('bookId')
            .sort({ issuedDate: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Library.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                books,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Library error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching library books'
        });
    }
};

// @desc    Get Student Exams
// @route   GET /api/student/exams
// @access  Private (Student)
exports.getExams = async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.user.id })
            .populate('classId');

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student profile not found'
            });
        }

        const { status, page = 1, limit = 10 } = req.query;
        const skip = (page - 1) * limit;

        let query = {
            classId: student.classId._id,
            schoolCode: req.user.schoolCode
        };

        if (status === 'upcoming') {
            query.examDate = { $gte: new Date() };
        } else if (status === 'completed') {
            query.examDate = { $lt: new Date() };
        }

        const exams = await Exam.find(query)
            .populate('subjectId')
            .sort({ examDate: status === 'upcoming' ? 1 : -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Exam.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                exams,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        console.error('Exams error:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching exams'
        });
    }
};

// @desc    Update Student Profile
// @route   PUT /api/student/profile
// @access  Private (Student)
exports.updateProfile = async (req, res) => {
    try {
        const student = await Student.findOne({ userId: req.user.id });
        
        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student profile not found'
            });
        }

        const allowedUpdates = ['phone', 'address', 'dateOfBirth', 'bloodGroup', 'parentInfo'];
        const updates = {};
        
        allowedUpdates.forEach(field => {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        });

        // Handle profile image upload
        if (req.file) {
            updates.profileImage = req.file.path;
        }

        const updatedStudent = await Student.findByIdAndUpdate(
            student._id,
            { $set: updates },
            { new: true, runValidators: true }
        );

        // Update user info as well
        if (updates.phone) {
            await User.findByIdAndUpdate(
                req.user.id,
                { $set: { phone: updates.phone } }
            );
        }

        res.status(200).json({
            success: true,
            message: 'Profile updated successfully',
            data: updatedStudent
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating profile'
        });
    }
};

module.exports = {
    getEnhancedDashboard,
    getAssignments,
    submitAssignment,
    getFees,
    getLibraryBooks,
    getExams,
    updateProfile
};
