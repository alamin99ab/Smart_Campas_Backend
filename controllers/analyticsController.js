const mongoose = require('mongoose');

// MongoDB Models
const User = require('../models/User');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Fee = require('../models/Fee');
const Notice = require('../models/Notice');
const Class = require('../models/Class');

exports.getOverview = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        if (!schoolCode) {
            return res.status(400).json({ success: false, message: 'No school associated' });
        }

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const last7DaysStart = new Date(todayStart);
        last7DaysStart.setDate(last7DaysStart.getDate() - 6);

        const [
            studentsByClass,
            attendanceTrend,
            feeSummary,
            noticeCountThisMonth,
            todayBirthdays
        ] = await Promise.all([
            Student.aggregate([
                { $match: { schoolCode, isActive: true } },
                { $group: { _id: '$studentClass', count: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),
            Attendance.aggregate([
                { $match: { schoolCode, date: { $gte: last7DaysStart, $lte: now } } },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } }, records: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),
            Fee.aggregate([
                { $match: { schoolCode } },
                {
                    $group: {
                        _id: '$status',
                        totalAmount: { $sum: '$amountDue' },
                        paidAmount: { $sum: '$amountPaid' },
                        count: { $sum: 1 }
                    }
                }
            ]),
            Notice.countDocuments({ schoolCode, createdAt: { $gte: monthStart } }),
            Student.find({
                schoolCode,
                isActive: true,
                dateOfBirth: { $ne: null }
            })
                .select('name studentClass section dateOfBirth')
                .lean()
        ]);

        const birthDay = now.getDate();
        const birthMonth = now.getMonth();
        const birthdaysToday = (todayBirthdays || []).filter(s => {
            if (!s.dateOfBirth) return false;
            const d = new Date(s.dateOfBirth);
            return d.getDate() === birthDay && d.getMonth() === birthMonth;
        });

        let feePaid = 0, feeDue = 0, feePartial = 0;
        (feeSummary || []).forEach(f => {
            if (f._id === 'Paid') feePaid = f.paidAmount || 0;
            if (f._id === 'Unpaid') feeDue += f.totalAmount || 0;
            if (f._id === 'Partial') {
                feePartial += (f.totalAmount || 0) - (f.paidAmount || 0);
                feeDue += (f.totalAmount || 0) - (f.paidAmount || 0);
            }
        });

        res.json({
            success: true,
            data: {
                studentsByClass: (studentsByClass || []).map(c => ({ class: c._id, count: c.count })),
                attendanceTrend: (attendanceTrend || []).map(t => ({ date: t._id, records: t.records })),
                feeSummary: {
                    totalCollected: feePaid,
                    totalDue: feeDue + feePartial
                },
                noticeCountThisMonth: noticeCountThisMonth || 0,
                birthdaysToday: birthdaysToday.map(s => ({
                    name: s.name,
                    class: s.studentClass,
                    section: s.section
                }))
            }
        });
    } catch (err) {
        console.error('Analytics overview error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * @desc    Get principal dashboard analytics
 * @route   GET /api/analytics/dashboard
 * @access  Principal only
 */
exports.getPrincipalDashboard = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        
        // For super_admin, get stats across all schools
        const isSuperAdmin = req.user.role === 'super_admin';
        const filter = isSuperAdmin ? {} : { schoolCode };
        
        // Get counts from database
        let totalStudents = 0;
        let totalTeachers = 0;
        let totalClasses = 0;
        let totalFeeCollected = 0;
        let totalFeeDue = 0;
        let activeNotices = 0;
        
        // MongoDB - use aggregation for accurate counts
        try {
            const [studentCount, teacherCount, classCount, feeStats, noticeCount] = await Promise.all([
                Student.countDocuments({ ...filter, isActive: true }),
                User.countDocuments({ ...filter, role: 'teacher', isActive: true }),
                Class.countDocuments({ ...filter, isActive: true }),
                Fee.aggregate([
                    { $match: filter },
                    {
                        $group: {
                            _id: null,
                            totalCollected: { $sum: '$amountPaid' },
                            totalDue: { $sum: { $subtract: ['$amountDue', '$amountPaid'] } }
                        }
                    }
                ]),
                Notice.countDocuments({ ...filter, isActive: true })
            ]);
            
            totalStudents = studentCount || 0;
            totalTeachers = teacherCount || 0;
            totalClasses = classCount || 0;
            totalFeeCollected = feeStats[0]?.totalCollected || 0;
            totalFeeDue = feeStats[0]?.totalDue || 0;
            activeNotices = noticeCount || 0;
        } catch (dbError) {
            console.error('Dashboard data fetch error:', dbError.message);
            // Continue with zeros if DB query fails
        }

        const dashboard = {
            totalStudents,
            totalTeachers,
            totalClasses,
            totalFeeCollected,
            totalFeeDue,
            activeNotices,
            feeCollectionRate: totalFeeDue > 0 
                ? Math.round((totalFeeCollected / (totalFeeCollected + totalFeeDue)) * 100) 
                : 100,
            recentActivity: {
                newStudentsThisMonth: 0,
                newTeachersThisMonth: 0
            }
        };

        res.status(200).json({
            success: true,
            data: dashboard
        });
    } catch (error) {
        console.error('Principal dashboard error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
};

/**
 * @desc    Get attendance analytics
 * @route   GET /api/analytics/attendance
 * @access  Principal only
 */
exports.getAttendanceAnalytics = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        
        const analytics = {
            overallAttendance: 85,
            dailyAttendance: [],
            monthlyTrends: []
        };

        res.status(200).json({
            success: true,
            data: analytics
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * @desc    Get performance analytics
 * @route   GET /api/analytics/performance
 * @access  Principal only
 */
exports.getPerformanceAnalytics = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        
        const performance = {
            averageGPA: 3.2,
            subjectPerformance: [],
            classRankings: []
        };

        res.status(200).json({
            success: true,
            data: performance
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

/**
 * @desc    Get fee analytics
 * @route   GET /api/analytics/fees
 * @access  Principal only
 */
exports.getFeeAnalytics = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        
        const analytics = {
            totalCollected: 0,
            totalPending: 0,
            monthlyCollection: [],
            classWiseFees: []
        };

        res.status(200).json({
            success: true,
            data: analytics
        });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
