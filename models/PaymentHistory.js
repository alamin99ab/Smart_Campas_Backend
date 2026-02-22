const mongoose = require('mongoose');

const paymentHistorySchema = new mongoose.Schema({
    feeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Fee' },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    month: { type: Number, required: true },
    year: { type: Number, required: true },
    amount: { type: Number, required: true, min: 0 },
    previousDue: { type: Number, default: 0 },
    newDue: { type: Number, default: 0 },
    paymentMethod: { type: String, enum: ['Cash', 'Bank', 'Mobile Banking', 'Cheque', 'Online'], default: 'Cash' },
    transactionId: String,
    remarks: String,
    receivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    schoolCode: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

paymentHistorySchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.model('PaymentHistory', paymentHistorySchema);