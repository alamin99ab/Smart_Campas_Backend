const mongoose = require('mongoose');

const schoolEventSchema = new mongoose.Schema({
    schoolCode: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true },
    type: {
        type: String,
        enum: ['exam', 'holiday', 'meeting', 'event', 'deadline', 'other'],
        default: 'event'
    },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date },
    allDay: { type: Boolean, default: true },
    location: { type: String },
    targetRoles: [{ type: String, enum: ['admin', 'principal', 'teacher', 'student', 'parent'] }],
    targetClasses: [{ type: String }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

schoolEventSchema.index({ schoolCode: 1, startDate: 1 });
schoolEventSchema.pre('save', function () {
    this.updatedAt = Date.now();
});

module.exports = mongoose.model('SchoolEvent', schoolEventSchema);
