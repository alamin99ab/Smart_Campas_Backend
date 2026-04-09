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
        const schoolCode = req.user.schoolCode;
        
        const schoolId = req.user.schoolId;
        const normalizedSchoolCode = req.user.schoolCode ? req.user.schoolCode.toUpperCase() : null;

        const totalTeachers = await User.countDocuments({ schoolId, role: 'teacher' });
        const totalStudents = await User.countDocuments({ schoolId, role: 'student' });
        const totalClasses = await Class.countDocuments({ schoolCode: normalizedSchoolCode });
        const totalSubjects = await Subject.countDocuments({ schoolCode: normalizedSchoolCode });
        
        // Get today's attendance
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const attendanceToday = await Attendance.countDocuments({
            schoolCode,
            date: { $gte: today, $lt: tomorrow }
        });
        
        // Get active routines count
        const activeRoutines = await require('../models/ClassRoutine').countDocuments({
            schoolCode,
            isPublished: true
        });
        
        // Get notices count (tenant-scoped by schoolId and global notices)
        const totalNotices = await Notice.countDocuments({ $or: [{ schoolId }, { isGlobal: true }] });
        
        // Get fee collected (this month)
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const feeCollected = await require('../models/PaymentHistory').aggregate([
            { $match: { schoolCode, createdAt: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        
        res.status(200).json({
            success: true,
            data: {
                totalClasses,
                totalTeachers,
                totalStudents,
                totalSubjects,
                attendanceToday: attendanceToday || '—',
                activeRoutines: activeRoutines || 0,
                totalNotices: totalNotices || 0,
                feeCollected: feeCollected[0]?.total || 0
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
        const assignments = await TeacherAssignment.find({ teacher: teacherId, schoolCode, isActive: true }).lean();
        const classIds = [...new Set(assignments.flatMap(a => a.classes || []))];
        const classDocs = classIds.length
            ? await require('../models/Class').find({ _id: { $in: classIds } }).lean()
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

        // Attendance marked today (advanced attendance collection)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const AdvancedAttendance = require('../models/AdvancedAttendance');
        const attendanceMarked = await AdvancedAttendance.countDocuments({
            schoolId: req.tenant?.schoolId,
            markedBy: teacherId,
            date: { $gte: today, $lt: tomorrow },
            attendanceType: 'student'
        });

        res.status(200).json({
            success: true,
            data: {
                assignedClasses,
                subjects,
                attendanceMarked: attendanceMarked || 0,
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
        
        // Get attendance percentage (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const attendanceRecords = await require('../models/Attendance').find({
            student: studentId,
            date: { $gte: thirtyDaysAgo }
        });
        
        const totalDays = attendanceRecords.length;
        const presentDays = attendanceRecords.filter(r => r.status === 'present').length;
        const attendance = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) + '%' : '—';
        
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

        res.status(200).json({
            success: true,
            data: {
                attendance: totalAttendance || 'N/A',
                results: totalResults || 0,
                feeDue: totalFeeDue || 0,
                notices: totalNotices || 0,
                childrenCount: childIds.length,
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
