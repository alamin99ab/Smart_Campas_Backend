/**
 * NOTICE MANAGEMENT MODEL
 * Complete CRUD system for school communication
 */

const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
    // Basic information
    schoolId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'School',
        required: function() { return !this.isGlobal; }
    },
    schoolCode: {
        type: String,
        uppercase: true,
        trim: true,
        index: true
    },
    academicSessionId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'AcademicSession'
    },
    
    // Global notice (Super Admin only)
    isGlobal: { 
        type: Boolean, 
        default: false 
    },
    targetSubscriptionPlans: [{
        type: String,
        enum: ['trial', 'monthly', 'yearly', 'basic', 'standard', 'premium', 'enterprise']
    }],
    
    // Notice details
    title: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: 200
    },
    description: { 
        type: String, 
        required: true,
        trim: true
    },
    noticeType: {
        type: String,
        enum: ['general', 'urgent', 'exam', 'holiday', 'fees', 'event', 'homework', 'assignment', 'meeting', 'circular', 'other'],
        required: true,
        default: 'general'
    },
    
    // Target audience configuration
    targetType: {
        type: String,
        enum: ['all', 'class', 'section', 'teacher', 'student', 'parent', 'role'],
        required: true,
        default: 'all'
    },
    targetRoles: [{
        type: String,
        enum: ['super_admin', 'admin', 'principal', 'teacher', 'student', 'parent', 'accountant']
    }],
    targetClasses: [{
        classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
        className: String
    }],
    targetSections: [{
        sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
        sectionName: String
    }],
    targetTeachers: [{
        teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        teacherName: String
    }],
    targetSubjects: [{
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
        subjectName: String
    }],
    
    // Priority and scheduling
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium'
    },
    isPinned: { 
        type: Boolean, 
        default: false 
    },
    pinOrder: { 
        type: Number, 
        default: 0 
    },
    
    // Publishing and expiry
    publishDate: { 
        type: Date, 
        default: Date.now 
    },
    publishedAt: {
        type: Date
    },
    isPublished: {
        type: Boolean,
        default: false
    },
    isPublic: {
        type: Boolean,
        default: false,
        index: true
    },
    expiryDate: { 
        type: Date,
        default: null 
    },
    status: {
        type: String,
        enum: ['draft', 'scheduled', 'active', 'expired', 'deleted'],
        default: 'active'
    },
    
    // Attachments
    attachments: [{
        filename: String,
        originalName: String,
        url: String,
        publicId: String,
        size: Number,
        mimeType: String,
        uploadedAt: { type: Date, default: Date.now }
    }],
    
    // Communication settings
    communicationSettings: {
        sendEmail: { type: Boolean, default: false },
        sendSMS: { type: Boolean, default: false },
        sendPush: { type: Boolean, default: true },
        emailSubject: String,
        smsMessage: String,
        customMessage: String
    },
    
    // Rich content support
    contentFormat: {
        type: String,
        enum: ['plain', 'html', 'markdown'],
        default: 'plain'
    },
    richContent: String,
    
    // Analytics
    analytics: {
        views: { type: Number, default: 0 },
        uniqueViews: { type: Number, default: 0 },
        downloads: { type: Number, default: 0 },
        shares: { type: Number, default: 0 },
        acknowledgments: { type: Number, default: 0 }
    },
    
    // Acknowledgment system
    requireAcknowledgment: { 
        type: Boolean, 
        default: false 
    },
    acknowledgmentDeadline: Date,
    acknowledgments: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        acknowledgedAt: { type: Date, default: Date.now },
        ipAddress: String,
        userAgent: String
    }],
    
    // Comments and interactions
    allowComments: { 
        type: Boolean, 
        default: false 
    },
    comments: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        comment: String,
        createdAt: { type: Date, default: Date.now },
        isDeleted: { type: Boolean, default: false }
    }],
    
    // Creator and modifier information
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    updatedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    publishedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    
    // Soft delete
    isDeleted: { 
        type: Boolean, 
        default: false 
    },
    deletedAt: Date,
    deletedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    
    // Audit fields
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

// Compound indexes for better query performance
noticeSchema.index({ schoolId: 1, publishDate: -1 });
noticeSchema.index({ schoolId: 1, noticeType: 1, publishDate: -1 });
noticeSchema.index({ schoolId: 1, priority: -1, publishDate: -1 });
noticeSchema.index({ schoolCode: 1, status: 1, publishDate: -1 });
noticeSchema.index({ schoolCode: 1, isPublished: 1, publishDate: -1 });
noticeSchema.index({ schoolCode: 1, isPublic: 1, isPublished: 1, publishDate: -1 });
noticeSchema.index({ createdBy: 1, publishDate: -1 });
noticeSchema.index({ isGlobal: 1, publishDate: -1 });
noticeSchema.index({ status: 1, publishDate: -1 });
noticeSchema.index({ isDeleted: 1, publishDate: -1 });

