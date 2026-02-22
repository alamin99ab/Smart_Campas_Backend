// models/Notice.js
const mongoose = require('mongoose');

const noticeSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true,
        trim: true,
        maxlength: 200
    },
    content: { 
        type: String, 
        required: true,
        trim: true
    },
    category: { 
        type: String, 
        required: true,
        enum: ['academic', 'exam', 'event', 'holiday', 'meeting', 'circular', 'other'],
        default: 'other'
    },
    priority: {
        type: String,
        enum: ['low', 'normal', 'high', 'urgent'],
        default: 'normal'
    },
    schoolCode: { 
        type: String, 
        required: true,
        index: true
    },
    addedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    updatedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    targetRoles: [{
        type: String,
        enum: ['admin', 'principal', 'teacher', 'student', 'parent'],
        default: ['teacher', 'student', 'parent']
    }],
    targetClasses: [{
        type: String,
        trim: true
    }],
    attachments: [{
        filename: String,
        url: String,
        size: Number,
        uploadedAt: { type: Date, default: Date.now }
    }],
    views: { 
        type: Number, 
        default: 0 
    },
    isActive: { 
        type: Boolean, 
        default: true 
    },
    expiryDate: { 
        type: Date,
        default: null 
    },
    createdAt: { 
        type: Date, 
        default: Date.now,
        index: true
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

// Compound indexes for better query performance
noticeSchema.index({ schoolCode: 1, createdAt: -1 });
noticeSchema.index({ schoolCode: 1, category: 1, createdAt: -1 });
noticeSchema.index({ schoolCode: 1, priority: -1, createdAt: -1 });
noticeSchema.index({ addedBy: 1, createdAt: -1 });

// Virtual for checking if notice is expired
noticeSchema.virtual('isExpired').get(function() {
    return this.expiryDate ? this.expiryDate < new Date() : false;
});

// Pre-save middleware to update updatedAt
noticeSchema.pre('save', function(next) {
    if (this.isModified()) {
        this.updatedAt = Date.now();
    }
    next();
});

module.exports = mongoose.model('Notice', noticeSchema);