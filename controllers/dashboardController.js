const User = require('../models/User');
const School = require('../models/School');
const Notice = require('../models/Notice');
const Attendance = require('../models/Attendance');
const SchoolEvent = require('../models/SchoolEvent');
const Student = require('../models/Student');

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