// Virtual for checking if notice is expired
noticeSchema.virtual('isExpired').get(function() {
    return this.expiryDate ? this.expiryDate < new Date() : false;
});

// Virtual for checking if notice is active
noticeSchema.virtual('isActive').get(function() {
    const now = new Date();
    return !this.isDeleted && 
           this.status === 'active' && 
           this.publishDate <= now && 
           (!this.expiryDate || this.expiryDate > now);
});

// Virtual for checking if user can acknowledge
noticeSchema.virtual('canAcknowledge').get(function() {
    return this.requireAcknowledgment && 
           !this.isExpired && 
           this.acknowledgmentDeadline && 
           this.acknowledgmentDeadline > new Date();
});

// Instance methods
noticeSchema.methods.incrementView = async function(userId) {
    this.analytics.views += 1;
    
    // Track unique views
    const Notification = require('./Notification');
    const existingView = await Notification.findOne({
        recipient: userId,
        type: 'notice',
        'data.noticeId': String(this._id),
        'data.event': 'notice_view'
    });
    
    if (!existingView) {
        this.analytics.uniqueViews += 1;
        await Notification.create({
            recipient: userId,
            title: 'Notice viewed',
            body: `Viewed notice: ${this.title}`,
            type: 'notice',
            schoolCode: this.schoolCode,
            data: {
                noticeId: String(this._id),
                event: 'notice_view'
            },
            read: true,
            readAt: new Date()
        });
    }
    
    return this.save();
};

noticeSchema.methods.addAcknowledgment = async function(userId, ipAddress, userAgent) {
    const existingAcknowledgment = this.acknowledgments.find(
        ack => ack.userId.toString() === userId.toString()
    );
    
    if (!existingAcknowledgment) {
        this.acknowledgments.push({
            userId,
            ipAddress,
            userAgent
        });
        this.analytics.acknowledgments += 1;
        
        // Create notification
        const Notification = require('./Notification');
        await Notification.create({
            recipient: userId,
            title: 'Notice acknowledged',
            body: `Acknowledged notice: ${this.title}`,
            type: 'notice',
            schoolCode: this.schoolCode,
            data: {
                noticeId: String(this._id),
                event: 'notice_acknowledgment'
            },
            read: true,
            readAt: new Date()
        });
    }
    
    return this.save();
};

noticeSchema.methods.addComment = async function(userId, comment) {
    this.comments.push({
        userId,
        comment,
        createdAt: new Date()
    });
    
    return this.save();
};

noticeSchema.methods.softDelete = async function(userId) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = userId;
    this.status = 'deleted';
    
    return this.save();
};

// Static methods
noticeSchema.statics.findActiveNotices = function(schoolId, userRole, userId, classId = null) {
    const now = new Date();
    const query = {
        isDeleted: false,
        status: 'active',
        isPublished: true,
        publishDate: { $lte: now },
        $and: [
            {
                $or: [
                    { expiryDate: null },
                    { expiryDate: { $gt: now } }
                ]
            }
        ]
    };
    
    if (schoolId) {
        query.$and.push({ $or: [{ schoolId }, { isGlobal: true }] });
    } else {
        query.isGlobal = true;
    }
    
    const audienceFilters = [
        { targetType: 'all' },
        { targetType: 'role', targetRoles: userRole },
        { targetType: userRole },
        { targetRoles: { $in: [userRole] } },
        { targetRoles: { $size: 0 } },
        { targetRoles: { $exists: false } }
    ];
    
    // Add class-specific filtering for students
    if (classId && ['student', 'parent'].includes(userRole)) {
        audienceFilters.push(
            { targetType: 'class', 'targetClasses.classId': classId },
            { targetType: 'section', 'targetSections.sectionId': classId }
        );
    }

    query.$and.push({ $or: audienceFilters });
    
    return this.find(query)
        .populate('createdBy', 'name email')
        .sort({ isPinned: -1, pinOrder: 1, priority: -1, publishDate: -1 });
};

noticeSchema.statics.getNoticeAnalytics = async function(schoolId) {
    const matchStage = schoolId 
        ? { schoolId: new mongoose.Types.ObjectId(schoolId), isDeleted: false }
        : { isGlobal: true, isDeleted: false };
    
    const analytics = await this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: {
                    noticeType: '$noticeType',
                    status: '$status'
                },
                count: { $sum: 1 },
                totalViews: { $sum: '$analytics.views' },
                totalAcknowledgments: { $sum: '$analytics.acknowledgments' }
            }
        },
        {
            $group: {
                _id: '$_id.noticeType',
                statuses: {
                    $push: {
                        status: '$_id.status',
                        count: '$count',
                        views: '$totalViews',
                        acknowledgments: '$totalAcknowledgments'
                    }
                },
                totalCount: { $sum: '$count' },
                totalViews: { $sum: '$totalViews' },
                totalAcknowledgments: { $sum: '$totalAcknowledgments' }
            }
        },
        { $sort: { totalCount: -1 } }
    ]);
    
    return analytics;
};

