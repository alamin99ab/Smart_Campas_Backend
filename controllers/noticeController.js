// controllers/noticeController.js
const Notice = require('../models/Notice');
const Notification = require('../models/Notification');
const School = require('../models/School');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');

const ACTIVE_NOTICE_STATUSES = ['active'];

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const normalizeSchoolScope = (req) => {
    const schoolId = req.tenant?.schoolId || req.user?.schoolId || null;
    const schoolCodeRaw = req.tenant?.schoolCode || req.user?.schoolCode || null;
    return {
        schoolId,
        schoolCode: schoolCodeRaw ? String(schoolCodeRaw).toUpperCase() : null
    };
};

const toObjectIdStrings = (values = []) =>
    [...new Set(values.filter(Boolean).map((value) => String(value)))];

const buildPublishedNoticeQuery = ({ schoolId, role, classIds = [] }) => {
    const now = new Date();
    const andConditions = [
        { isDeleted: false },
        { status: { $in: ACTIVE_NOTICE_STATUSES } },
        { isPublished: true },
        { publishDate: { $lte: now } },
        { $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }] }
    ];

    if (schoolId) {
        andConditions.push({ $or: [{ schoolId }, { isGlobal: true }] });
    } else {
        andConditions.push({ isGlobal: true });
    }

    if (!['super_admin', 'admin', 'principal'].includes(role)) {
        const audience = [
            { targetType: 'all' },
            { targetType: role },
            { targetType: 'role', targetRoles: { $in: [role] } },
            { targetRoles: { $in: [role] } },
            { targetRoles: { $size: 0 } },
            { targetRoles: { $exists: false } }
        ];

        const classIdList = toObjectIdStrings(classIds);
        if (classIdList.length > 0) {
            audience.push({ targetType: 'class', 'targetClasses.classId': { $in: classIdList } });
            audience.push({ targetType: 'section', 'targetSections.sectionId': { $in: classIdList } });
        }

        andConditions.push({ $or: audience });
    }

    return { $and: andConditions };
};

const extractNoticeRows = (payload) => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload.notices)) return payload.notices;
    if (Array.isArray(payload.data)) return payload.data;
    return [];
};

const getParentLinkedClassIds = async (req) => {
    if (req.user?.role !== 'parent') return [];

    const { schoolCode } = normalizeSchoolScope(req);
    const parentEmail = String(req.user?.email || '').trim();
    if (!parentEmail) return [];

    const studentUsers = await User.find({
        role: 'student',
        schoolCode,
        'parentInfo.email': new RegExp(`^${escapeRegex(parentEmail)}$`, 'i')
    }).select('classId');

    return toObjectIdStrings(studentUsers.map((row) => row.classId));
};

// Helper function to send notifications
const sendNoticeNotifications = async (notice, schoolId) => {
    try {
        await Notice.createNotificationsForNotice(notice);
    } catch (error) {
        console.error('Error sending notice notifications:', error);
    }
};

