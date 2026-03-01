/**
 * FeeStructure Model - Class-wise fee (monthly/yearly, transport, library)
 */
const mongoose = require('mongoose');

const feeStructureSchema = new mongoose.Schema({
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    schoolCode: { type: String, required: true, index: true },
    academicSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
    academicYear: { type: String, required: true },
    classLevel: { type: String, required: true },
    section: String,
    feeType: { type: String, enum: ['Tuition', 'Monthly', 'Yearly', 'Transport', 'Library', 'Lab', 'Other'], default: 'Monthly' },
    amount: { type: Number, required: true, min: 0 },
    dueDayOfMonth: { type: Number, min: 1, max: 28 },
    lateFinePerDay: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

feeStructureSchema.index({ schoolCode: 1, academicYear: 1, classLevel: 1, feeType: 1 }, { unique: true });

module.exports = mongoose.model('FeeStructure', feeStructureSchema);
