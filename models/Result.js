// models/Result.js
const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    examId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Exam'
    },
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        index: true
    },
    studentId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Student', 
        required: true 
    },
    schoolCode: { 
        type: String, 
        required: true,
        uppercase: true,
        trim: true,
        index: true 
    },
    studentClass: { 
        type: String, 
        required: true 
    },
    section: { 
        type: String 
    },
    roll: { 
        type: Number, 
        required: true 
    },
    examName: { 
        type: String, 
        required: true 
    },
    academicYear: {
        type: String
    },
    examDate: { 
        type: Date, 
        default: Date.now 
    },
    subjects: [{
        subjectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subject'
        },
        subjectName: { type: String, required: true },
        marks: { type: Number, required: true, min: 0, max: 100 },
        grade: { type: String }
    }],
    totalMarks: { 
        type: Number, 
        default: 0 
    },
    gpa: { 
        type: Number, 
        default: 0 
    },
    gradingSystem: { 
        type: String, 
        enum: ['standard', 'custom'], 
        default: 'standard' 
    },
    remarks: { 
        type: String 
    },
    status: {
        type: String,
        enum: ['draft', 'verified', 'published'],
        default: 'draft',
        index: true
    },
    verifiedAt: {
        type: Date,
        default: null
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    publishedAt: {
        type: Date
    },
    isPublished: { 
        type: Boolean, 
        default: false 
    },
    isActive: {
        type: Boolean,
        default: true
    },
    publishedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    isLocked: { type: Boolean, default: false },
    lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    lockedAt: { type: Date },
    updatedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
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

// Unique index: one result per student per exam
resultSchema.index({ studentId: 1, examName: 1, schoolCode: 1 }, { unique: true });
resultSchema.index(
    { studentId: 1, examId: 1, schoolCode: 1 },
    {
        unique: true,
        partialFilterExpression: { examId: { $type: 'objectId' } }
    }
);
resultSchema.index(
    { studentId: 1, examName: 1, schoolId: 1 },
    {
        unique: true,
        partialFilterExpression: { schoolId: { $type: 'objectId' } }
    }
);
resultSchema.index(
    { studentId: 1, examId: 1, schoolId: 1 },
    {
        unique: true,
        partialFilterExpression: { examId: { $type: 'objectId' }, schoolId: { $type: 'objectId' } }
    }
);

// Indexes for search
resultSchema.index({ schoolCode: 1, studentClass: 1, section: 1, examName: 1 });
resultSchema.index({ schoolCode: 1, academicYear: 1, examName: 1 });
resultSchema.index({ schoolCode: 1, studentClass: 1, roll: 1, isPublished: 1, isActive: 1 });
resultSchema.index({ schoolId: 1, studentClass: 1, section: 1, examName: 1 });
resultSchema.index({ schoolId: 1, academicYear: 1, examName: 1 });
resultSchema.index({ schoolId: 1, studentClass: 1, studentId: 1, isPublished: 1, isActive: 1 });
resultSchema.index({ schoolId: 1, examId: 1, studentClass: 1, section: 1, status: 1, isActive: 1 });
resultSchema.index({ schoolCode: 1, examId: 1, studentClass: 1, section: 1, status: 1, isActive: 1 });

resultSchema.pre('save', function(next) {
    if (!this.status) {
        this.status = this.isPublished ? 'published' : 'draft';
    }

    if (this.status === 'published') {
        this.isPublished = true;
        this.isActive = true;
        if (!this.publishedAt) {
            this.publishedAt = new Date();
        }
    } else {
        this.isPublished = false;
        this.publishedAt = null;
        this.publishedBy = null;
    }

    if (this.status !== 'verified') {
        this.verifiedAt = null;
        this.verifiedBy = null;
    }

    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Result', resultSchema);
