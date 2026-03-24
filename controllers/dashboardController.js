const User = require('../models/User');
const School = require('../models/School');
const Notice = require('../models/Notice');
const Attendance = require('../models/Attendance');
const SchoolEvent = require('../models/SchoolEvent');
const Student = require('../models/Student');
const Class = require('../models/Class');
const Subject = require('../models/Subject');

/**
 * @desc    Get Super Admin Dashboard
 * @route   GET /api/dashboard/super-admin
 * @access  Super Admin only
 */
exports.getSuperAdminDashboard = async (req, res) => {
    try {
        const totalSchools = await School.countDocuments();
        const activeSchools = await School.countDocuments({ status: 'active' });
        const totalUsers = await User.countDocuments();
        const totalPrincipals = await User.countDocuments({ role: 'principal' });
        const totalTeachers = await User.countDocuments({ role: 'teacher' });
        const totalStudents = await User.countDocuments({ role: 'student' });

        res.status(200).json({
            success: true,
            data: {
                totalSchools,
                activeSchools,
                totalUsers,
                totalPrincipals,
                totalTeachers,
                totalStudents
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
 * @desc    Get Principal Dashboard
 * @route   GET /api/dashboard/principal
 * @access  Principal only
 */
exports.getPrincipalDashboard = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        
        const totalTeachers = await User.countDocuments({ schoolCode, role: 'teacher' });
        const totalStudents = await User.countDocuments({ schoolCode, role: 'student' });
        const totalClasses = await Class.countDocuments({ schoolCode });
        const totalSubjects = await Subject.countDocuments({ schoolCode });
        
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
        
        // Get notices count
        const totalNotices = await Notice.countDocuments({ schoolCode });
        
        // Get fee collected (this month)
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const feeCollected = await require('../models/PaymentHistory').aggregate([
            { $match: { schoolCode, paymentDate: { $gte: startOfMonth } } },
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
        // Use req.user directly - it's already populated by protect middleware
        const teacher = req.user;
        const schoolCode = req.user.schoolCode;
        const teacherId = req.user._id;
        
        // Get assigned classes count
        const assignedClasses = await require('../models/TeacherAssignment').countDocuments({
            teacher: teacherId,
            academicSession: req.user.currentSession
        });
        
        // Get attendance marked today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const attendanceMarked = await require('../models/Attendance').countDocuments({
            schoolCode,
            markedBy: teacherId,
            date: { $gte: today, $lt: tomorrow }
        });
        
        // Get assignments count (placeholder - would need Assignment model)
        const assignments = 0;
        
        // Get pending marks (placeholder)
        const pendingMarks = 0;
        
        res.status(200).json({
            success: true,
            data: {
                assignedClasses: assignedClasses || 0,
                attendanceMarked: attendanceMarked || 0,
                assignments: assignments || 0,
                pendingMarks: pendingMarks || 0,
                name: teacher.name,
                email: teacher.email
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
        const notices = await Notice.countDocuments({
            schoolCode,
            $or: [
                { targetRoles: 'student' },
                { isPublic: true }
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
        
        const parent = await User.findById(parentId);
        const children = parent.children || [];
        
        // Get aggregated data for children
        let totalAttendance = '—';
        let totalResults = 0;
        let totalFeeDue = 0;
        let totalNotices = 0;
        
        if (children.length > 0) {
            // For each child, get attendance and other data
            const childIds = children.map(c => c.studentId);
            
            // Get attendance records for children (last 30 days)
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            
            const attendanceRecords = await require('../models/Attendance').find({
                student: { $in: childIds },
                date: { $gte: thirtyDaysAgo }
            });
            
            const totalDays = attendanceRecords.length;
            const presentDays = attendanceRecords.filter(r => r.status === 'present').length;
            totalAttendance = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) + '%' : '—';
            
            // Get notices
            totalNotices = await Notice.countDocuments({
                schoolCode,
                $or: [
                    { targetRoles: 'parent' },
                    { isPublic: true }
                ]
            });
        }
        
        res.status(200).json({
            success: true,
            data: {
                attendance: totalAttendance || '—',
                results: totalResults || 0,
                feeDue: totalFeeDue || 0,
                notices: totalNotices || 0,
                childrenCount: children.length,
                name: parent.name,
                email: parent.email
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
    try {
        const schoolCode = req.user.schoolCode;
        
        // Get fee statistics
        const totalStudents = await User.countDocuments({ schoolCode, role: 'student' });
        
        // Get monthly collection (this month)
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        const PaymentHistory = require('../models/PaymentHistory');
        const monthlyPayments = await PaymentHistory.aggregate([
            {
                $match: {
                    schoolCode,
                    paymentDate: { $gte: startOfMonth, $lte: endOfMonth }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' },
                    count: { $sum: 1 }
                }
            }
        ]);
        
        // Get total outstanding
        const Fee = require('../models/Fee');
        const outstanding = await Fee.aggregate([
            {
                $match: {
                    schoolCode,
                    status: { $ne: 'paid' }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);
        
        // Get paid students count
        const paidStudents = await Fee.countDocuments({
            schoolCode,
            status: 'paid'
        });
        
        res.status(200).json({
            success: true,
            data: {
                totalStudents: totalStudents || 0,
                monthlyCollection: monthlyPayments[0]?.total || 0,
                monthlyPayments: monthlyPayments[0]?.count || 0,
                totalOutstanding: outstanding[0]?.total || 0,
                studentFeeStats: {
                    paid: paidStudents || 0,
                    unpaid: totalStudents - paidStudents || 0
                },
                schoolCode
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

exports.getDashboard = async (req, res) => {
    try {
        const user = req.user;
        const schoolCode = user.schoolCode;

        if (!schoolCode) {
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
            Notice.find({ schoolCode }).sort({ createdAt: -1 }).limit(5).select('title category priority createdAt').lean(),
            Notice.find({ schoolCode, createdAt: { $gte: today } }).sort({ createdAt: 1 }).limit(5).select('title category priority createdAt').lean(),
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
