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
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PUBLIC_RESULT_SELECT =
    'examName academicYear examDate studentClass section roll subjects totalMarks gpa publishedAt isPublished schoolCode';

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

const parsePublicResultLookupInput = (query = {}) => {
    const className = String(query.class || query.studentClass || '').trim();
    const rollRaw = String(query.roll || query.rollNumber || '').trim();
    const section = query.section ? String(query.section).trim() : null;
    const examName = query.exam ? String(query.exam).trim() : (query.examName ? String(query.examName).trim() : null);
    const academicYear = query.academicYear ? String(query.academicYear).trim() : (query.session ? String(query.session).trim() : null);

    if (!className) {
        return { ok: false, status: 400, code: 'CLASS_REQUIRED', message: 'class is required' };
    }

    if (className.length > 80) {
        return { ok: false, status: 400, code: 'CLASS_INVALID', message: 'class is too long' };
    }

    const roll = Number(rollRaw);
    if (!rollRaw || !Number.isInteger(roll) || roll <= 0 || roll > 1000000) {
        return { ok: false, status: 400, code: 'ROLL_INVALID', message: 'roll must be a positive integer' };
    }

    if (section && section.length > 20) {
        return { ok: false, status: 400, code: 'SECTION_INVALID', message: 'section is too long' };
    }

    if (examName && examName.length > 120) {
        return { ok: false, status: 400, code: 'EXAM_INVALID', message: 'exam is too long' };
    }

    if (academicYear && academicYear.length > 40) {
        return { ok: false, status: 400, code: 'ACADEMIC_YEAR_INVALID', message: 'academicYear is too long' };
    }

    return {
        ok: true,
        data: { className, roll, section, examName, academicYear }
    };
};

const buildPublishedResultLookupQuery = ({ normalizedCode, className, roll, section, examName, academicYear }) => {
    const query = {
        schoolCode: normalizedCode,
        studentClass: className,
        roll,
        isPublished: true,
        isActive: { $ne: false }
    };

    if (section) query.section = section;
    if (examName) query.examName = { $regex: new RegExp(`^${escapeRegex(examName)}$`, 'i') };
    if (academicYear) query.academicYear = academicYear;

    return query;
};

/**
 * @desc    Get public notices (no login required)
 * @route   GET /api/public/notices
 * @access  Public
 */
