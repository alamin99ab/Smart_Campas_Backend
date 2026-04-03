/**
 * 🌐 PUBLIC CONTROLLER
 * Public access for notices and results - No login required
 */

const Notice = require('../models/Notice');
const Result = require('../models/Result');
const Class = require('../models/Class');
const User = require('../models/User');

/**
 * @desc    Get public notices (no login required)
 * @route   GET /api/public/notices
 * @access  Public
 */
exports.getPublicNotices = async (req, res) => {
    try {
        const { schoolCode, page = 1, limit = 20, priority } = req.query;

        if (!schoolCode) {
            return res.status(400).json({
                success: false,
                message: 'School code is required'
            });
        }

        const normalizedCode = schoolCode.trim().toUpperCase();

        // Validate school
        const School = require('../models/School');
        const school = await School.findOne({ schoolCode: normalizedCode, isActive: true });
        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found or inactive'
            });
        }

        const now = new Date();
        const query = {
            $and: [
                {
                    $or: [
                        { schoolCode: normalizedCode },
                        { schoolId: school._id }
                    ]
                },
                { isDeleted: false },
                { status: 'active' },
                { publishDate: { $lte: now } },
                { $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }] }
            ]
        };

        if (priority) {
            query.priority = priority;
        }

        const notices = await Notice.find(query)
            .sort({ isPinned: -1, pinOrder: -1, priority: -1, publishDate: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .select('title description noticeType publishDate expiryDate priority isPinned pinOrder attachments');

        const total = await Notice.countDocuments(query);

        res.status(200).json({
            success: true,
            message: 'Notices fetched successfully',
            data: notices,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Error getting public notices:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving notices',
            error: error.message
        });
    }
};

/**
 * @desc    Get public results (no login required)
 * @route   GET /api/public/results
 * @access  Public
 */
exports.getPublicResults = async (req, res) => {
    try {
        const { schoolCode, class: className, section, exam, academicYear, rollNumber, studentId } = req.query;

        if (!schoolCode) {
            return res.status(400).json({
                success: false,
                message: 'School code is required'
            });
        }

        const normalizedCode = schoolCode.trim().toUpperCase();

        const School = require('../models/School');
        const school = await School.findOne({ schoolCode: normalizedCode, isActive: true });
        if (!school) {
            return res.status(404).json({ success: false, message: 'School not found or inactive' });
        }

        const query = {
            schoolCode: normalizedCode,
            isPublished: true,
            isActive: { $ne: false }
        };

        if (className) {
            query.studentClass = className;
        }
        if (section) {
            query.section = section;
        }
        if (academicYear) {
            query.academicYear = academicYear;
        }

        if (exam) {
            query.examName = { $regex: exam, $options: 'i' };
        }

        // Student-specific lookup
        if (rollNumber) {
            query.roll = rollNumber;
        }
        if (studentId) {
            query.studentId = studentId;
        }

        const results = await Result.find(query)
            .sort({ examDate: -1 })
            .select('examName examDate studentClass section roll subjects totalMarks gpa isPublished publishedAt studentId schoolCode');

        // Build public-friendly payload
        const summary = results.map(r => ({
            examName: r.examName,
            examDate: r.examDate,
            class: r.studentClass,
            section: r.section,
            roll: r.roll,
            publishedAt: r.publishedAt,
            totalMarks: r.totalMarks,
            gpa: r.gpa
        }));

        res.status(200).json({
            success: true,
            message: 'Results fetched successfully',
            data: summary,
            total: results.length
        });

    } catch (error) {
        console.error('Error getting public results:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving results',
            error: error.message
        });
    }
};

/**
 * @desc    Get result by roll number (no login required)
 * @route   GET /api/public/result/:rollNumber
 * @access  Public
 */
