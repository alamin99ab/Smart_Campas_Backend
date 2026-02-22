const mongoose = require('mongoose');

const routineSchema = new mongoose.Schema({
    schoolCode: { type: String, required: true, index: true },
    studentClass: { type: String, required: true },
    section: { type: String },
    day: {
        type: String,
        enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
        required: true
    },
    periods: [{
        period: { type: Number, required: true },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        subject: { type: String, required: true },
        teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        room: { type: String }
    }],
    academicYear: { type: String, required: true },
    semester: { type: String },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

routineSchema.index({ schoolCode: 1, studentClass: 1, section: 1, day: 1, academicYear: 1 }, { unique: true });
routineSchema.pre('save', function () {
    this.updatedAt = Date.now();
});

module.exports = mongoose.model('ClassRoutine', routineSchema);
