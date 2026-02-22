const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
    schoolCode: { type: String, required: true, index: true },
    name: { type: String, required: true },
    year: { type: Number, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    subjects: [String],
    classes: [String], // Which classes are included
    description: String,
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Exam', examSchema);