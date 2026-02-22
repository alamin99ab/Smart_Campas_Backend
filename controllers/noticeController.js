// controllers/noticeController.js
const Notice = require('../models/Notice');
const School = require('../models/School');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { sendPushNotification } = require('../utils/notificationService');
const { sendEmail } = require('../utils/emailService');
const { createNotification } = require('../utils/createNotification');

// @desc    Create a new notice
// @route   POST /api/notices
// @access  Private (Principal/Teacher/Admin)
exports.createNotice = async (req, res) => {
    try {
        const { title, content, category, targetRoles, targetClasses, attachments, priority, expiryDate } = req.body;

        // Validation
        if (!title || !content || !category) {
            return res.status(400).json({ message: 'Title, content and category are required' });
        }

        // Check if school exists
        const school = await School.findOne({ schoolCode: req.user.schoolCode });
        if (!school) {
            return res.status(404).json({ message: 'School not found' });
        }

        // Create notice
        const notice = await Notice.create({
            title,
            content,
            category,
            priority: priority || 'normal',
            schoolCode: req.user.schoolCode,
            addedBy: req.user._id,
            targetRoles: targetRoles || ['teacher', 'student', 'parent'],
            targetClasses: targetClasses || [],
            attachments: attachments || [],
            expiryDate: expiryDate || null,
            isActive: true
        });

        // Send notifications based on target
        await sendNoticeNotifications(notice, req.user.schoolCode);

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'NOTICE_CREATED',
            details: { 
                noticeId: notice._id,
                title: notice.title,
                category: notice.category
            },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(201).json({
            message: 'Notice created successfully',
            notice
        });

    } catch (error) {
        console.error('Create notice error:', error);
        res.status(500).json({ message: 'Failed to create notice' });
    }
};

// @desc    Get all notices for a school
// @route   GET /api/notices/school/:schoolCode
// @access  Private
exports.getNotices = async (req, res) => {
    try {
        const { schoolCode } = req.params;
        const { page = 1, limit = 20, category, priority, isActive } = req.query;

        // Use provided schoolCode or fall back to user's schoolCode
        const targetSchoolCode = schoolCode || req.user.schoolCode;

        // Build query
        const query = { schoolCode: targetSchoolCode };
        
        if (category) query.category = category;
        if (priority) query.priority = priority;
        if (isActive !== undefined) query.isActive = isActive === 'true';

        // Add role-based filtering
        if (req.user.role !== 'admin' && req.user.role !== 'principal') {
            query.$or = [
                { targetRoles: { $in: [req.user.role] } },
                { targetRoles: { $size: 0 } }
            ];
        }

        // Pagination
        const skip = (page - 1) * limit;

        const notices = await Notice.find(query)
            .populate('addedBy', 'name email role')
            .sort({ priority: -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await Notice.countDocuments(query);

        // Get active notices count
        const activeCount = await Notice.countDocuments({ 
            schoolCode, 
            isActive: true,
            $or: [
                { expiryDate: { $gt: new Date() } },
                { expiryDate: null }
            ]
        });

        res.json({
            notices,
            total,
            activeCount,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });

    } catch (error) {
        console.error('Get notices error:', error);
        res.status(500).json({ message: 'Failed to fetch notices' });
    }
};

// @desc    Get single notice
// @route   GET /api/notices/:id
// @access  Private
exports.getNotice = async (req, res) => {
    try {
        const notice = await Notice.findById(req.params.id)
            .populate('addedBy', 'name email role')
            .populate('updatedBy', 'name email role');

        if (!notice) {
            return res.status(404).json({ message: 'Notice not found' });
        }

        // Check school access
        if (notice.schoolCode !== req.user.schoolCode && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Increment view count
        notice.views += 1;
        await notice.save();

        res.json(notice);

    } catch (error) {
        console.error('Get notice error:', error);
        res.status(500).json({ message: 'Failed to fetch notice' });
    }
};

// @desc    Update notice
// @route   PUT /api/notices/:id
// @access  Private (Principal/Admin/Owner)
exports.updateNotice = async (req, res) => {
    try {
        const { title, content, category, targetRoles, targetClasses, attachments, priority, expiryDate, isActive } = req.body;

        const notice = await Notice.findById(req.params.id);

        if (!notice) {
            return res.status(404).json({ message: 'Notice not found' });
        }

        // Check permission
        if (notice.schoolCode !== req.user.schoolCode && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (req.user.role !== 'admin' && req.user.role !== 'principal' && 
            notice.addedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied. Only creator can update.' });
        }

        // Update fields
        if (title) notice.title = title;
        if (content) notice.content = content;
        if (category) notice.category = category;
        if (targetRoles) notice.targetRoles = targetRoles;
        if (targetClasses) notice.targetClasses = targetClasses;
        if (attachments) notice.attachments = attachments;
        if (priority) notice.priority = priority;
        if (expiryDate !== undefined) notice.expiryDate = expiryDate;
        if (isActive !== undefined) notice.isActive = isActive;

        notice.updatedBy = req.user._id;
        notice.updatedAt = Date.now();

        await notice.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'NOTICE_UPDATED',
            details: { 
                noticeId: notice._id,
                title: notice.title
            },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            message: 'Notice updated successfully',
            notice
        });

    } catch (error) {
        console.error('Update notice error:', error);
        res.status(500).json({ message: 'Failed to update notice' });
    }
};

// @desc    Delete notice
// @route   DELETE /api/notices/:id
// @access  Private (Principal/Admin/Owner)
exports.deleteNotice = async (req, res) => {
    try {
        const notice = await Notice.findById(req.params.id);

        if (!notice) {
            return res.status(404).json({ message: 'Notice not found' });
        }

        // Check permission
        if (notice.schoolCode !== req.user.schoolCode && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        if (req.user.role !== 'admin' && req.user.role !== 'principal' && 
            notice.addedBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: 'Access denied. Only creator can delete.' });
        }

        // Soft delete or hard delete?
        // Using soft delete (mark as inactive)
        notice.isActive = false;
        await notice.save();

        // Alternative: Hard delete
        // await notice.deleteOne();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'NOTICE_DELETED',
            details: { 
                noticeId: notice._id,
                title: notice.title
            },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ message: 'Notice deleted successfully' });

    } catch (error) {
        console.error('Delete notice error:', error);
        res.status(500).json({ message: 'Failed to delete notice' });
    }
};

