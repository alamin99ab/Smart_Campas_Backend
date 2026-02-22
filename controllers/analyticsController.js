const User = require('../models/User');
const Student = require('../models/Student');
const Attendance = require('../models/Attendance');
const Fee = require('../models/Fee');
const Notice = require('../models/Notice');

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
        res.status(500).json({ success: false, message: 'Failed to load analytics' });
    }
};
