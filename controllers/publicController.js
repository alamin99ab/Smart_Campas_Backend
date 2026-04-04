/**
 * PUBLIC CONTROLLER
 * Public access for notices and results - No login required
 */

const Notice = require('../models/Notice');
const Result = require('../models/Result');
const Class = require('../models/Class');
const User = require('../models/User');
const School = require('../models/School');
const Student = require('../models/Student');

const normalizeSchoolCode = (code = '') => code.trim().toUpperCase();

const gradeFromPercentage = (percentage) => {
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
    if (percentage >= 33) return 'P';
    return 'F';
};

const formatNoticeForPublic = (notice) => ({
    id: notice._id,
    title: notice.title,
    description: notice.description,
    category: notice.noticeType,
    noticeType: notice.noticeType,
    publishDate: notice.publishDate,
    publishedAt: notice.publishedAt,
    expiryDate: notice.expiryDate,
    priority: notice.priority,
    isPinned: notice.isPinned,
    pinOrder: notice.pinOrder,
    attachments: (notice.attachments || [])
        .filter(att => att?.url)
        .map(att => ({
            name: att.originalName || att.filename,
            url: att.url,
            mimeType: att.mimeType,
            size: att.size
        }))
});

const formatResultSummary = (result) => ({
    id: result._id,
    examName: result.examName,
    session: result.academicYear,
    class: result.studentClass,
    section: result.section,
    roll: result.roll,
    publishDate: result.publishedAt || result.examDate,
    examDate: result.examDate,
    totalMarks: result.totalMarks,
    gpa: result.gpa
});

const formatResultDetail = (result) => ({
    id: result._id,
    examName: result.examName,
    session: result.academicYear,
    examDate: result.examDate,
    class: result.studentClass,
    section: result.section,
    roll: result.roll,
    subjects: (result.subjects || []).map(sub => ({
        subjectName: sub.subjectName,
        marks: sub.marks,
        grade: sub.grade
    })),
    totalMarks: result.totalMarks,
    gpa: result.gpa,
    remarks: result.remarks,
    publishedAt: result.publishedAt
});

const summarizeResults = (results) => {
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

    const percentage = maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : 0;

    return {
        totalExams: results.length,
        overallPercentage: percentage,
        totalMarksObtained: totalMarks,
        totalMaxMarks: maxMarks,
        grade: gradeFromPercentage(percentage)
    };
};

const validateSchool = async (schoolCode, res) => {
    if (!schoolCode) {
        res.status(400).json({
            success: false,
            message: 'schoolCode is required'
        });
        return null;
    }

    const normalizedCode = normalizeSchoolCode(schoolCode);
    const school = await School.findOne({ schoolCode: normalizedCode, isActive: true }).lean();

    if (!school) {
        res.status(404).json({
            success: false,
            message: 'School not found or inactive'
        });
        return null;
    }

    return { school, normalizedCode };
};

/**
 * @desc    Get public notices (no login required)
 * @route   GET /api/public/notices
 * @access  Public
 */
