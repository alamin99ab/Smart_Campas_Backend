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

        res.status(200).json({
            success: true,
            data: {
                totalTeachers,
                totalStudents,
                totalClasses,
                totalSubjects
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
        const teacherId = req.user.id;
        const schoolCode = req.user.schoolCode;
        
        // Get teacher's assigned classes and subjects
        const teacher = await User.findById(teacherId);
        
        res.status(200).json({
            success: true,
            data: {
                teacher: {
                    name: teacher.name,
                    email: teacher.email,
                    subjects: teacher.subjects || [],
                    classes: teacher.classes || []
                }
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
        const studentId = req.user.id;
        const schoolCode = req.user.schoolCode;
        
        const student = await User.findById(studentId);
        
        res.status(200).json({
            success: true,
            data: {
                student: {
                    name: student.name,
                    email: student.email,
                    class: student.class,
                    section: student.section
                }
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
        const parentId = req.user.id;
        
        const parent = await User.findById(parentId);
        
        res.status(200).json({
            success: true,
            data: {
                parent: {
                    name: parent.name,
                    email: parent.email,
                    children: parent.children || []
                }
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
        
        res.status(200).json({
            success: true,
            data: {
                totalStudents,
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
