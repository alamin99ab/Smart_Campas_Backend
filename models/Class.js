/**
 * 📚 CLASS MODEL
 * Industry-level class management for Smart Campus System
 */

const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
    schoolId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'School',
        index: true
    },
    schoolCode: {
        type: String,
        required: true,
        ref: 'School'
    },
    className: {
        type: String,
        required: [true, 'Class name is required'],
        trim: true
    },
    section: {
        type: String,
        required: [true, 'Section is required'],
        trim: true,
        uppercase: true
    },
    classLevel: {
        type: Number,
        required: [true, 'Class level is required'],
        min: 1,
        max: 12
    },
    capacity: {
        type: Number,
        required: [true, 'Class capacity is required'],
        min: 1,
        max: 100
    },
    currentStudents: {
        type: Number,
        default: 0,
        min: 0
    },
    classTeacher: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    roomNumber: {
        type: String,
        trim: true
    },
    floor: {
        type: String,
        trim: true
    },
    // Enhanced subject assignment for this class-section
    subjects: [{
        subjectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subject'
        },
        subjectName: String,
        subjectCode: String,
        teacherId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        teacherName: String,
        periodsPerWeek: {
            type: Number,
            default: 5
        },
        isActive: { type: Boolean, default: true }
    }],
    // Class status for academic year
    academicYear: {
        type: String,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Compound index for unique class per school
classSchema.index({ schoolCode: 1, className: 1, section: 1 }, { unique: true });
classSchema.index({ schoolCode: 1, isActive: 1, classLevel: 1, section: 1 });
classSchema.index({ schoolCode: 1, academicYear: 1, isActive: 1 });
classSchema.index({ schoolId: 1, academicYear: 1, classLevel: 1, section: 1 });

classSchema.pre('validate', function(next) {
    if (typeof this.schoolCode === 'string') {
        this.schoolCode = this.schoolCode.trim().toUpperCase();
    }
    if (typeof this.className === 'string') {
        this.className = this.className.trim();
    }
    if (typeof this.section === 'string') {
        this.section = this.section.trim().toUpperCase();
    }
    next();
});

// Virtual for full class name
classSchema.virtual('fullClassName').get(function() {
    return `${this.className}-${this.section}`;
});

// Method to check if class is full
classSchema.methods.isFull = function() {
    return this.currentStudents >= this.capacity;
};

// Method to add student
classSchema.methods.addStudent = function() {
    if (!this.isFull()) {
        this.currentStudents += 1;
        return this.save();
    }
    throw new Error('Class is at full capacity');
};

// Method to remove student
classSchema.methods.removeStudent = function() {
    if (this.currentStudents > 0) {
        this.currentStudents -= 1;
        return this.save();
    }
    throw new Error('No students to remove');
};

module.exports = mongoose.model('Class', classSchema);
