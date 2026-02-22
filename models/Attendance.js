const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
    schoolCode: { type: String, required: true, index: true },
    studentClass: { type: String, required: true },
    section: { type: String, required: true },
    date: { type: Date, required: true },
    subject: String,
    records: [{
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
        status: { type: String, enum: ['Present', 'Absent', 'Late', 'Holiday'], required: true },
        remarks: String
    }],
    takenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// One attendance per class/section/date/subject
attendanceSchema.index({ schoolCode: 1, studentClass: 1, section: 1, date: 1, subject: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);