exports.getPublicNotices = async (req, res) => {
    try {
        const schoolCode = req.params.schoolCode || req.query.schoolCode;
        const validation = await validateSchool(schoolCode, res);
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
                { isPublic: true },
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
 * @desc    Get a single public notice by ID
 * @route   GET /api/public/:schoolCode/notices/:id
 * @access  Public
 */
exports.getPublicNoticeById = async (req, res) => {
    try {
        const schoolCode = req.params.schoolCode || req.query.schoolCode;
        const validation = await validateSchool(schoolCode, res);
        if (!validation) return;
        const { normalizedCode, school } = validation;

        const notice = await Notice.findOne({
            $and: [
                { _id: req.params.id },
                { $or: [{ schoolCode: normalizedCode }, { schoolId: school._id }] },
                { isDeleted: false },
                { status: 'active' },
                { isPublished: true },
                { isPublic: true },
                { publishDate: { $lte: new Date() } },
                { $or: [{ expiryDate: null }, { expiryDate: { $gt: new Date() } }] }
            ]
        }).lean();

        if (!notice) {
            return res.status(404).json({
                success: false,
                message: 'Notice not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Data fetched successfully',
            data: formatNoticeForPublic(notice)
        });
    } catch (error) {
        console.error('Error getting public notice by id:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving notice',
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
        const schoolCode = req.params.schoolCode || req.query.schoolCode;
        const validation = await validateSchool(schoolCode, res);
        if (!validation) return;
        const { normalizedCode } = validation;
        const parsed = parsePublicResultLookupInput(req.query);
        if (!parsed.ok) {
            return res.status(parsed.status).json({
                success: false,
                code: parsed.code,
                message: parsed.message
            });
        }

        const { className, roll, section, examName, academicYear } = parsed.data;
        const query = buildPublishedResultLookupQuery({
            normalizedCode,
            className,
            roll,
            section,
            examName,
            academicYear
        });

        const results = await Result.find(query)
            .sort({ publishedAt: -1, examDate: -1 })
            .select(PUBLIC_RESULT_SELECT)
            .lean();

        if (!results.length) {
            return res.status(404).json({
                success: false,
                code: 'RESULT_NOT_FOUND',
                message: 'No published result found for this class and roll'
            });
        }

        const safeResults = results.map((result) => ({
            examName: result.examName,
            academicYear: result.academicYear,
            examDate: result.examDate,
            publishedAt: result.publishedAt,
            class: result.studentClass,
            section: result.section || null,
            roll: result.roll,
            subjects: (result.subjects || []).map((subject) => ({
                subjectName: subject.subjectName,
                marks: subject.marks,
                grade: subject.grade
            })),
            totalMarks: result.totalMarks,
            gpa: result.gpa
        }));

        return res.status(200).json({
            success: true,
            code: 'PUBLIC_RESULTS_FOUND',
            message: 'Published result fetched successfully',
            data: {
                schoolCode: normalizedCode,
                lookup: {
                    class: className,
                    roll,
                    section: section || null
                },
                totalResults: safeResults.length,
                results: safeResults
            }
        });
    } catch (error) {
        console.error('Error searching public result:', error);
        res.status(500).json({
            success: false,
            code: 'PUBLIC_RESULT_SEARCH_FAILED',
            message: 'Error retrieving result',
            error: error.message
        });
    }
};

/**
 * @desc    Search public published result by school/class/roll
 * @route   GET /api/public/:schoolCode/results/search
 * @access  Public
 */
exports.searchPublicResults = async (req, res) => {
    return exports.getPublicResults(req, res);
};

/**
 * @desc    Get result by roll number (student-specific)
 * @route   GET /api/public/result/:rollNumber
 * @access  Public
 */
exports.getResultByRollNumber = async (req, res) => {
    try {
        const schoolCode = req.params.schoolCode || req.query.schoolCode;
        const validation = await validateSchool(schoolCode, res);
        if (!validation) return;
        const { normalizedCode } = validation;

        const roll = Number(String(req.params.rollNumber || req.query.roll || '').trim());
        if (!Number.isInteger(roll) || roll <= 0 || roll > 1000000) {
            return res.status(400).json({
                success: false,
                code: 'ROLL_INVALID',
                message: 'rollNumber must be a positive integer'
            });
        }

        const className = String(req.query.class || req.query.studentClass || '').trim();
        const section = String(req.query.section || '').trim();
        const examName = String(req.query.exam || req.query.examName || '').trim();
        const academicYear = String(req.query.academicYear || req.query.session || '').trim();

        const query = {
            schoolCode: normalizedCode,
            roll,
            isPublished: true,
            isActive: { $ne: false }
        };

        if (className) query.studentClass = className;
        if (section) query.section = section;
        if (examName) query.examName = { $regex: new RegExp(`^${escapeRegex(examName)}$`, 'i') };
        if (academicYear) query.academicYear = academicYear;

        const results = await Result.find(query)
            .sort({ publishedAt: -1, examDate: -1 })
            .select(PUBLIC_RESULT_SELECT)
            .lean();

        if (!results.length) {
            return res.status(404).json({
                success: false,
                code: 'RESULT_NOT_FOUND',
                message: 'No published result found for this roll number'
            });
        }

        const safeResults = results.map((result) => ({
            examName: result.examName,
            academicYear: result.academicYear,
            examDate: result.examDate,
            publishedAt: result.publishedAt,
            class: result.studentClass,
            section: result.section || null,
            roll: result.roll,
            subjects: (result.subjects || []).map((subject) => ({
                subjectName: subject.subjectName,
                marks: subject.marks,
                grade: subject.grade
            })),
            totalMarks: result.totalMarks,
            gpa: result.gpa
        }));

        return res.status(200).json({
            success: true,
            code: 'PUBLIC_RESULT_BY_ROLL_FOUND',
            message: 'Published result fetched successfully',
            data: {
                schoolCode: normalizedCode,
                lookup: {
                    roll,
                    class: className || null,
                    section: section || null
                },
                totalResults: safeResults.length,
                results: safeResults
            }
        });
    } catch (error) {
        console.error('Error fetching public result by roll number:', error);
        return res.status(500).json({
            success: false,
            code: 'PUBLIC_RESULT_BY_ROLL_FAILED',
            message: 'Error retrieving result by roll number',
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
            isPublic: true,
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