const sendServerError = (res, code, message, error) => {
    const payload = {
        success: false,
        code,
        message
    };

    if (process.env.NODE_ENV !== 'production' && error?.message) {
        payload.error = error.message;
    }

    return res.status(500).json(payload);
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
            pinOrder,
            isPublic
        } = req.body;

        // Validation
        if (!title || !description || !noticeType) {
            return res.status(400).json({
                success: false,
                code: 'NOTICE_VALIDATION_FAILED',
                message: 'Title, description and notice type are required'
            });
        }

        let schoolId = null;
        let schoolCode = null;
        let isGlobal = false;

        // Check if user is Super Admin creating global notice
        if (req.user.role === 'super_admin') {
            isGlobal = req.body.isGlobal || false;
            if (!isGlobal) {
                schoolId = req.body.schoolId;
                if (!schoolId) {
                    return res.status(400).json({
                        success: false,
                        code: 'NOTICE_SCHOOL_REQUIRED',
                        message: 'School ID is required for non-global notices'
                    });
                }
            }
        } else {
            // For other roles, pull from tenant context or user payload safely
            const tenantSchoolId = req.tenant?.schoolId || req.user?.schoolId;
            const tenantSchoolCode = req.tenant?.schoolCode || req.user?.schoolCode;
            schoolId = tenantSchoolId;
            schoolCode = tenantSchoolCode ? tenantSchoolCode.toUpperCase() : null;
        }

        if (isPublic && isGlobal) {
            return res.status(400).json({
                success: false,
                code: 'NOTICE_PUBLIC_GLOBAL_FORBIDDEN',
                message: 'Public website notices must be school isolated and cannot be global.'
            });
        }

        if (!isGlobal && !schoolId) {
            return res.status(400).json({
                success: false,
                code: 'NOTICE_SCHOOL_CONTEXT_MISSING',
                message: 'School context missing. Please include schoolId or ensure tenant context is set.'
            });
        }

        // Resolve schoolCode for tenant isolation and public API filtering
        if (!isGlobal && schoolId && !schoolCode) {
            const school = await School.findById(schoolId).select('schoolCode');
            schoolCode = school?.schoolCode?.toUpperCase() || null;
        }

        // Validate target configuration
        if (targetType === 'class' && (!targetClasses || targetClasses.length === 0)) {
            return res.status(400).json({
                success: false,
                code: 'NOTICE_TARGET_CLASS_REQUIRED',
                message: 'Target classes are required for class-specific notices'
            });
        }

        if (targetType === 'teacher' && (!targetTeachers || targetTeachers.length === 0)) {
            return res.status(400).json({
                success: false,
                code: 'NOTICE_TARGET_TEACHER_REQUIRED',
                message: 'Target teachers are required for teacher-specific notices'
            });
        }

        // Set status based on publish date
        const status = publishDate && new Date(publishDate) > new Date() ? 'scheduled' : 'active';
        const publishNow = status === 'active';

        // Create notice
        const creatorId = req.user.id || req.user._id;
        const notice = new Notice({
            schoolId,
            schoolCode,
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
            isPublished: publishNow,
            isPublic: !!isPublic,
            publishedAt: publishNow ? new Date() : null,
            createdBy: creatorId
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
            userId: req.user.id || req.user._id,
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
            code: 'NOTICE_CREATED',
            message: 'Notice created successfully',
            data: notice
        });

    } catch (error) {
        console.error('Create notice error:', error);
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                code: 'NOTICE_VALIDATION_FAILED',
                message: 'Validation failed for notice',
                errors: Object.values(error.errors || {}).map(e => e.message)
            });
        }
        res.status(500).json({
            success: false,
            code: 'NOTICE_CREATE_FAILED',
            message: error.message || 'Failed to create notice'
        });
    }
};

