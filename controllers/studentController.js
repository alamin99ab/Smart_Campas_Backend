/**
 * 🎓 STUDENT CONTROLLER
 * Industry-level Student management for Smart Campus System
 * Students can only view notices and check their results
 */

const mongoose = require('mongoose');

// MongoDB Models
const User = require('../models/User');
const Class = require('../models/Class');
const Notice = require('../models/Notice');
const Result = require('../models/Result');
const Attendance = require('../models/Attendance');
const Routine = require('../models/Routine');
const ClassRoutine = require('../models/ClassRoutine');
const Assignment = require('../models/Assignment');
const Subject = require('../models/Subject');
const AdvancedAttendance = require('../models/AdvancedAttendance');
const { resolveStudentObjectIdFromUser } = require('../utils/resolveStudentFromUser');

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_INDEX = DAY_NAMES.reduce((acc, day, index) => {
    acc[day.toLowerCase()] = index;
    return acc;
}, {});

const normalizeDayName = (value) => {
    if (typeof value === 'number' && value >= 0 && value < DAY_NAMES.length) {
        return DAY_NAMES[value];
    }

    if (!value) return null;
    const key = String(value).trim().toLowerCase();
    if (!key) return null;
    return DAY_NAMES[DAY_INDEX[key]] || null;
};

const getCurrentDayName = () => DAY_NAMES[new Date().getDay()];

const normalizeRoutinePeriod = (period, index) => {
    const periodNumber = period?.periodNumber ?? period?.period ?? (index + 1);
    const subjectName = period?.subjectName
        || period?.subject
        || period?.subjectId?.subjectName
        || period?.subjectId?.name
        || null;
    const subjectCode = period?.subjectCode || period?.subjectId?.subjectCode || null;
    const teacherName = period?.teacherName
        || period?.teacher?.name
        || period?.teacherId?.name
        || (typeof period?.teacher === 'string' ? period.teacher : null);
    const room = period?.room || period?.roomNumber || null;

    return {
        period: periodNumber,
        periodNumber,
        startTime: period?.startTime || null,
        endTime: period?.endTime || null,
        subject: subjectName || 'Subject',
        subjectName: subjectName || 'Subject',
        ...(subjectCode ? { subjectCode } : {}),
        ...(teacherName ? { teacherName } : {}),
        ...(room ? { room, roomNumber: room } : {})
    };
};

const sortWeeklyRoutine = (routineRows) => routineRows.sort((a, b) => {
    const aIndex = DAY_INDEX[String(a?.day || '').toLowerCase()];
    const bIndex = DAY_INDEX[String(b?.day || '').toLowerCase()];
    const safeA = Number.isInteger(aIndex) ? aIndex : 99;
    const safeB = Number.isInteger(bIndex) ? bIndex : 99;
    return safeA - safeB;
});

const buildWeeklyFromLegacyRoutine = (routineDoc) => {
    if (!routineDoc || !Array.isArray(routineDoc.schedule)) return [];

    const weekly = routineDoc.schedule
        .map((row) => {
            const day = normalizeDayName(row?.day);
            if (!day) return null;
            const periods = Array.isArray(row?.periods)
                ? row.periods.map((period, index) => normalizeRoutinePeriod(period, index))
                : [];
            return { day, dayName: day, periods };
        })
        .filter(Boolean);

    return sortWeeklyRoutine(weekly);
};

const buildWeeklyFromClassRoutine = (routineDocs) => {
    if (!Array.isArray(routineDocs)) return [];

    const weekly = routineDocs
        .map((row) => {
            const day = normalizeDayName(row?.day);
            if (!day) return null;
            const periods = Array.isArray(row?.periods)
                ? row.periods.map((period, index) => normalizeRoutinePeriod(period, index))
                : [];
            return { day, dayName: day, periods };
        })
        .filter(Boolean);

    return sortWeeklyRoutine(weekly);
};

