/**
 * Substitution Model - Substitute teacher assignment log
 */
const mongoose = require('mongoose');

const substitutionSchema = new mongoose.Schema({
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    schoolCode: { type: String, required: true, index: true },
    routineId: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassRoutine' },
    date: { type: Date, required: true },
    day: { type: String, enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] },
    periodNumber: { type: Number, required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    section: String,
    className: String,
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    originalTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    substituteTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    roomNumber: String,
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' },
    leaveRequestId: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveRequest' },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    remarks: String,
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

substitutionSchema.index({ schoolCode: 1, date: 1, originalTeacherId: 1 });

module.exports = mongoose.model('Substitution', substitutionSchema);
