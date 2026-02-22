/**
 * ⏰ ROUTINE MODEL
 * Industry-level class routine management for Smart Campus System
 */

const mongoose = require('mongoose');

const routineSchema = new mongoose.Schema({
    schoolCode: {
        type: String,
        required: true,
        ref: 'School'
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Class'
    },
    academicYear: {
        type: String,
        required: true
    },
    semester: {
        type: String,
        enum: ['First', 'Second', 'Summer'],
        default: 'First'
    },
    effectiveFrom: {
        type: Date,
        required: true
    },
    effectiveTo: {
        type: Date
    },
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
                required: true,
                validate: {
                    validator: function(v) {
                        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
                    },
                    message: 'Start time must be in HH:MM format'
                }
            },
            endTime: {
                type: String,
                required: true,
                validate: {
                    validator: function(v) {
                        return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
                    },
                    message: 'End time must be in HH:MM format'
                }
            },
            duration: {
                type: Number,
                default: 45,
                min: 30,
                max: 120
            },
            subjectId: {
                type: mongoose.Schema.Types.ObjectId,
                required: true,
                ref: 'Subject'
            },
            teacherId: {
                type: mongoose.Schema.Types.ObjectId,
                required: true,
                ref: 'User'
            },
            roomNumber: {
                type: String,
                required: true
            },
            building: {
                type: String
            },
            floor: {
                type: String
            },
            isBreak: {
                type: Boolean,
                default: false
            },
            breakType: {
                type: String,
                enum: ['Short Break', 'Lunch Break', 'Prayer Break', 'Recess']
            },
            notes: {
                type: String,
                trim: true
            }
        }]
    }],
    breaks: [{
        name: {
            type: String,
            required: true
        },
        startTime: {
            type: String,
            required: true
        },
        endTime: {
            type: String,
            required: true
        },
        days: [{
            type: String,
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        }]
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

// Index for efficient queries
routineSchema.index({ schoolCode: 1, classId: 1, academicYear: 1 });

module.exports = mongoose.model('Routine', routineSchema);