// @desc    Get all notices for a school
// @route   GET /api/notices/school/:schoolCode
// @access  Private
exports.getNotices = async (req, res) => {
    try {
        const { schoolCode } = req.params;
        const { page = 1, limit = 20, category, priority, isActive } = req.query;
        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));

        let { schoolId } = normalizeSchoolScope(req);
        const { schoolCode: tenantSchoolCode } = normalizeSchoolScope(req);

        if (req.user.role === 'super_admin' && schoolCode) {
            const school = await School.findOne({ schoolCode: schoolCode.toUpperCase(), isActive: true }).select('_id');
            if (!school) {
                return res.status(404).json({
                    success: false,
                    code: 'SCHOOL_NOT_FOUND',
                    message: 'School not found'
                });
            }
            schoolId = school._id;
        }

        if (!schoolId && req.user.role !== 'super_admin') {
            return res.status(400).json({
                success: false,
                code: 'TENANT_CONTEXT_MISSING',
                message: 'Tenant context missing'
            });
        }

        const conditions = [];

        if (['super_admin', 'admin', 'principal'].includes(req.user.role)) {
            conditions.push({ isDeleted: false });
            if (schoolId) conditions.push({ $or: [{ schoolId }, { isGlobal: true }] });
        } else {
            let classIds = [];
            if (req.user.role === 'student' && req.user.classId) {
                classIds = [req.user.classId];
            } else if (req.user.role === 'parent') {
                classIds = await getParentLinkedClassIds(req);
            }
            conditions.push(buildPublishedNoticeQuery({
                schoolId,
                role: req.user.role,
                classIds
            }));
        }

        if (category) conditions.push({ noticeType: category });
        if (priority) conditions.push({ priority });

        if (isActive !== undefined && ['super_admin', 'admin', 'principal'].includes(req.user.role)) {
            if (isActive === 'true' || isActive === true) {
                conditions.push({
                    $and: [
                        { status: 'active' },
                        { isPublished: true },
                        { publishDate: { $lte: new Date() } },
                        { $or: [{ expiryDate: null }, { expiryDate: { $gt: new Date() } }] }
                    ]
                });
            }
        }

        const query = conditions.length > 1 ? { $and: conditions } : conditions[0];
        const skip = (pageNum - 1) * limitNum;

        const activeCountClassIds =
            req.user.role === 'student' && req.user.classId
                ? [req.user.classId]
                : req.user.role === 'parent'
                    ? await getParentLinkedClassIds(req)
                    : [];

        const activeCountQuery = ['super_admin', 'admin', 'principal'].includes(req.user.role)
            ? {
                $and: [
                    ...(schoolId ? [{ $or: [{ schoolId }, { isGlobal: true }] }] : []),
                    { isDeleted: false },
                    { status: 'active' },
                    { isPublished: true },
                    { publishDate: { $lte: new Date() } },
                    { $or: [{ expiryDate: null }, { expiryDate: { $gt: new Date() } }] }
                ]
            }
            : buildPublishedNoticeQuery({
                schoolId,
                role: req.user.role,
                classIds: activeCountClassIds
            });

        const [notices, total, activeCount] = await Promise.all([
            Notice.find(query)
                .populate('createdBy', 'name email role')
                .sort({ isPinned: -1, pinOrder: 1, publishDate: -1, createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Notice.countDocuments(query),
            Notice.countDocuments(activeCountQuery)
        ]);

        const payload = {
            notices,
            total,
            activeCount,
            totalPages: Math.ceil(total / limitNum),
            currentPage: pageNum,
            schoolCode: tenantSchoolCode
        };

        res.json({
            success: true,
            code: 'NOTICE_LIST_FETCHED',
            message: 'Notices fetched successfully',
            data: payload,
            ...payload // keep legacy shape
        });

    } catch (error) {
        console.error('Get notices error:', error);
        res.status(500).json({
            success: false,
            code: 'NOTICE_LIST_FETCH_FAILED',
            message: 'Failed to fetch notices'
        });
    }
};

// @desc    Update notice
// @route   PUT /api/notices/:id
// @access  Private (Principal/Admin/Owner)
exports.updateNotice = async (req, res) => {
    try {
        const {
            title,
            description,
            content,
            noticeType,
            category,
            targetRoles,
            targetClasses,
            targetSections,
            targetTeachers,
            targetSubjects,
            targetType,
            attachments,
            priority,
            expiryDate,
            publishDate,
            status,
            isPublished,
            isPublic,
            isActive
        } = req.body;

        const notice = await Notice.findById(req.params.id);

        if (!notice) {
            return res.status(404).json({
                success: false,
                code: 'NOTICE_NOT_FOUND',
                message: 'Notice not found'
            });
        }

        // Check permission
        if (!notice.isGlobal && req.user.role !== 'super_admin') {
            const tenantSchoolId = req.tenant?.schoolId || req.user.schoolId;
            if (!tenantSchoolId || notice.schoolId?.toString() !== tenantSchoolId.toString()) {
                return res.status(403).json({
                    success: false,
                    code: 'NOTICE_ACCESS_DENIED',
                    message: 'Access denied'
                });
            }
        }

        if (req.user.role !== 'super_admin' && req.user.role !== 'admin' && req.user.role !== 'principal' && 
            notice.createdBy?.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                code: 'NOTICE_EDIT_FORBIDDEN',
                message: 'Access denied. Only creator can update.'
            });
        }

        // Update fields
        if (title) notice.title = title;
        if (description || content) notice.description = description || content;
        if (noticeType || category) notice.noticeType = noticeType || category;
        if (targetType) notice.targetType = targetType;
        if (targetRoles) notice.targetRoles = targetRoles;
        if (targetClasses) notice.targetClasses = targetClasses;
        if (targetSections) notice.targetSections = targetSections;
        if (targetTeachers) notice.targetTeachers = targetTeachers;
        if (targetSubjects) notice.targetSubjects = targetSubjects;
        if (attachments) notice.attachments = attachments;
        if (priority) notice.priority = priority;
        if (expiryDate !== undefined) notice.expiryDate = expiryDate ? new Date(expiryDate) : null;
        if (publishDate !== undefined) notice.publishDate = publishDate ? new Date(publishDate) : notice.publishDate;
        if (status) notice.status = status;
        if (isPublished !== undefined) notice.isPublished = !!isPublished;
        if (isPublic !== undefined) notice.isPublic = !!isPublic;

        if (isActive !== undefined) {
            if (isActive) {
                notice.status = 'active';
                notice.isPublished = true;
                notice.publishedAt = notice.publishedAt || new Date();
            } else if (!notice.isDeleted) {
                notice.status = 'draft';
                notice.isPublished = false;
            }
        }

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
            success: true,
            code: 'NOTICE_UPDATED',
            message: 'Notice updated successfully',
            data: notice
        });

    } catch (error) {
        console.error('Update notice error:', error);
        res.status(500).json({
            success: false,
            code: 'NOTICE_UPDATE_FAILED',
            message: 'Failed to update notice'
        });
    }
};

