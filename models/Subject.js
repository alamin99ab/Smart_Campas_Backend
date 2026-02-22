/**
 * 📖 SUBJECT MODEL
 * Industry-level subject management for Smart Campus System
 */

const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
    schoolCode: {
        type: String,
        required: true,
        ref: 'School'
    },
    subjectName: {
        type: String,
        required: [true, 'Subject name is required'],
        trim: true
    },
    subjectCode: {
        type: String,
        required: [true, 'Subject code is required'],
        uppercase: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['Core', 'Elective', 'Optional', 'Extra-curricular'],
        default: 'Core'
    },
    classLevels: [{
        type: Number,
        min: 1,
        max: 12
    }],
    description: {
        type: String,
        trim: true
    },
    credits: {
        type: Number,
        default: 1,
        min: 0.5,
        max: 5
    },
    periodsPerWeek: {
        type: Number,
        default: 5,
        min: 1,
        max: 10
    },
    passingMarks: {
        type: Number,
        default: 33,
        min: 0,
        max: 100
    },
    totalMarks: {
        type: Number,
        default: 100,
        min: 50,
        max: 200
    },
    prerequisites: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject'
    }],
    teachers: [{
        teacherId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        assignedDate: {
            type: Date,
            default: Date.now
        },
        isActive: {
            type: Boolean,
            default: true
        }
    }],
    syllabus: {
        topics: [{
            topicName: String,
            description: String,
            order: Number,
            estimatedHours: Number
        }],
        resources: [{
            type: {
                type: String,
                enum: ['Textbook', 'Notebook', 'Online', 'Video', 'Lab']
            },
            title: String,
            url: String,
            isRequired: Boolean
        }]
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Compound index for unique subject per school
subjectSchema.index({ schoolCode: 1, subjectCode: 1 }, { unique: true });

// Method to add teacher
subjectSchema.methods.addTeacher = function(teacherId) {
    this.teachers.push({
        teacherId: teacherId,
        assignedDate: new Date(),
        isActive: true
    });
    return this.save();
};

// Method to remove teacher
subjectSchema.methods.removeTeacher = function(teacherId) {
    this.teachers = this.teachers.filter(
        teacher => teacher.teacherId.toString() !== teacherId.toString()
    );
    return this.save();
};

// Method to check if teacher is assigned
subjectSchema.methods.hasTeacher = function(teacherId) {
    return this.teachers.some(
        teacher => teacher.teacherId.toString() === teacherId.toString() && teacher.isActive
    );
};

module.exports = mongoose.model('Subject', subjectSchema);
