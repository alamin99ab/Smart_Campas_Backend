const Notification = require('../models/Notification');

exports.getNotifications = async (req, res) => {
    try {
        const { page = 1, limit = 20, unreadOnly } = req.query;
        const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(50, parseInt(limit, 10) || 20);
        const limitNum = Math.min(50, parseInt(limit, 10) || 20);

        const query = { recipient: req.user._id };
        if (unreadOnly === 'true') query.read = false;

        const [notifications, unreadCount] = await Promise.all([
            Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
            Notification.countDocuments({ recipient: req.user._id, read: false })
        ]);

        res.json({
            success: true,
            data: {
                notifications,
                unreadCount,
                hasMore: notifications.length === limitNum
            }
        });
    } catch (err) {
        console.error('Get notifications error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch notifications' });
    }
};

exports.getUnreadCount = async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            recipient: req.user._id,
            read: false
        });
        res.json({ success: true, data: { count } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to get unread count' });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const notification = await Notification.findOne({
            _id: id,
            recipient: req.user._id
        });
        if (!notification) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }
        notification.read = true;
        notification.readAt = new Date();
        await notification.save();
        res.json({ success: true, data: notification });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update notification' });
    }
};

exports.markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user._id, read: false },
            { read: true, readAt: new Date() }
        );
        res.json({ success: true, message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update notifications' });
    }
};
