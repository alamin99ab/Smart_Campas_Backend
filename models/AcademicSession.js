/**
 * AcademicSession Model - Academic year/session management
 */
const mongoose = require('mongoose');

const academicSessionSchema = new mongoose.Schema({
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    schoolCode: { type: String, required: true, index: true },
    name: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    academicYear: { type: String, required: true },
    isCurrent: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

academicSessionSchema.index({ schoolCode: 1, academicYear: 1 }, { unique: true });

module.exports = mongoose.model('AcademicSession', academicSessionSchema);
