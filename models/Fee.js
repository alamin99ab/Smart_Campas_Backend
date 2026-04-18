const mongoose = require('mongoose');

const feeSchema = new mongoose.Schema({
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    month: { type: Number, required: true, min: 1, max: 12 },
    year: { type: Number, required: true },
    amountDue: { type: Number, required: true, min: 0 },
    amountPaid: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['Paid', 'Partial', 'Unpaid'], default: 'Unpaid' },
    schoolCode: { type: String, required: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

feeSchema.index({ studentId: 1, month: 1, year: 1, schoolCode: 1 }, { unique: true });
feeSchema.index(
    { studentId: 1, month: 1, year: 1, schoolId: 1 },
    { unique: true, partialFilterExpression: { schoolId: { $type: 'objectId' } } }
);
feeSchema.index({ schoolId: 1, studentId: 1, year: 1, month: 1 });

module.exports = mongoose.model('Fee', feeSchema);
