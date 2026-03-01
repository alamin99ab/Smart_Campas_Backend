// controllers/noticeController.js
const Notice = require('../models/Notice');
const School = require('../models/School');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

// Helper function to send notifications
const sendNoticeNotifications = async (notice, schoolId) => {
    try {
        await Notice.createNotificationsForNotice(notice);
    } catch (error) {
        console.error('Error sending notice notifications:', error);
    }
};

/**
 * @desc    Create a new notice
 * @route   POST /api/notices
 * @access  Private (Principal/Teacher/Super Admin)
 */
exports.createNotice = async (req, res) => {
    try {
        const {
            title,
            description,
            noticeType,
            targetType,
            targetRoles,
            targetClasses,
            targetSections,
            targetTeachers,
            targetSubjects,
            priority,
            publishDate,
            expiryDate,
            attachments,
            communicationSettings,
            contentFormat,
            richContent,
            requireAcknowledgment,
            acknowledgmentDeadline,
            allowComments,
            isPinned,
            pinOrder
        } = req.body;

        // Validation
        if (!title || !description || !noticeType) {
            return res.status(400).json({
                success: false,
                message: 'Title, description and notice type are required'
            });
        }

        let schoolId = null;
        let isGlobal = false;

        // Check if user is Super Admin creating global notice
        if (req.user.role === 'super_admin') {
            isGlobal = req.body.isGlobal || false;
            if (!isGlobal) {
                schoolId = req.body.schoolId;
                if (!schoolId) {
                    return res.status(400).json({
                        success: false,
                        message: 'School ID is required for non-global notices'
                    });
                }
            }
        } else {
            // For other roles, use tenant schoolId
            schoolId = req.tenant.schoolId;
        }

        // Validate target configuration
        if (targetType === 'class' && (!targetClasses || targetClasses.length === 0)) {
            return res.status(400).json({
                success: false,
                message: 'Target classes are required for class-specific notices'
            });
        }

        if (targetType === 'teacher' && (!targetTeachers || targetTeachers.length === 0)) {
            return res.status(400).json({
                success: false,
                message: 'Target teachers are required for teacher-specific notices'
            });
        }

        // Set status based on publish date
        const status = publishDate && new Date(publishDate) > new Date() ? 'scheduled' : 'active';

        // Create notice
        const notice = new Notice({
            schoolId,
            isGlobal,
            title,
            description,
            noticeType,
            targetType: targetType || 'all',
            targetRoles: targetRoles || ['teacher', 'student', 'parent'],
            targetClasses: targetClasses || [],
            targetSections: targetSections || [],
            targetTeachers: targetTeachers || [],
            targetSubjects: targetSubjects || [],
            priority: priority || 'medium',
            publishDate: publishDate ? new Date(publishDate) : new Date(),
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            attachments: attachments || [],
            communicationSettings: communicationSettings || {},
            contentFormat: contentFormat || 'plain',
            richContent,
            requireAcknowledgment: requireAcknowledgment || false,
            acknowledgmentDeadline: acknowledgmentDeadline ? new Date(acknowledgmentDeadline) : null,
            allowComments: allowComments || false,
            isPinned: isPinned || false,
            pinOrder: pinOrder || 0,
            status,
            createdBy: req.user.id
        });

        await notice.save();

        // Send notifications if active
        if (status === 'active') {
            await sendNoticeNotifications(notice, schoolId);
        }

        // Audit log
        await AuditLog.create({
            action: 'create_notice',
            resource: 'notice',
            resourceId: notice._id,
            userId: req.user.id,
            userRole: req.user.role,
            schoolId,
            details: {
                title,
                noticeType,
                targetType,
                isGlobal
            },
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        res.status(201).json({
            success: true,
            message: 'Notice created successfully',
            data: notice
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

// Add missing functions for route imports
exports.acknowledgeNotice = async (req, res) => {
    try {
        const notice = await Notice.findById(req.params.id);
        if (!notice) {
            return res.status(404).json({ success: false, message: 'Notice not found' });
        }
        
        res.status(200).json({
            success: true,
            message: 'Notice acknowledged',
            data: notice
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

exports.addComment = async (req, res) => {
    try {
        const { comment } = req.body;
        const notice = await Notice.findById(req.params.id);
        
        if (!notice) {
            return res.status(404).json({ success: false, message: 'Notice not found' });
        }
        
        res.status(200).json({
            success: true,
            message: 'Comment added',
            data: { comment, notice }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

exports.getNoticeAnalytics = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        const totalNotices = await Notice.countDocuments({ schoolCode });
        const activeNotices = await Notice.countDocuments({ schoolCode, isActive: true });
        
        res.status(200).json({
            success: true,
            data: {
                totalNotices,
                activeNotices,
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

exports.pinNotice = async (req, res) => {
    try {
        const notice = await Notice.findById(req.params.id);
        if (!notice) {
            return res.status(404).json({ success: false, message: 'Notice not found' });
        }
        
        notice.isPinned = !notice.isPinned;
        await notice.save();
        
        res.status(200).json({
            success: true,
            message: `Notice ${notice.isPinned ? 'pinned' : 'unpinned'}`,
            data: notice
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Helper function to send notifications (updated version)
const sendNoticeNotificationsUpdated = async (notice, schoolCode) => {
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

/**
 * @desc    Get student notices
 * @route   GET /api/notices/student
 * @access  Student only
 */
exports.getStudentNotices = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        const studentRole = req.user.role;

        const notices = await Notice.find({
            schoolCode,
            isActive: true,
            $or: [
                { targetRoles: { $in: [studentRole] } },
                { targetRoles: { $size: 0 } }
            ]
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: notices
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
 * @desc    Get unread notices
 * @route   GET /api/notices/unread
 * @access  Student only
 */
exports.getUnreadNotices = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        const studentRole = req.user.role;

        const notices = await Notice.find({
            schoolCode,
            isActive: true,
            $or: [
                { targetRoles: { $in: [studentRole] } },
                { targetRoles: { $size: 0 } }
            ]
        }).sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: notices
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
 * @desc    Mark notice as read
 * @route   PUT /api/notices/:id/read
 * @access  Student only
 */
exports.markNoticeAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        res.status(200).json({
            success: true,
            message: 'Notice marked as read',
            data: { noticeId: id, readBy: userId }
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
 * @desc    Get notice by ID
 * @route   GET /api/notices/:id
 * @access  Private
 */
exports.getNoticeById = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolCode = req.user.schoolCode;

        const notice = await Notice.findOne({ _id: id, schoolCode });

        if (!notice) {
            return res.status(404).json({
                success: false,
                message: 'Notice not found'
            });
        }

        res.status(200).json({
            success: true,
            data: notice
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
 * @desc    Publish notice
 * @route   POST /api/notices/:id/publish
 * @access  Private
 */
exports.publishNotice = async (req, res) => {
    try {
        const { id } = req.params;
        const schoolCode = req.user.schoolCode;

        const notice = await Notice.findOneAndUpdate(
            { _id: id, schoolCode },
            { isPublished: true, publishedAt: new Date() },
            { new: true }
        );

        if (!notice) {
            return res.status(404).json({
                success: false,
                message: 'Notice not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Notice published successfully',
            data: notice
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};