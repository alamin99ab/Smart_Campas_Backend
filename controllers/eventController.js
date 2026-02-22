const SchoolEvent = require('../models/SchoolEvent');
const User = require('../models/User');

const allowedRoles = ['principal', 'admin', 'teacher'];

exports.createEvent = async (req, res) => {
    try {
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        const schoolCode = req.user.schoolCode;
        const { title, description, type, startDate, endDate, allDay, location, targetRoles, targetClasses } = req.body;

        if (!title || !startDate) {
            return res.status(400).json({ success: false, message: 'Title and start date are required' });
        }

        const event = await SchoolEvent.create({
            schoolCode,
            title,
            description,
            type: type || 'event',
            startDate: new Date(startDate),
            endDate: endDate ? new Date(endDate) : undefined,
            allDay: allDay !== false,
            location,
            targetRoles: targetRoles || [],
            targetClasses: targetClasses || [],
            createdBy: req.user._id
        });

        res.status(201).json({ success: true, data: event });
    } catch (err) {
        console.error('Create event error:', err);
        res.status(500).json({ success: false, message: 'Failed to create event' });
    }
};

exports.getEvents = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        const { from, to, type } = req.query;

        const query = { schoolCode, isActive: true };
        if (from || to) {
            query.startDate = {};
            if (from) query.startDate.$gte = new Date(from);
            if (to) query.startDate.$lte = new Date(to);
        }
        if (type) query.type = type;

        const events = await SchoolEvent.find(query)
            .populate('createdBy', 'name')
            .sort({ startDate: 1 })
            .lean();

        res.json({ success: true, data: events });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch events' });
    }
};

exports.getEventById = async (req, res) => {
    try {
        const event = await SchoolEvent.findOne({
            _id: req.params.id,
            schoolCode: req.user.schoolCode
        }).populate('createdBy', 'name email').lean();

        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }
        res.json({ success: true, data: event });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to fetch event' });
    }
};

exports.updateEvent = async (req, res) => {
    try {
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        const event = await SchoolEvent.findOne({
            _id: req.params.id,
            schoolCode: req.user.schoolCode
        });
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        const { title, description, type, startDate, endDate, allDay, location, targetRoles, targetClasses, isActive } = req.body;
        if (title !== undefined) event.title = title;
        if (description !== undefined) event.description = description;
        if (type !== undefined) event.type = type;
        if (startDate !== undefined) event.startDate = new Date(startDate);
        if (endDate !== undefined) event.endDate = endDate ? new Date(endDate) : undefined;
        if (allDay !== undefined) event.allDay = allDay;
        if (location !== undefined) event.location = location;
        if (targetRoles !== undefined) event.targetRoles = targetRoles;
        if (targetClasses !== undefined) event.targetClasses = targetClasses;
        if (isActive !== undefined) event.isActive = isActive;
        event.updatedBy = req.user._id;
        await event.save();

        res.json({ success: true, data: event });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update event' });
    }
};

exports.deleteEvent = async (req, res) => {
    try {
        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        const result = await SchoolEvent.deleteOne({
            _id: req.params.id,
            schoolCode: req.user.schoolCode
        });
        if (result.deletedCount === 0) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }
        res.json({ success: true, message: 'Event deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to delete event' });
    }
};
