/**
 * Exam Schedule / Exam Routine – subject-wise date & time slots (separate from class routine)
 */
const mongoose = require('mongoose');

const examScheduleSchema = new mongoose.Schema({
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    schoolCode: { type: String, required: true, index: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam' },
    examName: { type: String, required: true },
    academicSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
    academicYear: { type: String, required: true },
    slots: [{
        date: { type: Date },
        startTime: { type: String, required: true },
        endTime: { type: String, required: true },
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
        subjectName: { type: String },
        classLevel: { type: String },
        section: { type: String },
        roomNumber: { type: String },
        fullMarks: { type: Number, default: 100 },
        passMarks: { type: Number, default: 33 }
    }],
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

examScheduleSchema.index({ schoolCode: 1, examId: 1 }, { unique: true });

module.exports = mongoose.model('ExamSchedule', examScheduleSchema);