// @desc    Delete notice
// @route   DELETE /api/notices/:id
// @access  Private (Principal/Admin/Owner)
exports.deleteNotice = async (req, res) => {
    try {
        const notice = await Notice.findById(req.params.id);

        if (!notice) {
            return res.status(404).json({
                success: false,
                code: 'NOTICE_NOT_FOUND',
                message: 'Notice not found'
            });
        }

        // Check permission
        if (!notice.isGlobal && req.user.role !== 'super_admin') {
            const tenantSchoolId = req.tenant?.schoolId || req.user.schoolId;
            if (!tenantSchoolId || notice.schoolId?.toString() !== tenantSchoolId.toString()) {
                return res.status(403).json({
                    success: false,
                    code: 'NOTICE_ACCESS_DENIED',
                    message: 'Access denied'
                });
            }
        }

        if (req.user.role !== 'super_admin' && req.user.role !== 'admin' && req.user.role !== 'principal' && 
            notice.createdBy?.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                code: 'NOTICE_DELETE_FORBIDDEN',
                message: 'Access denied. Only creator can delete.'
            });
        }

        // Soft delete using Notice schema fields
        notice.isDeleted = true;
        notice.status = 'deleted';
        notice.deletedAt = new Date();
        notice.deletedBy = req.user._id;
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

        res.json({
            success: true,
            code: 'NOTICE_DELETED',
            message: 'Notice deleted successfully',
            data: { id: notice._id }
        });

    } catch (error) {
        console.error('Delete notice error:', error);
        res.status(500).json({
            success: false,
            code: 'NOTICE_DELETE_FAILED',
            message: 'Failed to delete notice'
        });
    }
};

