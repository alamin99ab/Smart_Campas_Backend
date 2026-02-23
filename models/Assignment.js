/**
 * 📝 ASSIGNMENT MODEL
 * Industry-level assignment model for Smart Campus System
 */

const mongoose = require('mongoose');

const submissionSchema = new mongoose.Schema({
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    attachments: [{
        filename: String,
        originalName: String,
        path: String,
        size: Number,
        mimeType: String
    }],
    submittedAt: {
        type: Date,
        default: Date.now
    },
    marks: {
        type: Number,
        min: 0
    },
    feedback: String,
    graded: {
        type: Boolean,
        default: false
    },
    gradedAt: Date,
    gradedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher'
    }
});

const assignmentSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true
    },
    teacherId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Teacher',
        required: true
    },
    dueDate: {
        type: Date,
        required: true
    },
    maxMarks: {
        type: Number,
        required: true,
        min: 1
    },
    attachments: [{
        filename: String,
        originalName: String,
        path: String,
        size: Number,
        mimeType: String
    }],
    instructions: String,
    submissions: [submissionSchema],
    schoolCode: {
        type: String,
        required: true,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes for better performance
assignmentSchema.index({ classId: 1, dueDate: -1 });
assignmentSchema.index({ teacherId: 1, createdAt: -1 });
assignmentSchema.index({ schoolCode: 1, isActive: 1 });

// Update the updatedAt field before saving
assignmentSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Virtual for checking if assignment is overdue
assignmentSchema.virtual('isOverdue').get(function() {
    return this.dueDate < new Date();
});

// Virtual for submission statistics
assignmentSchema.virtual('submissionStats').get(function() {
    const total = this.submissions.length;
    const graded = this.submissions.filter(sub => sub.graded).length;
    const pending = total - graded;
    
    return {
        total,
        graded,
        pending,
        submissionRate: total > 0 ? (graded / total) * 100 : 0
    };
});

// Ensure virtuals are included in JSON
assignmentSchema.set('toJSON', { virtuals: true });
assignmentSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Assignment', assignmentSchema);
