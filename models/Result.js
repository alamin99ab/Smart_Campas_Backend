// models/Result.js
const mongoose = require('mongoose');

const resultSchema = new mongoose.Schema({
    studentId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Student', 
        required: true 
    },
    schoolCode: { 
        type: String, 
        required: true,
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
    examDate: { 
        type: Date, 
        default: Date.now 
    },
    subjects: [{
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
    isPublished: { 
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

// Indexes for search
resultSchema.index({ schoolCode: 1, studentClass: 1, section: 1, examName: 1 });

module.exports = mongoose.model('Result', resultSchema);