const resolveStudentClassContext = async (studentUser) => {
    if (!studentUser) return { classId: null, className: null, section: null };

    let classId = null;
    let className = null;
    let section = studentUser.section || null;

    if (studentUser.classId && typeof studentUser.classId === 'object' && studentUser.classId.className) {
        classId = studentUser.classId._id || null;
        className = studentUser.classId.className || null;
        section = section || studentUser.classId.section || null;
    } else if (studentUser.classId && mongoose.Types.ObjectId.isValid(studentUser.classId)) {
        classId = studentUser.classId;
        const classDoc = await Class.findById(studentUser.classId).select('className section').lean();
        if (classDoc) {
            className = classDoc.className || null;
            section = section || classDoc.section || null;
        }
    }

    return { classId, className, section };
};

const getStudentRoutineData = async ({ studentUser, schoolCode }) => {
    const { classId, className, section } = await resolveStudentClassContext(studentUser);
    if (!classId && !className) {
        return { weeklyRoutine: [], todayRoutine: null };
    }

    const today = getCurrentDayName();
    const now = new Date();
    let weeklyRoutine = [];

    // Primary source: legacy Routine model (class-level weekly schedule in one document).
    if (classId) {
        let routineDoc = await Routine.findOne({
            schoolCode,
            classId,
            isActive: true,
            effectiveFrom: { $lte: now },
            $or: [
                { effectiveTo: null },
                { effectiveTo: { $exists: false } },
                { effectiveTo: { $gte: now } }
            ]
        })
            .sort({ effectiveFrom: -1, createdAt: -1 })
            .populate('schedule.periods.subjectId', 'subjectName subjectCode')
            .populate('schedule.periods.teacherId', 'name')
            .lean();

        // Fallback to latest active routine if effective window data is missing.
        if (!routineDoc) {
            routineDoc = await Routine.findOne({
                schoolCode,
                classId,
                isActive: true
            })
                .sort({ createdAt: -1 })
                .populate('schedule.periods.subjectId', 'subjectName subjectCode')
                .populate('schedule.periods.teacherId', 'name')
                .lean();
        }

        weeklyRoutine = buildWeeklyFromLegacyRoutine(routineDoc);
    }

    // Secondary source: ClassRoutine model (one document per day).
    if (!weeklyRoutine.length && className) {
        const baseQuery = {
            schoolCode,
            studentClass: className,
            isActive: true
        };

        let classRoutineDocs = [];
        const normalizedSection = section ? String(section).trim() : null;

        if (normalizedSection) {
            const sectionCandidates = [...new Set([
                normalizedSection,
                normalizedSection.toUpperCase()
            ])];
            classRoutineDocs = await ClassRoutine.find({
                ...baseQuery,
                section: { $in: sectionCandidates }
            })
                .populate('periods.teacher', 'name')
                .lean();
        }

        if (!classRoutineDocs.length) {
            classRoutineDocs = await ClassRoutine.find(baseQuery)
                .populate('periods.teacher', 'name')
                .lean();
        }

        weeklyRoutine = buildWeeklyFromClassRoutine(classRoutineDocs);
    }

    const todayRoutine = weeklyRoutine.find((row) => row.day === today) || null;
    return { weeklyRoutine, todayRoutine };
};

/**
 * @desc    Get student dashboard
 * @route   GET /api/student/dashboard
 * @access  Student only
 */
