const mongoose = require('mongoose');

const routineSchema = new mongoose.Schema({
    schoolCode: {
        type: String,
        required: true
    },
    class: {
        type: String,
        required: true
    },
    section: {
        type: String,
        required: true
    },
    day: {
        type: String,
        enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
        required: true
    },
    periods: [{
        time: {
            type: String,
            required: true
        },
        subject: {
            type: String,
            required: true
        },
        teacher: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        room: String,
        breakTime: {
            type: Boolean,
            default: false
        }
    }],
    isActive: {
        type: Boolean,
        default: true
    },
    academicYear: {
        type: String,
        required: true
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
routineSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Index for better performance
routineSchema.index({ schoolCode: 1, class: 1, section: 1, day: 1 });
routineSchema.index({ schoolCode: 1, 'periods.teacher': 1 });

module.exports = mongoose.model('Routine', routineSchema);
