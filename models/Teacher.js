const mongoose = require('mongoose');

const teacherSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    schoolCode: {
        type: String,
        required: true
    },
    employeeId: {
        type: String,
        unique: true
    },
    qualification: {
        type: String,
        required: true
    },
    experience: {
        type: String,
        required: true
    },
    subjects: [{
        type: String
    }],
    // Enhanced subject assignment with class and section mapping
    subjectAssignments: [{
        subjectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subject'
        },
        subjectName: String,
        className: String,
        section: String,
        isPrimary: { type: Boolean, default: false },
        assignedDate: { type: Date, default: Date.now },
        isActive: { type: Boolean, default: true }
    }],
    // Class teacher assignment
    classTeacherOf: {
        class: String,
        section: String,
        assignedDate: Date
    },
    // Availability and preferences
    availability: {
        maxPeriodsPerDay: { type: Number, default: 6 },
        maxPeriodsPerWeek: { type: Number, default: 30 },
        preferredDays: [{
            type: String,
            enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
        }],
        preferredPeriods: [Number],
        unavailablePeriods: [{
            day: String,
            periods: [Number]
        }]
    },
    address: String,
    dateOfBirth: Date,
    gender: {
        type: String,
        enum: ['male', 'female', 'other']
    },
    emergencyContact: {
        name: String,
        phone: String,
        relationship: String
    },
    profileImage: String,
    joiningDate: {
        type: Date,
        default: Date.now
    },
    salary: {
        amount: Number,
        currency: {
            type: String,
            default: 'USD'
        }
    },
    maxPeriodsPerWeek: { type: Number, default: 30 },
    isClassTeacher: { type: Boolean, default: false },
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

// Pre-save middleware to update updatedAt
teacherSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Generate employee ID before saving
teacherSchema.pre('save', async function(next) {
    if (!this.employeeId) {
        const count = await this.constructor.countDocuments({ schoolCode: this.schoolCode });
        this.employeeId = `TCH${String(count + 1).padStart(4, '0')}`;
    }
    next();
});

module.exports = mongoose.model('Teacher', teacherSchema);