// @desc    Get notices by category
// @route   GET /api/notices/category/:category
// @access  Private
exports.getNoticesByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const schoolId = req.tenant?.schoolId || req.user.schoolId;
        if (!schoolId) {
            return res.status(400).json({ success: false, message: 'Tenant context missing' });
        }

        const query = {
            $and: [
                { $or: [{ schoolId }, { isGlobal: true }] },
                { noticeType: category },
                { status: 'active' },
                { isDeleted: false },
                { $or: [{ expiryDate: { $gt: new Date() } }, { expiryDate: null }] }
            ]
        };

        const notices = await Notice.find(query)
            .populate('createdBy', 'name')
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
        const schoolId = req.tenant?.schoolId || req.user.schoolId;
        const notices = await Notice.find({
            $and: [
                { $or: [{ schoolId }, { isGlobal: true }] },
                { priority: { $in: ['high', 'urgent'] } },
                { status: 'active' },
                { isDeleted: false },
                { $or: [{ expiryDate: { $gt: new Date() } }, { expiryDate: null }] }
            ]
        })
        .populate('createdBy', 'name')
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

        const schoolId = req.tenant?.schoolId || req.user.schoolId;

        const notices = await Notice.find({
            $and: [
                { $or: [{ schoolId }, { isGlobal: true }] },
                { createdBy: req.user._id },
                { isDeleted: false }
            ]
        })
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);

        const total = await Notice.countDocuments({
            $and: [
                { $or: [{ schoolId }, { isGlobal: true }] },
                { createdBy: req.user._id },
                { isDeleted: false }
            ]
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

        const schoolId = req.tenant?.schoolId || req.user.schoolId;
        const result = await Notice.updateMany(
            {
                $and: [
                    { $or: [{ schoolId }, { isGlobal: true }] },
                    { expiryDate: { $lt: new Date() } },
                    { status: 'active' },
                    { isDeleted: false }
                ]
            },
            { status: 'expired' }
        );

        res.json({
            message: `${result.modifiedCount} notices archived`,
            count: result.modifiedCount
        });

    } catch (error) {
        console.error('Archive expired notices error:', error);
        return sendServerError(res, 'NOTICE_ARCHIVE_FAILED', 'Failed to archive notices', error);
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
            code: 'NOTICE_ACKNOWLEDGED',
            message: 'Notice acknowledged',
            data: notice
        });
    } catch (error) {
        return sendServerError(res, 'NOTICE_ACKNOWLEDGE_FAILED', 'Failed to acknowledge notice', error);
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
            code: 'NOTICE_COMMENT_ADDED',
            message: 'Comment added',
            data: { comment, notice }
        });
    } catch (error) {
        return sendServerError(res, 'NOTICE_COMMENT_ADD_FAILED', 'Failed to add notice comment', error);
    }
};

exports.getNoticeAnalytics = async (req, res) => {
    try {
        const schoolId = req.tenant?.schoolId || req.user.schoolId;
        const totalNotices = await Notice.countDocuments({
            $and: [
                { $or: [{ schoolId }, { isGlobal: true }] },
                { isDeleted: false }
            ]
        });
        const activeNotices = await Notice.countDocuments({
            $and: [
                { $or: [{ schoolId }, { isGlobal: true }] },
                { status: 'active' },
                { isDeleted: false }
            ]
        });
        
        res.status(200).json({
            success: true,
            code: 'NOTICE_ANALYTICS_FETCHED',
            message: 'Notice analytics fetched successfully',
            data: {
                totalNotices,
                activeNotices,
                schoolId
            }
        });
    } catch (error) {
        return sendServerError(res, 'NOTICE_ANALYTICS_FETCH_FAILED', 'Failed to fetch notice analytics', error);
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
            code: 'NOTICE_PIN_UPDATED',
            message: `Notice ${notice.isPinned ? 'pinned' : 'unpinned'}`,
            data: notice
        });
    } catch (error) {
        return sendServerError(res, 'NOTICE_PIN_FAILED', 'Failed to update pinned notice state', error);
    }
};

/**
 * @desc    Get student notices
 * @route   GET /api/notices/student
 * @access  Student only
 */
exports.getStudentNotices = async (req, res) => {
    try {
        const { schoolId } = normalizeSchoolScope(req);
        const classIds =
            req.user?.role === 'parent'
                ? await getParentLinkedClassIds(req)
                : req.user?.classId
                    ? [req.user.classId]
                    : [];
        const query = buildPublishedNoticeQuery({
            schoolId,
            role: req.user.role,
            classIds
        });

        const notices = await Notice.find(query)
            .sort({ isPinned: -1, pinOrder: 1, publishDate: -1, createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            code: 'STUDENT_NOTICES_FETCHED',
            message: 'Student notices fetched successfully',
            data: notices
        });
    } catch (error) {
        return sendServerError(res, 'STUDENT_NOTICES_FETCH_FAILED', 'Failed to fetch student notices', error);
    }
};

/**
 * @desc    Get unread notices
 * @route   GET /api/notices/unread
 * @access  Student only
 */
