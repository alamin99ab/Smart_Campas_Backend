const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
    schoolCode: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', trim: true },
    examType: {
        type: String,
        required: true,
        enum: ['Quiz', 'Midterm', 'Final', 'Practical', 'Assignment', 'Other'],
        default: 'Final'
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        required: true
    },
    date: { type: Date, required: true },
    duration: { type: Number, required: true, min: 1 },
    totalMarks: { type: Number, required: true, min: 1 },
    isActive: { type: Boolean, default: true },
    resultsPublished: { type: Boolean, default: false },
    publishedDate: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

examSchema.index({ schoolCode: 1, classId: 1, subjectId: 1, date: 1 });

module.exports = mongoose.model('Exam', examSchema);
