const mongoose = require('mongoose');

const teacherAssignmentSchema = new mongoose.Schema({
    schoolCode: { type: String, required: true, index: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    subject: { type: String, required: true },
    classes: [{ type: String }],
    sections: [{ type: String }],
    periodsPerWeek: { type: Number, default: 0 },
    academicYear: { type: String, required: true },
    semester: { type: String },
    isActive: { type: Boolean, default: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    assignedAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

teacherAssignmentSchema.index({ schoolCode: 1, teacher: 1, subject: 1, academicYear: 1 });
teacherAssignmentSchema.index({ schoolCode: 1, subject: 1 });
teacherAssignmentSchema.pre('save', function () {
    this.updatedAt = Date.now();
});

module.exports = mongoose.model('TeacherAssignment', teacherAssignmentSchema);
