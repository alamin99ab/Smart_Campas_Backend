const User = require('../models/User');
const School = require('../models/School');
const Notice = require('../models/Notice');
const Attendance = require('../models/Attendance');
const SchoolEvent = require('../models/SchoolEvent');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const superAdminController = require('./superAdminController');
const accountantController = require('./accountantController');
const { CacheHelpers } = require('../services/cacheService');

/**
 * @desc    Get Super Admin Dashboard
 * @route   GET /api/dashboard/super-admin
 * @access  Super Admin only
 */
exports.getSuperAdminDashboard = async (req, res) => {
    return superAdminController.getSuperAdminDashboard(req, res);
};

/**
 * @desc    Get Principal Dashboard
 * @route   GET /api/dashboard/principal
 * @access  Principal only
 */
exports.getPrincipalDashboard = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        
        // Check cache first
        const cachedData = await CacheHelpers.getCachedDashboard('principal', schoolId);
        if (cachedData) {
            return res.status(200).json({
                success: true,
                data: cachedData,
                cached: true
            });
        }

        const schoolCode = req.user.schoolCode;
        const normalizedSchoolCode = req.user.schoolCode ? req.user.schoolCode.toUpperCase() : null;

        // Parallel execution of basic counts
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const startOfTrend = new Date(today.getFullYear(), today.getMonth() - 11, 1);

        const [
            totalTeachers,
            totalStudents,
            totalClasses,
            totalSubjects,
            attendanceStatusRows,
            activeRoutines,
            totalNotices,
            feeCollected,
            classTrendRows,
            studentTrendRows
        ] = await Promise.all([
            User.countDocuments({ schoolId, role: 'teacher' }).lean(),
            User.countDocuments({ schoolId, role: 'student' }).lean(),
            Class.countDocuments({ schoolCode: normalizedSchoolCode }).lean(),
            Subject.countDocuments({ schoolCode: normalizedSchoolCode }).lean(),
            Attendance.aggregate([
                { $match: { schoolId, date: { $gte: today, $lt: tomorrow } } },
                { $unwind: '$records' },
                { $match: { 'records.status': { $in: ['Present', 'Absent', 'Late'] } } },
                { $group: { _id: '$records.status', count: { $sum: 1 } } }
            ]).lean(),
            require('../models/ClassRoutine').countDocuments({
                schoolCode,
                isPublished: true
            }).lean(),
            Notice.countDocuments({ $or: [{ schoolId }, { isGlobal: true }] }).lean(),
            require('../models/PaymentHistory').aggregate([
                { $match: { schoolId, createdAt: { $gte: startOfMonth } } },
                { $group: { _id: null, total: { $sum: '$amount' } } }
            ]).lean(),
            Class.aggregate([
                { $match: { schoolId, createdAt: { $gte: startOfTrend, $lt: tomorrow } } },
                { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]).lean(),
            User.aggregate([
                { $match: { schoolId, role: 'student', createdAt: { $gte: startOfTrend, $lt: tomorrow } } },
                { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, count: { $sum: 1 } } },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]).lean()
        ]);

        const attendanceCounts = attendanceStatusRows.reduce((acc, row) => {
            acc[row._id] = row.count;
            return acc;
        }, {});

        const presentToday = attendanceCounts.Present || 0;
        const absentToday = attendanceCounts.Absent || 0;
        const lateToday = attendanceCounts.Late || 0;
        const attendanceToday = presentToday + absentToday + lateToday;

        const classTrendMap = new Map(classTrendRows.map((row) => [`${row._id.year}-${row._id.month}`, row.count]));
        const studentTrendMap = new Map(studentTrendRows.map((row) => [`${row._id.year}-${row._id.month}`, row.count]));

        const months = [];
        const monthsClasses = [];
        const monthsStudents = [];

        for (let i = 11; i >= 0; i -= 1) {
            const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
            months.push(date.toLocaleString('en-US', { month: 'short' }));
            monthsClasses.push(classTrendMap.get(key) || 0);
            monthsStudents.push(studentTrendMap.get(key) || 0);
        }

        const dashboardData = {
            totalClasses,
            totalTeachers,
            totalStudents,
            totalSubjects,
            attendanceToday,
            presentToday,
            absentToday,
            lateToday,
            activeRoutines: activeRoutines || 0,
            totalNotices: totalNotices || 0,
            feeCollected: feeCollected[0]?.total || 0,
            months,
            monthsClasses,
            monthsStudents
        };

        // Cache the dashboard data for 5 minutes
        await CacheHelpers.cacheDashboard('principal', schoolId, dashboardData, 300);
        
        res.status(200).json({
            success: true,
            data: dashboardData,
            cached: false
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
 * @desc    Get Teacher Dashboard
 * @route   GET /api/dashboard/teacher
 * @access  Teacher only
 */
exports.getTeacherDashboard = async (req, res) => {
    try {
        const teacher = req.user;
        const schoolCode = req.user.schoolCode;
        const teacherId = req.user._id;

        const TeacherAssignment = require('../models/TeacherAssignment');
        // Parallel execution of teacher dashboard data
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const [
            assignments,
            attendanceMarked
        ] = await Promise.all([
            TeacherAssignment.find({ teacher: teacherId, schoolCode, isActive: true }).lean(),
            require('../models/AdvancedAttendance').countDocuments({
                schoolId: req.tenant?.schoolId,
                markedBy: teacherId,
                date: { $gte: today, $lt: tomorrow },
                attendanceType: 'student'
            }).lean()
        ]);

        const classIds = [...new Set(assignments.flatMap(a => a.classes || []))];
        const classDocs = classIds.length
            ? await require('../models/Class').find({ _id: { $in: classIds }, schoolCode }).lean()
            : [];
        const classMap = new Map(classDocs.map(c => [c._id.toString(), c]));
        
        const enrichedAssignments = assignments.map(a => {
            const classId = (a.classes && a.classes[0]) || null;
            const cls = classId ? classMap.get(String(classId)) : null;
            return {
                ...a,
                className: cls?.className,
                section: cls?.section
            };
        });

        const assignedClasses = [...new Set(assignments.flatMap(a => a.classes || []))].length || assignments.length;
        const subjects = [...new Set(assignments.map(a => a.subjectName || a.subject))];

        const subjectIds = [...new Set(assignments.map(a => String(a.subject)).filter(Boolean))];
        
        // Optimize pending marks calculation with single aggregation
        const Exam = require('../models/Exam');
        const Result = require('../models/Result');
        
        let pendingMarksCount = 0;
        if (subjectIds.length && classIds.length) {
            const exams = await Exam.find({ 
                schoolCode, 
                classId: { $in: classIds }, 
                subjectId: { $in: subjectIds }, 
                isActive: true 
            }).select('_id classId subjectId').lean();
            
            if (exams.length > 0) {
                const examIds = exams.map(e => e._id);
                
                // Single aggregation to get all pending counts
                const pendingCounts = await Result.aggregate([
                    { $match: { schoolCode, examId: { $in: examIds } } },
                    { $group: { _id: '$examId', count: { $sum: 1 } } }
                ]).lean();
                
                const resultMap = new Map(pendingCounts.map(r => [r._id.toString(), r.count]));
                
                // Batch student count query
                const studentCounts = await User.aggregate([
                    { $match: { schoolCode, role: 'student', classId: { $in: classIds } } },
                    { $group: { _id: '$classId', count: { $sum: 1 } } }
                ]).lean();
                
                const studentMap = new Map(studentCounts.map(s => [s._id.toString(), s.count]));
                
                pendingMarksCount = exams.reduce((total, exam) => {
                    const classId = exam.classId.toString();
                    const studentCount = studentMap.get(classId) || 0;
                    const enteredCount = resultMap.get(exam._id.toString()) || 0;
                    return total + Math.max(0, studentCount - enteredCount);
                }, 0);
            }
        }

        res.status(200).json({
            success: true,
            data: {
                assignedClasses,
                subjects,
                attendanceMarked: attendanceMarked || 0,
                pendingMarks: pendingMarksCount,
                name: teacher.name,
                email: teacher.email,
                assignments: enrichedAssignments
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
 * @desc    Get Student Dashboard
 * @route   GET /api/dashboard/student
 * @access  Student only
 */
exports.getStudentDashboard = async (req, res) => {
    try {
        // Use req.user directly - it's already populated by protect middleware
        const student = req.user;
        const schoolCode = req.user.schoolCode;
        const studentId = req.user._id;
        
        // Parallel execution of student dashboard data
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const today = new Date();
        const todayDay = today.toLocaleDateString('en-US', { weekday: 'long' });
        
        const [
            attendanceRecords,
            recentResults,
            recentNotices,
            todayRoutine
        ] = await Promise.all([
            require('../models/Attendance').find({
                studentId: studentId,
                schoolCode,
                date: { $gte: thirtyDaysAgo }
            }).select('date records').lean(),
            Result.find({ studentId, schoolCode })
                .sort({ examDate: -1 })
                .limit(5)
                .select('examName examDate totalMarks gpa status classId examId')
                .populate('classId', 'className section')
                .populate('examId', 'name examDate')
                .lean(),
            Notice.find({ 
                $or: [
                    { schoolId: req.tenant?.schoolId || req.user?.schoolId },
                    { isGlobal: true }
                ]
            })
            .sort({ createdAt: -1 })
            .limit(5)
            .select('title content createdAt priority')
            .lean(),
            require('../models/ClassRoutine').findOne({
                schoolCode,
                studentClass: student.studentClass,
                section: student.section,
                day: todayDay,
                isActive: true
            })
            .select('periods')
            .populate('periods.teacher', 'name')
            .populate('periods.subject', 'subjectName')
            .lean()
        ]);
        
        // Calculate attendance percentage
        const totalDays = attendanceRecords.length;
        const presentDays = attendanceRecords.filter(record => 
            record.records?.some(r => r.studentId?.toString() === studentId.toString() && r.status === 'Present')
        ).length;
        
        const attendancePercentage = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

        // Get upcoming exams (placeholder - would need exam schedule model)
        const upcomingExams = 0;
        
        // Get notices count
        const schoolId = req.tenant?.schoolId || req.user.schoolId;
        const notices = await Notice.countDocuments({
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
        });
        
        // Get fee due (placeholder - would need Fee model)
        const feeDue = 0;
        
        // Get results published count
        const results = 0;
        
        // Get assignments count
        const assignments = 0;
        
        res.status(200).json({
            success: true,
            data: {
                attendance: attendance || '—',
                assignments: assignments || 0,
                results: results || 0,
                upcomingExams: upcomingExams || 0,
                notices: notices || 0,
                feeDue: feeDue || 0,
                name: student.name,
                email: student.email
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
 * @desc    Get Parent Dashboard
 * @route   GET /api/dashboard/parent
 * @access  Parent only
 */
exports.getParentDashboard = async (req, res) => {
    try {
        const parentId = req.user._id;
        const schoolCode = req.user.schoolCode;
        const schoolId = req.tenant?.schoolId || req.user.schoolId;
        const parentEmail = String(req.user.email || '').trim();

        const parent = await User.findById(parentId).select('name email');
        const linkedStudents = await Student.find({
            schoolCode,
            isActive: true,
            $or: [
                { parentId },
                ...(parentEmail
                    ? [{ 'guardian.email': new RegExp(`^${parentEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }]
                    : [])
            ]
        }).select('_id');

        const childIds = linkedStudents.map((row) => row._id);

        let totalAttendance = 'N/A';
        let totalResults = 0;
        let totalFeeDue = 0;

        if (childIds.length > 0) {
            const AdvancedAttendance = require('../models/AdvancedAttendance');
            const Result = require('../models/Result');
            const Fee = require('../models/Fee');

            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            const attendanceRecords = await AdvancedAttendance.find({
                schoolId,
                studentId: { $in: childIds },
                attendanceType: 'student',
                date: { $gte: thirtyDaysAgo }
            }).select('status');

            const totalDays = attendanceRecords.length;
            const presentDays = attendanceRecords.filter((row) => row.status === 'present').length;
            totalAttendance = totalDays > 0 ? `${Math.round((presentDays / totalDays) * 100)}%` : 'N/A';

            totalResults = await Result.countDocuments({
                schoolCode,
                studentId: { $in: childIds },
                isPublished: true
            });

            const fees = await Fee.find({
                schoolCode,
                studentId: { $in: childIds }
            }).select('amountDue amountPaid');

            totalFeeDue = fees.reduce(
                (sum, fee) => sum + Math.max(0, Number(fee.amountDue || 0) - Number(fee.amountPaid || 0)),
                0
            );
        }

        const totalNotices = await Notice.countDocuments({
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
                        { targetType: 'parent' },
                        { targetType: 'role', targetRoles: { $in: ['parent'] } },
                        { targetRoles: { $in: ['parent'] } },
                        { targetRoles: { $size: 0 } },
                        { targetRoles: { $exists: false } }
                    ]
                }
            ]
        });

        let performanceTrend = [];
        if (childIds.length > 0) {
            const AdvancedAttendance = require('../models/AdvancedAttendance');
            const Result = require('../models/Result');

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const trendStart = new Date(today.getFullYear(), today.getMonth() - 5, 1);
            const trendEnd = tomorrow;

            const attendanceTrendRows = await AdvancedAttendance.aggregate([
                { $match: { schoolId, studentId: { $in: childIds }, attendanceType: 'student', date: { $gte: trendStart, $lt: trendEnd } } },
                { $group: { _id: { year: { $year: '$date' }, month: { $month: '$date' } }, total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } } } },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]);

            const resultTrendRows = await Result.aggregate([
                { $match: { schoolCode, studentId: { $in: childIds }, isPublished: true, createdAt: { $gte: trendStart, $lt: trendEnd } } },
                { $unwind: '$subjects' },
                { $group: { _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } }, totalMarks: { $sum: '$subjects.marks' }, count: { $sum: 1 } } },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ]);

            const attendanceMap = new Map(attendanceTrendRows.map((row) => [`${row._id.year}-${row._id.month}`, row]));
            const resultMap = new Map(resultTrendRows.map((row) => [`${row._id.year}-${row._id.month}`, row]));

            const now = new Date();
            for (let i = 5; i >= 0; i -= 1) {
                const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
                const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
                const attendanceRow = attendanceMap.get(key) || { total: 0, present: 0 };
                const resultRow = resultMap.get(key) || { totalMarks: 0, count: 0 };

                performanceTrend.push({
                    month: date.toLocaleString('en-US', { month: 'short' }),
                    attendance: attendanceRow.total > 0 ? Math.round((attendanceRow.present / attendanceRow.total) * 100) : 0,
                    marks: resultRow.count > 0 ? Number((resultRow.totalMarks / resultRow.count).toFixed(2)) : 0
                });
            }
        }

        res.status(200).json({
            success: true,
            data: {
                attendance: totalAttendance || 'N/A',
                results: totalResults || 0,
                feeDue: totalFeeDue || 0,
                notices: totalNotices || 0,
                childrenCount: childIds.length,
                performanceTrend,
                name: parent?.name || req.user.name,
                email: parent?.email || req.user.email
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
 * @desc    Get Accountant Dashboard
 * @route   GET /api/dashboard/accountant
 * @access  Accountant only
 */
exports.getAccountantDashboard = async (req, res) => {
    return accountantController.getAccountantDashboard(req, res);
};

exports.getDashboard = async (req, res) => {
    try {
        const user = req.user;
        const schoolCode = user.schoolCode;
        const schoolId = user.schoolId;

        if (!schoolCode || !schoolId) {
            return res.status(400).json({ success: false, message: 'No school associated' });
        }

        const school = await School.findOne({ schoolCode }).select('schoolName logo subscription').lean();
        if (!school) {
            return res.status(404).json({ success: false, message: 'School not found' });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);

        const [
            teacherCount,
            studentCount,
            pendingTeacherCount,
            todayAttendanceCount,
            recentNotices,
            upcomingNotices,
            upcomingEvents,
            birthdaysToday
        ] = await Promise.all([
            User.countDocuments({ schoolCode, role: 'teacher', isApproved: true }),
            User.countDocuments({ schoolCode, role: 'student' }),
            User.countDocuments({ schoolCode, role: 'teacher', isApproved: false }),
            Attendance.countDocuments({ schoolCode, date: { $gte: today, $lt: tomorrow } }),
            Notice.find({ $or: [{ schoolId }, { isGlobal: true }] }).sort({ createdAt: -1 }).limit(5).select('title category priority createdAt').lean(),
            Notice.find({ $or: [{ schoolId }, { isGlobal: true }], createdAt: { $gte: today } }).sort({ createdAt: 1 }).limit(5).select('title category priority createdAt').lean(),
            SchoolEvent.find({ schoolCode, isActive: true, startDate: { $gte: today, $lte: nextWeek } }).sort({ startDate: 1 }).limit(5).select('title type startDate endDate').lean(),
            getBirthdaysToday(schoolCode, today)
        ]);

        const stats = {
            teachers: teacherCount,
            students: studentCount,
            pendingTeachers: pendingTeacherCount,
            todayAttendanceRecords: todayAttendanceCount
        };

        if (user.role === 'principal' || user.role === 'admin') {
            const subscription = school.subscription || {};
            stats.subscription = {
                plan: subscription.plan,
                status: subscription.status,
                endDate: subscription.endDate
            };
        }

        res.json({
            success: true,
            data: {
                school: { name: school.schoolName, logo: school.logo },
                stats,
                recentNotices,
                upcomingNotices,
                upcomingEvents: upcomingEvents || [],
                birthdaysToday: birthdaysToday || []
            }
        });
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ success: false, message: 'Failed to load dashboard' });
    }
};

async function getBirthdaysToday(schoolCode, date) {
    const day = date.getDate();
    const month = date.getMonth();
    const students = await Student.find({ schoolCode, isActive: true, dateOfBirth: { $ne: null } }).select('name studentClass section dateOfBirth').lean();
    return students.filter(s => {
        const d = new Date(s.dateOfBirth);
        return d.getDate() === day && d.getMonth() === month;
    }).map(s => ({ name: s.name, class: s.studentClass, section: s.section }));
}