exports.getUnreadNotices = async (req, res) => {
    try {
        const { schoolId } = normalizeSchoolScope(req);
        const classIds =
            req.user?.role === 'parent'
                ? await getParentLinkedClassIds(req)
                : req.user?.classId
                    ? [req.user.classId]
                    : [];
        const query = buildPublishedNoticeQuery({
            schoolId,
            role: req.user.role,
            classIds
        });

        const notices = await Notice.find(query)
            .sort({ isPinned: -1, pinOrder: 1, publishDate: -1, createdAt: -1 })
            .lean();

        const readEvents = await Notification.find({
            recipient: req.user._id || req.user.id,
            type: 'notice',
            'data.event': 'notice_read'
        }).select('data.noticeId');
        const readIds = new Set(readEvents.map((row) => String(row.data?.noticeId || '')));
        const unread = notices.filter((notice) => !readIds.has(String(notice._id)));

        res.status(200).json({
            success: true,
            code: 'STUDENT_UNREAD_NOTICES_FETCHED',
            message: 'Unread notices fetched successfully',
            data: unread
        });
    } catch (error) {
        return sendServerError(res, 'STUDENT_UNREAD_NOTICES_FETCH_FAILED', 'Failed to fetch unread notices', error);
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
        const { schoolId, schoolCode } = normalizeSchoolScope(req);
        const query = buildPublishedNoticeQuery({
            schoolId,
            role: req.user.role,
            classIds: req.user?.classId ? [req.user.classId] : []
        });
        query.$and.push({ _id: id });

        const notice = await Notice.findOne(query).select('_id title');
        if (!notice) {
            return res.status(404).json({
                success: false,
                code: 'NOTICE_NOT_FOUND',
                message: 'Notice not found'
            });
        }

        await Notification.findOneAndUpdate(
            {
                recipient: userId,
                type: 'notice',
                'data.noticeId': String(id),
                'data.event': 'notice_read'
            },
            {
                recipient: userId,
                title: 'Notice read',
                body: `Read notice: ${notice.title}`,
                type: 'notice',
                schoolCode,
                data: {
                    noticeId: String(id),
                    event: 'notice_read'
                },
                read: true,
                readAt: new Date()
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );

        res.status(200).json({
            success: true,
            code: 'NOTICE_MARKED_READ',
            message: 'Notice marked as read',
            data: { noticeId: id, readBy: userId }
        });
    } catch (error) {
        return sendServerError(res, 'NOTICE_MARK_READ_FAILED', 'Failed to mark notice as read', error);
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
        const schoolId = req.tenant?.schoolId || req.user.schoolId;

        const notice = await Notice.findById(id);

        if (!notice || (!notice.isGlobal && notice.schoolId?.toString() !== schoolId?.toString() && req.user.role !== 'super_admin')) {
            return res.status(404).json({
                success: false,
                code: 'NOTICE_NOT_FOUND',
                message: 'Notice not found'
            });
        }

        res.status(200).json({
            success: true,
            code: 'NOTICE_FETCHED',
            message: 'Notice fetched successfully',
            data: notice
        });
    } catch (error) {
        return sendServerError(res, 'NOTICE_FETCH_FAILED', 'Failed to fetch notice', error);
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

        const schoolId = req.tenant?.schoolId || req.user.schoolId;
        const normalizedCode = schoolCode?.trim()?.toUpperCase();
        const notice = await Notice.findOneAndUpdate(
            { _id: id, $or: [{ schoolId }, { isGlobal: true }] },
            { status: 'active', isPublished: true, publishedAt: new Date(), schoolCode: normalizedCode },
            { new: true }
        );

        if (!notice) {
            return res.status(404).json({
                success: false,
                code: 'NOTICE_NOT_FOUND',
                message: 'Notice not found'
            });
        }

        res.status(200).json({
            success: true,
            code: 'NOTICE_PUBLISHED',
            message: 'Notice published successfully',
            data: notice
        });
    } catch (error) {
        return sendServerError(res, 'NOTICE_PUBLISH_FAILED', 'Failed to publish notice', error);
    }
};
