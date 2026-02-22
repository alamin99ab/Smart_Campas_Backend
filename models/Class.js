/**
 * 📚 CLASS MODEL
 * Industry-level class management for Smart Campus System
 */

const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
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
    subjects: [{
        subjectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subject'
        },
        teacherId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        periodsPerWeek: {
            type: Number,
            default: 5
        }
    }],
    schedule: [{
        day: {
            type: String,
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
            required: true
        },
        periods: [{
            periodNumber: {
                type: Number,
                required: true,
                min: 1
            },
            startTime: {
                type: String,
                required: true
            },
            endTime: {
                type: String,
                required: true
            },
            subjectId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Subject'
            },
            teacherId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            },
            roomNumber: String
        }]
    }],
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
