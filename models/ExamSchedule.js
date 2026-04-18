/**
 * Exam Schedule / Exam Routine – subject-wise date & time slots (separate from class routine)
 */
const mongoose = require('mongoose');

const examScheduleSlotSchema = new mongoose.Schema({
    date: { type: Date, required: true },
    startTime: { type: String, required: true, trim: true },
    endTime: { type: String, required: true, trim: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    invigilatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: {
        type: String,
        enum: ['scheduled', 'rescheduled', 'completed', 'cancelled'],
        default: 'scheduled'
    },
    totalMarks: { type: Number, min: 1, default: 100 },
    passMarks: { type: Number, min: 0, default: 33 },
    // Legacy compatibility fields
    subjectName: { type: String, trim: true },
    classLevel: { type: String, trim: true },
    section: { type: String, trim: true, uppercase: true },
    roomNumber: { type: String, trim: true },
    fullMarks: { type: Number, min: 1 }
}, { _id: true });

const examScheduleSchema = new mongoose.Schema({
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School' },
    schoolCode: { type: String, required: true, index: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true },
    examName: { type: String, required: true },
    academicSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
    academicYear: { type: String, required: true },
    slots: [examScheduleSlotSchema],
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

examScheduleSchema.index({ schoolCode: 1, examId: 1 }, { unique: true });
examScheduleSchema.index({ schoolId: 1, examId: 1 }, { unique: true, sparse: true });
examScheduleSchema.index({ schoolCode: 1, 'slots.classId': 1, 'slots.subjectId': 1, 'slots.date': 1 });
examScheduleSchema.index({ schoolId: 1, 'slots.classId': 1, 'slots.subjectId': 1, 'slots.date': 1 });

examScheduleSchema.pre('validate', function(next) {
    if (typeof this.schoolCode === 'string') {
        this.schoolCode = this.schoolCode.trim().toUpperCase();
    }

    if (Array.isArray(this.slots)) {
        this.slots = this.slots.map((slot) => {
            const safeSlot = { ...slot };
            if (safeSlot.fullMarks && !safeSlot.totalMarks) {
                safeSlot.totalMarks = safeSlot.fullMarks;
            }
            if (!safeSlot.fullMarks && safeSlot.totalMarks) {
                safeSlot.fullMarks = safeSlot.totalMarks;
            }
            if (safeSlot.section) {
                safeSlot.section = String(safeSlot.section).trim().toUpperCase();
            }
            return safeSlot;
        });
    }

    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('ExamSchedule', examScheduleSchema);