exports.getStudentDashboard = async (req, res) => {
    try {
        const studentId = req.user.id;
        const schoolCode = req.user.schoolCode;

        let student = null;
        let notices = [];
        let results = [];
        let attendanceRecords = [];
        let todayRoutine = null;

        try {
            // MongoDB with populate
            student = await User.findById(studentId)
                .populate('classId', 'className section classLevel')
                .select('name rollNumber email phone classId');
            const studentObjectId = await resolveStudentObjectIdFromUser(student || req.user);

            notices = await Notice.find({
                $and: [
                    { $or: [{ schoolId: req.tenant?.schoolId || req.user.schoolId }, { isGlobal: true }] },
                    { isDeleted: false },
                    { status: 'active' },
                    { isPublished: true },
                    { publishDate: { $lte: new Date() } },
                    { $or: [{ expiryDate: { $gt: new Date() } }, { expiryDate: null }] },
                    {
                        $or: [
                            { targetType: 'all' },
                            { targetType: 'student' },
                            { targetType: 'role', targetRoles: { $in: ['student'] } },
                            { targetRoles: { $in: ['student'] } },
                            { targetRoles: { $size: 0 } },
                            { targetRoles: { $exists: false } }
                        ]
                    }
                ]
            })
            .sort({ isPinned: -1, pinOrder: 1, publishDate: -1, createdAt: -1 })
            .limit(5);

            results = studentObjectId
                ? await Result.find({
                      schoolCode,
                      studentId: studentObjectId,
                      isPublished: true
                  })
                      .populate('subjectId', 'subjectName subjectCode')
                      .populate('examType')
                      .sort({ examDate: -1 })
                      .limit(5)
                : [];

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            // FIXED: Use AdvancedAttendance instead of old Attendance model
            const AdvancedAttendance = require('../models/AdvancedAttendance');
            attendanceRecords = studentObjectId
                ? await AdvancedAttendance.find({
                      schoolId: req.tenant?.schoolId || req.user.schoolId,
                      studentId: studentObjectId,
                      attendanceType: 'student',
                      date: { $gte: thirtyDaysAgo }
                  }).select('date status')
                : [];

            const routineData = await getStudentRoutineData({ studentUser: student, schoolCode });
            todayRoutine = routineData.todayRoutine;
        } catch (dbError) {
            console.error('Student dashboard data fetch error:', dbError.message);
        }

        if (!student) {
            // User exists but no student record - return a valid response
            return res.status(200).json({
                success: true,
                data: {
                    student: {
                        name: req.user.name || 'Student',
                        email: req.user.email,
                        class: null,
                        message: 'Please complete your profile registration'
                    },
                    notices: [],
                    results: [],
                    attendance: {
                        summary: { total: 0, present: 0, absent: 0, late: 0, percentage: 0 },
                        attendancePercentage: 0
                    },
                    todayRoutine: null
                }
            });
        }

        // Calculate attendance summary - FIXED for AdvancedAttendance model
        let present = 0, absent = 0, late = 0;
        
        attendanceRecords.forEach(record => {
            if (record.status === 'present') present++;
            else if (record.status === 'absent') absent++;
            else if (record.status === 'late') late++;
        });

        const attendanceSummary = {
            total: attendanceRecords.length,
            present,
            absent,
            late,
            percentage: attendanceRecords.length > 0 
                ? Math.round((present / attendanceRecords.length) * 100) 
                : 0
        };

        res.status(200).json({
            success: true,
            code: 'STUDENT_DASHBOARD_FETCHED',
            message: 'Student dashboard retrieved successfully',
            data: {
                student: {
                    name: student.name,
                    rollNumber: student.rollNumber,
                    email: student.email,
                    class: student.classId || student.class
                },
                notices,
                results,
                attendance: {
                    summary: attendanceSummary,
                    attendancePercentage: attendanceSummary.total > 0 
                        ? Math.round((attendanceSummary.present / attendanceSummary.total) * 100)
                        : 0
                },
                todayRoutine
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
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 10));
        const schoolId = req.tenant?.schoolId || req.user.schoolId;

        const query = {
            $and: [
                { $or: [{ schoolId }, { isGlobal: true }] },
                { isDeleted: false },
                { status: 'active' },
                { isPublished: true },
                { publishDate: { $lte: new Date() } },
                { $or: [{ expiryDate: { $gt: new Date() } }, { expiryDate: null }] },
                {
                    $or: [
                        { targetType: 'all' },
                        { targetType: 'student' },
                        { targetType: 'role', targetRoles: { $in: ['student'] } },
                        { targetRoles: { $in: ['student'] } },
                        { targetRoles: { $size: 0 } },
                        { targetRoles: { $exists: false } }
                    ]
                }
            ]
        };

        if (priority) {
            query.$and.push({ priority });
        }

        const notices = await Notice.find(query)
            .sort({ isPinned: -1, pinOrder: 1, publishDate: -1, priority: -1 })
            .skip((pageNum - 1) * limitNum)
            .limit(limitNum);

        const total = await Notice.countDocuments(query);

        res.status(200).json({
            success: true,
            code: 'STUDENT_NOTICES_FETCHED',
            message: 'Student notices fetched successfully',
            data: {
                notices,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.ceil(total / limitNum)
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
        const student = await User.findById(studentId)
            .populate('classId', 'className section')
            .select('classId section');

        if (!student) {
            return res.status(404).json({
                success: false,
                code: 'STUDENT_NOT_FOUND',
                message: 'Student not found',
                data: null
            });
        }

        const { todayRoutine } = await getStudentRoutineData({ studentUser: student, schoolCode });
        const day = getCurrentDayName();

        res.status(200).json({
            success: true,
            code: 'STUDENT_TODAY_ROUTINE_FETCHED',
            message: 'Today\'s routine retrieved',
            data: todayRoutine || { day, dayName: day, periods: [], routine: [] }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            code: 'STUDENT_TODAY_ROUTINE_FETCH_FAILED',
            message: 'Failed to retrieve today\'s routine',
            data: null,
            ...(process.env.NODE_ENV === 'development' ? { error: error.message } : {})
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
        const student = await User.findById(studentId)
            .populate('classId', 'className section')
            .select('classId section');

        if (!student) {
            return res.status(404).json({
                success: false,
                code: 'STUDENT_NOT_FOUND',
                message: 'Student not found',
                data: null
            });
        }

        const { weeklyRoutine } = await getStudentRoutineData({ studentUser: student, schoolCode });

        res.status(200).json({
            success: true,
            code: 'STUDENT_WEEKLY_ROUTINE_FETCHED',
            message: 'Weekly routine retrieved',
            data: weeklyRoutine
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            code: 'STUDENT_WEEKLY_ROUTINE_FETCH_FAILED',
            message: 'Failed to retrieve weekly routine',
            data: [],
            ...(process.env.NODE_ENV === 'development' ? { error: error.message } : {})
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
        const schoolId = req.tenant?.schoolId || req.user.schoolId;
        const studentObjectId = await resolveStudentObjectIdFromUser(req.user) || req.user.studentId || null;

        if (!studentObjectId || !schoolId) {
            return res.status(200).json({
                success: true,
                message: 'Attendance summary retrieved',
                data: {
                    totalDays: 0,
                    presentDays: 0,
                    absentDays: 0,
                    leaveDays: 0,
                    lateDays: 0,
                    percentage: 0
                }
            });
        }

        const monthlyAttendance = await AdvancedAttendance.getStudentAttendanceReport(
            schoolId,
            studentObjectId
        );

        const summary = (monthlyAttendance || []).reduce(
            (acc, month) => ({
                totalDays: acc.totalDays + (month.totalDays || 0),
                presentDays: acc.presentDays + (month.presentDays || 0),
                absentDays: acc.absentDays + (month.absentDays || 0),
                leaveDays: acc.leaveDays + (month.leaveDays || 0),
                lateDays: acc.lateDays + (month.lateDays || 0)
            }),
            { totalDays: 0, presentDays: 0, absentDays: 0, leaveDays: 0, lateDays: 0 }
        );

        const percentage = summary.totalDays > 0 ? Math.round((summary.presentDays / summary.totalDays) * 100) : 0;

        res.status(200).json({
            success: true,
            message: 'Attendance summary retrieved',
            data: {
                ...summary,
                percentage
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
 * @desc    Get monthly attendance
 * @route   GET /api/student/attendance/monthly
 * @access  Student only
 */
exports.getMonthlyAttendance = async (req, res) => {
    try {
        const schoolId = req.tenant?.schoolId || req.user.schoolId;
        const studentObjectId = await resolveStudentObjectIdFromUser(req.user) || req.user.studentId || null;
        const { month, year, startDate, endDate } = req.query;

        if (!studentObjectId || !schoolId) {
            return res.status(200).json({
                success: true,
                message: 'Monthly attendance retrieved',
                data: { monthlyData: [], monthlyReport: [] }
            });
        }

        let filteredStartDate = startDate;
        let filteredEndDate = endDate;

        if (month && year) {
            const parsedMonth = Number(month);
            const parsedYear = Number(year);
            if (!Number.isNaN(parsedMonth) && !Number.isNaN(parsedYear)) {
                filteredStartDate = new Date(parsedYear, parsedMonth - 1, 1).toISOString();
                filteredEndDate = new Date(parsedYear, parsedMonth, 0, 23, 59, 59, 999).toISOString();
            }
        }

        const monthlyAttendance = await AdvancedAttendance.getStudentAttendanceReport(
            schoolId,
            studentObjectId,
            null,
            filteredStartDate,
            filteredEndDate
        );

        const monthlyData = (monthlyAttendance || []).map((month) => ({
            month: month._id.month,
            year: month._id.year,
            totalDays: month.totalDays || 0,
            presentDays: month.presentDays || 0,
            absentDays: month.absentDays || 0,
            leaveDays: month.leaveDays || 0,
            lateDays: month.lateDays || 0,
            percentage: month.percentage ? Math.round(month.percentage) : 0
        }));

        res.status(200).json({
            success: true,
            message: 'Monthly attendance retrieved',
            data: {
                monthlyData,
                monthlyReport: monthlyData
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
 * @desc    Get assignments
 * @route   GET /api/student/assignments
 * @access  Student only
 */
exports.getAssignments = async (req, res) => {
    try {
        const studentId = req.user.id;
        const schoolCode = req.user.schoolCode;
        const student = await User.findById(studentId)
            .populate('classId', 'className section classLevel')
            .select('classId className section studentClass');

        let classId = student?.classId?._id || student?.classId || null;

        const studentClassName = student?.className || student?.studentClass;
        if (!classId && studentClassName) {
            const classDoc = await Class.findOne({
                schoolCode,
                className: studentClassName,
                section: student.section
            }).select('_id').lean();
            classId = classDoc?._id || null;
        }

        const query = {
            schoolCode,
            isActive: true,
            ...(classId ? { classId } : {})
        };

        const assignments = await Assignment.find(query)
            .populate('subjectId', 'subjectName subjectCode')
            .populate('classId', 'className section')
            .populate('teacherId', 'name')
            .sort({ dueDate: 1 })
            .lean();

        const studentObjectId = await resolveStudentObjectIdFromUser(req.user) || req.user.studentId || null;

        const assignmentData = assignments.map((assignment) => {
            const submission = studentObjectId
                ? (assignment.submissions || []).find((sub) => String(sub.studentId) === String(studentObjectId))
                : null;

            return {
                _id: assignment._id,
                title: assignment.title,
                description: assignment.description,
                dueDate: assignment.dueDate,
                maxMarks: assignment.maxMarks,
                class: assignment.classId,
                subject: assignment.subjectId,
                teacher: assignment.teacherId,
                attachments: assignment.attachments || [],
                instructions: assignment.instructions,
                submitted: Boolean(submission),
                submissionStatus: submission ? (submission.graded ? 'Graded' : 'Submitted') : 'Not submitted',
                submittedAt: submission?.submittedAt || null,
                marks: submission?.marks || null,
                feedback: submission?.feedback || null,
                isOverdue: assignment.dueDate ? assignment.dueDate < new Date() : false
            };
        });

        res.status(200).json({
            success: true,
            message: 'Assignments retrieved',
            data: assignmentData
        });
    } catch (error) {
        console.error('Error fetching student assignments:', error);
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
        const schoolCode = req.user.schoolCode;

        const assignment = await Assignment.findOne({
            _id: id,
            schoolCode,
            isActive: true
        })
            .populate('subjectId', 'subjectName subjectCode')
            .populate('classId', 'className section')
            .populate('teacherId', 'name');

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }

        const student = await User.findById(studentId)
            .populate('classId', 'className section')
            .select('classId className section studentClass');

        const studentClassId = student?.classId?._id || student?.classId || null;
        const assignmentClassId = assignment?.classId?._id || assignment?.classId || null;

        if (studentClassId && assignmentClassId && String(studentClassId) !== String(assignmentClassId)) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to view this assignment'
            });
        }

        const studentObjectId = await resolveStudentObjectIdFromUser(req.user) || req.user.studentId || null;
        const submission = studentObjectId
            ? (assignment.submissions || []).find((sub) => String(sub.studentId) === String(studentObjectId))
            : null;

        res.status(200).json({
            success: true,
            message: 'Assignment details retrieved',
            data: {
                _id: assignment._id,
                title: assignment.title,
                description: assignment.description,
                dueDate: assignment.dueDate,
                maxMarks: assignment.maxMarks,
                class: assignment.classId,
                subject: assignment.subjectId,
                teacher: assignment.teacherId,
                attachments: assignment.attachments || [],
                instructions: assignment.instructions,
                submitted: Boolean(submission),
                submissionStatus: submission ? (submission.graded ? 'Graded' : 'Submitted') : 'Not submitted',
                submittedAt: submission?.submittedAt || null,
                marks: submission?.marks || null,
                feedback: submission?.feedback || null
            }
        });
    } catch (error) {
        console.error('Error fetching assignment details:', error);
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
        const { submission, attachments = [] } = req.body;
        const studentObjectId = await resolveStudentObjectIdFromUser(req.user) || req.user.studentId || null;
        const schoolCode = req.user.schoolCode;

        if (!studentObjectId) {
            return res.status(400).json({
                success: false,
                message: 'Unable to resolve student identity'
            });
        }

        if (!submission && (!Array.isArray(attachments) || attachments.length === 0)) {
            return res.status(400).json({
                success: false,
                message: 'Submission content or attachments are required'
            });
        }

        const assignment = await Assignment.findOne({
            _id: id,
            schoolCode,
            isActive: true
        });

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }

        const student = await User.findById(req.user.id)
            .populate('classId', 'className section')
            .select('classId className section studentClass');

        const studentClassId = student?.classId?._id || student?.classId || null;
        const assignmentClassId = assignment?.classId?._id || assignment?.classId || null;

        if (studentClassId && assignmentClassId && String(studentClassId) !== String(assignmentClassId)) {
            return res.status(403).json({
                success: false,
                message: 'You are not authorized to submit this assignment'
            });
        }

        const existingSubmission = (assignment.submissions || []).find(
            (sub) => String(sub.studentId) === String(studentObjectId)
        );

        if (existingSubmission) {
            existingSubmission.content = submission || existingSubmission.content;
            existingSubmission.attachments = Array.isArray(attachments) ? attachments : existingSubmission.attachments;
            existingSubmission.submittedAt = new Date();
        } else {
            assignment.submissions.push({
                studentId: studentObjectId,
                content: submission || '',
                attachments: Array.isArray(attachments) ? attachments : [],
                submittedAt: new Date()
            });
        }

        await assignment.save();

        const savedSubmission = (assignment.submissions || []).find(
            (sub) => String(sub.studentId) === String(studentObjectId)
        );

        res.status(200).json({
            success: true,
            message: 'Assignment submitted successfully',
            data: {
                assignmentId: assignment._id,
                submittedAt: savedSubmission?.submittedAt,
                submitted: true,
                marks: savedSubmission?.marks || null,
                feedback: savedSubmission?.feedback || null
            }
        });
    } catch (error) {
        console.error('Error submitting assignment:', error);
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

        const student = await User.findById(studentId)
            .populate('classId', 'className section classLevel subjects')
            .select('classId className studentClass section');

        let subjectIds = [];
        let classLevel = student?.classId?.classLevel || null;

        if (student?.classId?.subjects?.length) {
            subjectIds = student.classId.subjects
                .filter((s) => s.subjectId)
                .map((s) => s.subjectId);
        }

        let subjects = [];

        if (subjectIds.length) {
            subjects = await Subject.find({
                schoolCode,
                isActive: true,
                _id: { $in: subjectIds }
            }).select('subjectName subjectCode syllabus.resources');
        }

        if (!subjects.length && classLevel) {
            subjects = await Subject.find({
                schoolCode,
                isActive: true,
                classLevels: classLevel
            }).select('subjectName subjectCode syllabus.resources');
        }

        const materials = subjects.flatMap((subject) => {
            const resources = (subject.syllabus?.resources || []).map((resource) => ({
                id: resource._id,
                title: resource.title || `${subject.subjectName} Resource`,
                type: resource.type,
                url: resource.url,
                description: resource.description || '',
                isRequired: resource.isRequired || false,
                subjectName: subject.subjectName,
                subjectCode: subject.subjectCode,
                subjectId: subject._id
            }));
            return resources;
        });

        res.status(200).json({
            success: true,
            message: 'Study materials retrieved',
            data: materials
        });
    } catch (error) {
        console.error('Error fetching study materials:', error);
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
        const schoolCode = req.user.schoolCode;

        const subject = await Subject.findOne(
            { schoolCode, 'syllabus.resources._id': id },
            { 'syllabus.resources.$': 1, subjectName: 1, subjectCode: 1 }
        ).lean();

        if (!subject || !subject.syllabus?.resources?.length) {
            return res.status(404).json({
                success: false,
                message: 'Study material not found'
            });
        }

        const resource = subject.syllabus.resources[0];

        if (!resource?.url) {
            return res.status(404).json({
                success: false,
                message: 'No download URL available for this study material'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Study material download link retrieved',
            data: {
                downloadUrl: resource.url,
                title: resource.title,
                type: resource.type,
                subjectName: subject.subjectName,
                subjectCode: subject.subjectCode
            }
        });
    } catch (error) {
        console.error('Error fetching study material download link:', error);
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

        // Update password with explicit hashing
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(newPassword, 12);
        student.password = hashedPassword;
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
        const student = await User.findById(studentId)
            .populate('classId', 'className section')
            .select('classId section');

        if (!student) {
            return res.status(404).json({
                success: false,
                code: 'STUDENT_NOT_FOUND',
                message: 'Student not found',
                data: null
            });
        }

        const { weeklyRoutine, todayRoutine } = await getStudentRoutineData({ studentUser: student, schoolCode });
        const day = getCurrentDayName();

        res.status(200).json({
            success: true,
            code: 'STUDENT_ROUTINE_FETCHED',
            message: 'Routine retrieved',
            data: {
                routine: weeklyRoutine,
                weeklyRoutine,
                todayRoutine: todayRoutine || { day, dayName: day, periods: [], routine: [] }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            code: 'STUDENT_ROUTINE_FETCH_FAILED',
            message: 'Failed to retrieve routine',
            data: null,
            ...(process.env.NODE_ENV === 'development' ? { error: error.message } : {})
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
        const schoolCode = req.user.schoolCode;
        const schoolId = req.tenant?.schoolId || req.user.schoolId;
        const studentObjectId = await resolveStudentObjectIdFromUser(req.user) || req.user.studentId || null;

        if (!studentObjectId) {
            return res.status(200).json({
                success: true,
                data: {
                    overallGPA: 0,
                    averageScore: 0,
                    totalExams: 0,
                    subjectPerformance: [],
                    trends: []
                }
            });
        }

        const results = await Result.find({
            schoolCode,
            studentId: studentObjectId,
            isPublished: true
        })
            .populate('subjectId', 'subjectName subjectCode')
            .populate('examType', 'name')
            .lean();

        const totalGpa = results.reduce((sum, item) => sum + (Number(item.gpa) || 0), 0);
        const totalExams = results.length;
        const overallGPA = totalExams > 0 ? Number((totalGpa / totalExams).toFixed(2)) : 0;

        const subjectMap = new Map();
        let totalMarks = 0;
        let totalSubjects = 0;

        results.forEach((result) => {
            const examDate = result.examDate ? new Date(result.examDate) : null;
            const examMonth = examDate ? examDate.getMonth() + 1 : null;
            const examYear = examDate ? examDate.getFullYear() : null;

            (result.subjects || []).forEach((subject) => {
                const key = String(subject.subjectId || subject.subjectName || subject.subjectName || subject._id);
                const existing = subjectMap.get(key) || {
                    subjectId: subject.subjectId || null,
                    subjectName: subject.subjectName || subject.subjectName || 'Unknown',
                    subjectCode: subject.subjectCode || null,
                    totalMarks: 0,
                    count: 0,
                    gradeCounts: {}
                };

                existing.totalMarks += Number(subject.marks || 0);
                existing.count += 1;

                if (subject.grade) {
                    existing.gradeCounts[subject.grade] = (existing.gradeCounts[subject.grade] || 0) + 1;
                }

                subjectMap.set(key, existing);
                totalMarks += Number(subject.marks || 0);
                totalSubjects += 1;
            });
        });

        const subjectPerformance = Array.from(subjectMap.values()).map((item) => ({
            subjectId: item.subjectId,
            subjectName: item.subjectName,
            subjectCode: item.subjectCode,
            averageMarks: item.count > 0 ? Number((item.totalMarks / item.count).toFixed(2)) : 0,
            examCount: item.count,
            gradeCounts: item.gradeCounts
        }));

        const trends = [];
        const trendMap = new Map();

        results.forEach((result) => {
            if (!result.examDate) return;
            const examDate = new Date(result.examDate);
            const key = `${examDate.getFullYear()}-${examDate.getMonth() + 1}`;
            const existing = trendMap.get(key) || {
                year: examDate.getFullYear(),
                month: examDate.getMonth() + 1,
                totalExams: 0,
                totalScore: 0,
                totalPossible: 0
            };

            existing.totalExams += 1;
            existing.totalScore += Number(result.totalMarks || 0);
            existing.totalPossible += (result.subjects || []).reduce((sum, sub) => sum + (Number(sub.marks || 0)), 0);
            trendMap.set(key, existing);
        });

        trendMap.forEach((value) => {
            trends.push({
                year: value.year,
                month: value.month,
                totalExams: value.totalExams,
                averageScore: value.totalExams > 0 ? Number((value.totalScore / value.totalExams).toFixed(2)) : 0
            });
        });

        trends.sort((a, b) => (a.year - b.year) || (a.month - b.month));

        res.status(200).json({
            success: true,
            data: {
                overallGPA,
                averageScore: totalSubjects > 0 ? Number((totalMarks / totalSubjects).toFixed(2)) : 0,
                totalExams,
                subjectPerformance,
                trends
            }
        });
    } catch (error) {
        console.error('Error fetching student performance analytics:', error);
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
        const schoolCode = req.user.schoolCode;
        const studentObjectId = await resolveStudentObjectIdFromUser(req.user) || req.user.studentId || null;

        if (!studentObjectId) {
            return res.status(200).json({
                success: true,
                data: {
                    subjects: [],
                    averageMarks: 0
                }
            });
        }

        const results = await Result.find({
            schoolCode,
            studentId: studentObjectId,
            isPublished: true
        }).lean();

        const subjectMap = new Map();
        let totalMarks = 0;
        let totalCount = 0;

        results.forEach((result) => {
            (result.subjects || []).forEach((subject) => {
                const key = String(subject.subjectId || subject.subjectName || subject._id);
                const existing = subjectMap.get(key) || {
                    subjectId: subject.subjectId || null,
                    subjectName: subject.subjectName || subject.subjectName || 'Unknown',
                    subjectCode: subject.subjectCode || null,
                    totalMarks: 0,
                    count: 0
                };

                existing.totalMarks += Number(subject.marks || 0);
                existing.count += 1;
                subjectMap.set(key, existing);
                totalMarks += Number(subject.marks || 0);
                totalCount += 1;
            });
        });

        const subjects = Array.from(subjectMap.values()).map((item) => ({
            subjectId: item.subjectId,
            subjectName: item.subjectName,
            subjectCode: item.subjectCode,
            averageMarks: item.count > 0 ? Number((item.totalMarks / item.count).toFixed(2)) : 0,
            examCount: item.count
        }));

        const averageMarks = totalCount > 0 ? Number((totalMarks / totalCount).toFixed(2)) : 0;

        res.status(200).json({
            success: true,
            data: {
                subjects,
                averageMarks
            }
        });
    } catch (error) {
        console.error('Error fetching subject performance:', error);
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
        const schoolId = req.tenant?.schoolId || req.user.schoolId;
        const studentObjectId = await resolveStudentObjectIdFromUser(req.user) || req.user.studentId || null;
        const { startDate, endDate } = req.query;

        if (!studentObjectId || !schoolId) {
            return res.status(200).json({
                success: true,
                data: {
                    monthlyData: [],
                    overallPercentage: 0
                }
            });
        }

        const now = new Date();
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);

        const attendanceRecords = await AdvancedAttendance.getStudentAttendanceReport(
            schoolId,
            studentObjectId,
            null,
            startDate || sixMonthsAgo.toISOString(),
            endDate || now.toISOString()
        );

        const monthlyData = (attendanceRecords || []).map((month) => ({
            month: month._id.month,
            year: month._id.year,
            totalDays: month.totalDays || 0,
            presentDays: month.presentDays || 0,
            absentDays: month.absentDays || 0,
            leaveDays: month.leaveDays || 0,
            lateDays: month.lateDays || 0,
            percentage: month.percentage ? Math.round(month.percentage) : 0
        }));

        const overallPercentage = monthlyData.length
            ? Math.round(
                monthlyData.reduce((acc, item) => acc + (item.percentage || 0), 0) / monthlyData.length
              )
            : 0;

        res.status(200).json({
            success: true,
            data: {
                monthlyData,
                overallPercentage
            }
        });
    } catch (error) {
        console.error('Error fetching attendance trend:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};
