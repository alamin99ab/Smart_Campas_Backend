const Student = require('../models/Student');
const Notice = require('../models/Notice');
const User = require('../models/User');

exports.globalSearch = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        const q = (req.query.q || '').trim().slice(0, 100);
        const type = (req.query.type || 'all').toLowerCase();
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));

        if (!q || q.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Search query must be at least 2 characters'
            });
        }

        const searchRegex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const results = { students: [], notices: [], teachers: [] };

        if (type === 'all' || type === 'students') {
            results.students = await Student.find({
                schoolCode,
                isActive: true,
                $or: [
                    { name: searchRegex },
                    { fatherName: searchRegex },
                    { motherName: searchRegex },
                    { 'guardian.name': searchRegex }
                ]
            })
                .select('name roll studentClass section guardian')
                .limit(limit)
                .lean();
        }

        if (type === 'all' || type === 'notices') {
            results.notices = await Notice.find({
                schoolCode,
                $or: [
                    { title: searchRegex },
                    { content: searchRegex }
                ]
            })
                .select('title category priority createdAt')
                .sort({ createdAt: -1 })
                .limit(limit)
                .lean();
        }

        if ((type === 'all' || type === 'teachers') && (req.user.role === 'principal' || req.user.role === 'admin')) {
            results.teachers = await User.find({
                schoolCode,
                role: 'teacher',
                $or: [
                    { name: searchRegex },
                    { email: searchRegex }
                ]
            })
                .select('name email isApproved')
                .limit(limit)
                .lean();
        }

        res.json({
            success: true,
            data: results
        });
    } catch (err) {
        console.error('Search error:', err);
        res.status(500).json({ success: false, message: 'Search failed' });
    }
};