noticeSchema.statics.getMostViewedNotices = async function(schoolId, limit = 10) {
    const matchStage = schoolId 
        ? { schoolId: new mongoose.Types.ObjectId(schoolId), isDeleted: false }
        : { isGlobal: true, isDeleted: false };
    
    return this.find(matchStage)
        .sort({ 'analytics.views': -1 })
        .limit(limit)
        .populate('createdBy', 'name email');
};

noticeSchema.statics.getScheduledNotices = async function(schoolId) {
    const now = new Date();
    const query = {
        isDeleted: false,
        status: 'scheduled',
        publishDate: { $gt: now }
    };
    
    if (schoolId) {
        query.schoolId = schoolId;
    } else {
        query.isGlobal = true;
    }
    
    return this.find(query)
        .populate('createdBy', 'name email')
        .sort({ publishDate: 1 });
};

noticeSchema.statics.publishScheduledNotices = async function() {
    const now = new Date();
    const scheduledNotices = await this.find({
        isDeleted: false,
        status: 'scheduled',
        publishDate: { $lte: now }
    });
    
    const publishedNotices = [];
    for (const notice of scheduledNotices) {
        notice.status = 'active';
        notice.isPublished = true;
        notice.publishedAt = notice.publishedAt || new Date();
        notice.publishedBy = notice.createdBy;
        await notice.save();
        publishedNotices.push(notice);
        
        // Create notifications for target audience
        await this.createNotificationsForNotice(notice);
    }
    
    return publishedNotices;
};

noticeSchema.statics.createNotificationsForNotice = async function(notice) {
    const Notification = require('./Notification');
    const User = require('./User');
    
    let targetUsers = [];
    
    if (notice.isGlobal) {
        // Global notice - get users from target subscription plans
        if (notice.targetSubscriptionPlans.length > 0) {
            targetUsers = await User.find({
                role: { $in: notice.targetRoles || ['principal', 'teacher', 'student'] }
            }).populate('schoolId');
            
            targetUsers = targetUsers.filter(user => 
                notice.targetSubscriptionPlans.includes(user.schoolId?.subscription?.plan)
            );
        } else {
            targetUsers = await User.find({
                role: { $in: notice.targetRoles || ['principal', 'teacher', 'student'] }
            });
        }
    } else {
        // School-specific notice
        targetUsers = await User.find({
            schoolId: notice.schoolId,
            role: { $in: notice.targetRoles || ['teacher', 'student', 'parent'] },
            isActive: true
        });
        
        // Apply class/section filtering
        if (notice.targetType === 'class' && notice.targetClasses.length > 0) {
            const classIds = notice.targetClasses
                .map((tc) => tc.classId)
                .filter(Boolean)
                .map((id) => String(id));

            if (classIds.length > 0) {
                targetUsers = targetUsers.filter((user) => {
                    if (user.role !== 'student') return true;
                    const userClassId = user.classId ? String(user.classId) : null;
                    return userClassId ? classIds.includes(userClassId) : false;
                });
            }
        }
    }
    
    const uniqueRecipients = [...new Set(targetUsers.map((user) => String(user._id)))];
    if (!uniqueRecipients.length) return [];

    const notifications = uniqueRecipients.map((recipient) => ({
        recipient,
        schoolCode: notice.schoolCode || undefined,
        type: 'notice',
        title: notice.title,
        body: String(notice.description || '').substring(0, 220),
        link: `/notices/${notice._id}`,
        data: {
            noticeId: String(notice._id),
            noticeType: notice.noticeType,
            targetType: notice.targetType
        },
        read: false
    }));
    
    return Notification.insertMany(notifications, { ordered: false });
};

// Pre-save middleware
noticeSchema.pre('save', function(next) {
    if (this.isModified()) {
        const now = new Date();
        this.updatedAt = now;
        
        // Auto-expire notices
        if (this.expiryDate && this.expiryDate < now) {
            this.status = 'expired';
        }

        // Compute publish flag
        const isActiveWindow = 
            this.status === 'active' &&
            !this.isDeleted &&
            this.publishDate <= now &&
            (!this.expiryDate || this.expiryDate > now);

        if (isActiveWindow) {
            this.isPublished = true;
            if (!this.publishedAt) {
                this.publishedAt = now;
            }
        } else if (this.status !== 'scheduled') {
            // Keep scheduled notices as not published until the scheduler runs
            this.isPublished = false;
        }
    }
    next();
});

module.exports = mongoose.model('Notice', noticeSchema);