exports.getPublicNotices = async (req, res) => {
    try {
        const validation = await validateSchool(req.query.schoolCode, res);
        if (!validation) return;
        const { school, normalizedCode } = validation;

        const now = new Date();
        const page = Math.max(parseInt(req.query.page || '1', 10), 1);
        const isLatest = req.path.endsWith('/latest');
        const limit = Math.min(
            parseInt(req.query.limit || (isLatest ? '5' : '20'), 10),
            100
        );

        const query = {
            $and: [
                { $or: [{ schoolCode: normalizedCode }, { schoolId: school._id }] },
                { isDeleted: false },
                { status: 'active' },
                { isPublished: true },
                { publishDate: { $lte: now } },
                { $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }] }
            ]
        };

        if (req.query.priority) {
            query.priority = req.query.priority;
        }
        if (req.query.category || req.query.noticeType) {
            query.noticeType = req.query.category || req.query.noticeType;
        }

        const notices = await Notice.find(query)
            .sort({ isPinned: -1, pinOrder: 1, priority: -1, publishDate: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .select('title description noticeType publishDate publishedAt expiryDate priority isPinned pinOrder attachments')
            .lean();

        const total = await Notice.countDocuments(query);

        res.status(200).json({
            success: true,
            message: 'Data fetched successfully',
            data: notices.map(formatNoticeForPublic),
            pagination: {
                page,
                limit,
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
        const validation = await validateSchool(req.query.schoolCode, res);
        if (!validation) return;
        const { normalizedCode } = validation;

        const {
            class: className,
            section,
            exam,
            session,
            academicYear,
            rollNumber,
            studentId,
            page = 1,
            limit = 50
        } = req.query;

        // Student-specific lookup (secure path)
        if (rollNumber || studentId) {
            return handleStudentResultLookup({
                normalizedCode,
                rollNumber,
                studentId,
                className,
                section,
                exam,
                academicYear: academicYear || session,
                res
            });
        }

        const safeLimit = Math.min(parseInt(limit, 10) || 50, 200);
        const safePage = Math.max(parseInt(page, 10) || 1, 1);

        const query = {
            schoolCode: normalizedCode,
            isPublished: true,
            isActive: { $ne: false }
        };

        if (className) query.studentClass = className;
        if (section) query.section = section;
        if (academicYear || session) query.academicYear = academicYear || session;
        if (exam) query.examName = { $regex: exam, $options: 'i' };

        const results = await Result.find(query)
            .sort({ publishedAt: -1, examDate: -1 })
            .skip((safePage - 1) * safeLimit)
            .limit(safeLimit)
            .select('examName academicYear examDate studentClass section roll totalMarks gpa publishedAt isPublished schoolCode')
            .lean();

        const total = await Result.countDocuments(query);

        res.status(200).json({
            success: true,
            message: 'Data fetched successfully',
            data: results.map(formatResultSummary),
            pagination: {
                page: safePage,
                limit: safeLimit,
                total,
                pages: Math.ceil(total / safeLimit)
            }
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

const handleStudentResultLookup = async ({
    normalizedCode,
    rollNumber,
    studentId,
    className,
    section,
    exam,
    academicYear,
    res
}) => {
    try {
        const studentQuery = { schoolCode: normalizedCode, isActive: true };
        if (studentId) {
            studentQuery._id = studentId;
        } else if (rollNumber) {
            studentQuery.roll = rollNumber;
        }

        const student = await Student.findOne(studentQuery).lean();

        if (!student) {
            return res.status(404).json({
                success: false,
                message: 'Student not found for this school'
            });
        }

        const resultQuery = {
            schoolCode: normalizedCode,
            studentId: student._id,
            isPublished: true,
            isActive: { $ne: false }
        };

        if (className) resultQuery.studentClass = className;
        if (section) resultQuery.section = section;
        if (academicYear) resultQuery.academicYear = academicYear;
        if (exam) resultQuery.examName = { $regex: exam, $options: 'i' };

        const results = await Result.find(resultQuery)
            .sort({ examDate: -1 })
            .lean();

        return res.status(200).json({
            success: true,
            message: 'Data fetched successfully',
            data: {
                student: {
                    id: student._id,
                    name: student.name,
                    rollNumber: student.roll,
                    class: student.studentClass,
                    section: student.section
                },
                results: results.map(formatResultDetail),
                summary: summarizeResults(results)
            }
        });
    } catch (error) {
        console.error('Error in student result lookup:', error);
        return res.status(500).json({
            success: false,
            message: 'Error retrieving result',
            error: error.message
        });
    }
};

/**
 * @desc    Get result by roll number (student-specific)
 * @route   GET /api/public/result/:rollNumber
 * @access  Public
 */
exports.getResultByRollNumber = async (req, res) => {
    req.query.rollNumber = req.params.rollNumber;
    return exports.getPublicResults(req, res);
};

/**
 * @desc    Get public school info
 * @route   GET /api/public/school/:schoolCode
 * @access  Public
 */
exports.getSchoolInfo = async (req, res) => {
    try {
        const validation = await validateSchool(req.params.schoolCode, res);
        if (!validation) return;
        const { normalizedCode } = validation;

        const school = await School.findOne({ schoolCode: normalizedCode, isActive: true })
            .populate('principal', 'name email phone')
            .select('-__v')
            .lean();

        const classes = await Class.find({ schoolCode: normalizedCode, isActive: true })
            .select('className section classLevel capacity currentStudents')
            .sort({ classLevel: 1, className: 1, section: 1 })
            .lean();

        res.status(200).json({
            success: true,
            message: 'Data fetched successfully',
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
                    totalCapacity: classes.reduce((sum, cls) => sum + (cls.capacity || 0), 0),
                    totalStudents: classes.reduce((sum, cls) => sum + (cls.currentStudents || 0), 0)
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
        const validation = await validateSchool(req.params.schoolCode, res);
        if (!validation) return;
        const { normalizedCode, school } = validation;

        const now = new Date();
        const notices = await Notice.find({
            schoolCode: normalizedCode,
            isPublished: true,
            status: 'active',
            isDeleted: false,
            publishDate: { $lte: now },
            $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }]
        })
            .sort({ publishDate: -1 })
            .limit(5)
            .select('title description noticeType publishDate publishedAt priority')
            .lean();

        const recentResults = await Result.find({
            schoolCode: normalizedCode,
            isPublished: true,
            isActive: { $ne: false }
        })
            .sort({ publishedAt: -1, examDate: -1 })
            .limit(10)
            .select('examName academicYear examDate studentClass section roll totalMarks gpa publishedAt')
            .lean();

        const classes = await Class.find({ schoolCode: normalizedCode, isActive: true }).lean();
        const totalStudents = await User.countDocuments({
            schoolCode: normalizedCode,
            role: 'student',
            isActive: true
        });
        const totalTeachers = await User.countDocuments({
            schoolCode: normalizedCode,
            role: 'teacher',
            isActive: true
        });

        res.status(200).json({
            success: true,
            message: 'Data fetched successfully',
            data: {
                school: {
                    name: school.schoolName,
                    code: school.schoolCode
                },
                notices: notices.map(formatNoticeForPublic),
                recentResults: recentResults.map(formatResultSummary),
                statistics: {
                    totalClasses: classes.length,
                    totalStudents,
                    totalTeachers,
                    totalCapacity: classes.reduce((sum, cls) => sum + (cls.capacity || 0), 0)
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

/**
 * @desc    Get latest published notices (shortcut)
 * @route   GET /api/public/notices/latest
 * @access  Public
 */
exports.getLatestPublicNotices = async (req, res) => {
    req.query.limit = req.query.limit || 5;
    req.query.page = 1;
    return exports.getPublicNotices(req, res);
};