// @desc    Get notices by category
// @route   GET /api/notices/category/:category
// @access  Private
exports.getNoticesByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const query = {
            schoolCode: req.user.schoolCode,
            category,
            isActive: true,
            $or: [
                { expiryDate: { $gt: new Date() } },
                { expiryDate: null }
            ]
        };

        const notices = await Notice.find(query)
            .populate('addedBy', 'name')
            .sort({ priority: -1, createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Notice.countDocuments(query);

        res.json({
            notices,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });

    } catch (error) {
        console.error('Get notices by category error:', error);
        res.status(500).json({ message: 'Failed to fetch notices' });
    }
};

// @desc    Get important notices (high priority)
// @route   GET /api/notices/important
// @access  Private
exports.getImportantNotices = async (req, res) => {
    try {
        const notices = await Notice.find({
            schoolCode: req.user.schoolCode,
            priority: { $in: ['high', 'urgent'] },
            isActive: true,
            $or: [
                { expiryDate: { $gt: new Date() } },
                { expiryDate: null }
            ]
        })
        .populate('addedBy', 'name')
        .sort({ createdAt: -1 })
        .limit(10);

        res.json(notices);

    } catch (error) {
        console.error('Get important notices error:', error);
        res.status(500).json({ message: 'Failed to fetch important notices' });
    }
};

// @desc    Get my notices (created by me)
// @route   GET /api/notices/my
// @access  Private
exports.getMyNotices = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        const notices = await Notice.find({
            schoolCode: req.user.schoolCode,
            addedBy: req.user._id
        })
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

        const total = await Notice.countDocuments({
            schoolCode: req.user.schoolCode,
            addedBy: req.user._id
        });

        res.json({
            notices,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: page
        });

    } catch (error) {
        console.error('Get my notices error:', error);
        res.status(500).json({ message: 'Failed to fetch notices' });
    }
};

// @desc    Archive expired notices
// @route   POST /api/notices/archive-expired
// @access  Private (Admin/Principal)
exports.archiveExpiredNotices = async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'principal') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const result = await Notice.updateMany(
            {
                schoolCode: req.user.schoolCode,
                expiryDate: { $lt: new Date() },
                isActive: true
            },
            { isActive: false }
        );

        res.json({
            message: `${result.modifiedCount} notices archived`,
            count: result.modifiedCount
        });

    } catch (error) {
        console.error('Archive expired notices error:', error);
        res.status(500).json({ message: 'Failed to archive notices' });
    }
};

// Helper function to send notifications
const sendNoticeNotifications = async (notice, schoolCode) => {
    try {
        const targetUsers = await User.find({
            schoolCode,
            role: { $in: notice.targetRoles },
            isActive: true
        }).select('_id email fcmToken');

        const recipientIds = targetUsers.map(u => u._id);
        if (recipientIds.length > 0) {
            await createNotification({
                title: 'New Notice: ' + notice.title,
                body: (notice.content || '').substring(0, 150),
                type: 'notice',
                link: `/notices/${notice._id}`,
                data: { noticeId: String(notice._id) },
                schoolCode,
                recipients: recipientIds
            });
        }

        // Send push notifications (if FCM tokens exist)
        const fcmTokens = targetUsers
            .filter(u => u.fcmToken)
            .map(u => u.fcmToken);

        if (fcmTokens.length > 0 && notice.priority !== 'low') {
            await sendPushNotification({
                tokens: fcmTokens,
                title: 'New Notice: ' + notice.title,
                body: notice.content.substring(0, 100) + '...',
                data: { noticeId: notice._id, type: 'notice' }
            });
        }

        // Send emails for high priority notices
        if (notice.priority === 'high' || notice.priority === 'urgent') {
            const emailPromises = targetUsers
                .filter(u => u.email)
                .map(u => 
                    sendEmail({
                        to: u.email,
                        subject: `[${notice.priority.toUpperCase()}] New Notice: ${notice.title}`,
                        template: 'notice-alert',
                        data: {
                            title: notice.title,
                            content: notice.content,
                            category: notice.category
                        }
                    }).catch(err => console.error('Email error:', err))
                );

            await Promise.all(emailPromises);
        }

    } catch (error) {
        console.error('Send notice notifications error:', error);
    }
};