exports.getResultByRollNumber = async (req, res) => {
    try {
        const { rollNumber } = req.params;
        const { schoolCode, examType, exam, academicYear, studentId } = req.query;

        if (!schoolCode) {
            return res.status(400).json({
                success: false,
                message: 'School code is required'
            });
        }

        const normalizedCode = schoolCode.trim().toUpperCase();

        // Find student by roll number
        const student = await User.findOne({
            schoolCode: normalizedCode,
            role: 'student',
            rollNumber: rollNumber,
            isActive: true
        });

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found with this roll number'
            });
        }

        // Get student's results
        const query = {
            schoolCode: normalizedCode,
            studentId: studentId || student._id,
            isActive: true,
            isPublished: true
        };

        if (examType) {
            query.examType = examType;
        }
        if (exam) query.examName = { $regex: exam, $options: 'i' };
        if (academicYear) query.academicYear = academicYear;

        const results = await Result.find(query)
            .sort({ examDate: -1 })
            .select('examName examDate studentClass section roll subjects totalMarks gpa isPublished publishedAt');

        // Calculate overall performance (aggregate on subjects array if present)
        let totalMarks = 0;
        let maxMarks = 0;
        results.forEach(r => {
            if (Array.isArray(r.subjects) && r.subjects.length) {
                r.subjects.forEach(s => {
                    totalMarks += s.marks || s.marksObtained || 0;
                    maxMarks += s.totalMarks || 100;
                });
            } else {
                totalMarks += r.totalMarks || 0;
                maxMarks += r.totalMarks || 0;
            }
        });
        const overallPercentage = maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : 0;

        res.status(200).json({
            success: true,
            data: {
                student: {
                    name: student.name,
                    rollNumber: student.rollNumber,
                    class: student.classId
                },
                results,
                summary: {
                    totalExams: results.length,
                    overallPercentage,
                    totalMarksObtained: totalMarks,
                    totalMaxMarks: maxMarks,
                    grade: calculateGrade(overallPercentage)
                }
            }
        });

    } catch (error) {
        console.error('Error getting result by roll number:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving result',
            error: error.message
        });
    }
};

/**
 * @desc    Get public school info
 * @route   GET /api/public/school/:schoolCode
 * @access  Public
 */
exports.getSchoolInfo = async (req, res) => {
    try {
        const { schoolCode } = req.params;

        const School = require('../models/School');
        const school = await School.findOne({ schoolCode, isActive: true })
            .populate('principal', 'name email phone')
            .select('-__v')
            .lean();

        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        // Get class information
        const classes = await Class.find({ schoolCode, isActive: true })
            .select('className section classLevel capacity currentStudents')
            .sort({ classLevel: 1, className: 1, section: 1 });

        res.status(200).json({
            success: true,
            data: {
                school: {
                    name: school.schoolName,
                    code: school.schoolCode,
                    address: school.address,
                    phone: school.phone,
                    email: school.email,
                    principal: school.principal
                },
                classes,
                summary: {
                    totalClasses: classes.length,
                    totalCapacity: classes.reduce((sum, cls) => sum + cls.capacity, 0),
                    totalStudents: classes.reduce((sum, cls) => sum + cls.currentStudents, 0)
                }
            }
        });

    } catch (error) {
        console.error('Error getting school info:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving school information',
            error: error.message
        });
    }
};

/**
 * @desc    Get public dashboard (no login required)
 * @route   GET /api/public/dashboard/:schoolCode
 * @access  Public
 */
exports.getPublicDashboard = async (req, res) => {
    try {
        const { schoolCode } = req.params;

        // Get school information
        const School = require('../models/School');
        const school = await School.findOne({ schoolCode, isActive: true });

        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        // Get recent notices
        const notices = await Notice.find({
            schoolCode,
            targetAudience: { $in: ['student', 'all', 'public'] },
            isActive: true
        })
        .sort({ createdAt: -1 })
        .limit(5)
        .select('title content priority createdAt authorName');

        // Get recent results
        const recentResults = await Result.find({
            schoolCode,
            isActive: true
        })
        .populate('studentId', 'name rollNumber')
        .populate('subjectId', 'subjectName')
        .sort({ examDate: -1 })
        .limit(10);

        // Get class statistics
        const classes = await Class.find({ schoolCode, isActive: true });
        const totalStudents = await User.countDocuments({
            schoolCode,
            role: 'student',
            isActive: true
        });
        const totalTeachers = await User.countDocuments({
            schoolCode,
            role: 'teacher',
            isActive: true
        });

        res.status(200).json({
            success: true,
            data: {
                school: {
                    name: school.schoolName,
                    code: school.schoolCode
                },
                notices,
                recentResults: recentResults.slice(0, 5),
                statistics: {
                    totalClasses: classes.length,
                    totalStudents,
                    totalTeachers,
                    totalCapacity: classes.reduce((sum, cls) => sum + cls.capacity, 0)
                }
            }
        });

    } catch (error) {
        console.error('Error getting public dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving public dashboard',
            error: error.message
        });
    }
};

// Helper function to calculate grade from percentage
function calculateGrade(percentage) {
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
    if (percentage >= 33) return 'P'; // Pass
    return 'F'; // Fail
}

/**
 * @desc    Get latest published notices (shortcut)
 * @route   GET /api/public/notices/latest
 * @access  Public
 */
exports.getLatestPublicNotices = async (req, res) => {
    req.query.limit = req.query.limit || 5;
    return exports.getPublicNotices(req, res);
};
