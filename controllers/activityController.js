const AuditLog = require('../models/AuditLog');
const User = require('../models/User');

const schoolActivityActions = [
    'ATTENDANCE_TAKEN', 'ATTENDANCE_UPDATED', 'ATTENDANCE_DELETED',
    'FEE_CREATED', 'FEE_UPDATED', 'FEE_DELETED',
    'NOTICE_CREATED', 'NOTICE_UPDATED', 'NOTICE_DELETED',
    'TEACHER_APPROVED', 'TEACHER_REJECTED',
    'SCHOOL_CREATED', 'SCHOOL_UPDATED', 'SCHOOL_DELETED',
    'ADMIT_CARD_DOWNLOADED', 'BULK_ADMIT_CARDS_DOWNLOADED'
];

exports.getActivityFeed = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        if (!schoolCode) {
            return res.status(400).json({ success: false, message: 'No school associated' });
        }

        if (req.user.role !== 'principal' && req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }

        const schoolUserIds = await User.find({ schoolCode }).select('_id').lean();
        const userIds = schoolUserIds.map(u => u._id);

        const { page = 1, limit = 30, action } = req.query;
        const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(50, parseInt(limit, 10) || 30);
        const limitNum = Math.min(50, parseInt(limit, 10) || 30);

        const query = {
            user: { $in: userIds },
            action: { $in: schoolActivityActions }
        };
        if (action) query.action = action;

        const logs = await AuditLog.find(query)
            .populate('user', 'name email role')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean();

        const total = await AuditLog.countDocuments(query);

        res.json({
            success: true,
            data: {
                activities: logs,
                total,
                page: parseInt(page, 10) || 1,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (err) {
        console.error('Activity feed error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch activity feed' });
    }
};
