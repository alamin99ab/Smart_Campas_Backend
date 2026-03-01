/**
 * LeaveRequest Model - Teacher leave & substitute management
 */
const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema({
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    schoolCode: { type: String, required: true, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    leaveType: { type: String, enum: ['Sick', 'Personal', 'Emergency', 'Other'], default: 'Personal' },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    rejectionReason: String,
    autoMarkAbsent: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

leaveRequestSchema.index({ schoolCode: 1, teacherId: 1, startDate: 1 });

module.exports = mongoose.model('LeaveRequest', leaveRequestSchema);
