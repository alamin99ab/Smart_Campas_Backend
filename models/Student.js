// models/Student.js
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    // Use string roll to support alphanumeric roll numbers from existing schools
    roll: { type: String, required: true, trim: true },
    studentClass: { type: String, required: true },
    section: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', index: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', index: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', index: true },
    academicSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicSession' },
    fatherName: { type: String },
    motherName: { type: String },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: ['Male', 'Female', 'Other'] },
    address: { type: String },
    phone: { type: String },
    guardian: {
        name: { type: String },
        phone: { type: String },
        email: { type: String }
    },
    emergencyContact: { type: String },
    photo: {
        url: { type: String },
        publicId: { type: String }
    },
    studentId: { type: String, unique: true, sparse: true },
    totalDue: { type: Number, default: 0 },
    forceAdmit: { type: Boolean, default: false },
    forceAdmitReason: String,
    forceAdmitExpiry: Date,
    forceAdmitGrantedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    forceAdmitGrantedAt: Date,
    schoolCode: { type: String, required: true, index: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    isActive: { type: Boolean, default: true },
    // Academic history for promotion tracking
    academicHistory: [{
        academicYear: { type: String },
        className: { type: String },
        section: { type: String },
        promotionDate: { type: Date },
        promotedTo: { type: String },
        promotedToSection: { type: String },
        examName: { type: String },
        promotionType: { type: String, enum: ['all', 'passing', 'manual'] },
        manualApproval: { type: Boolean, default: false },
        manualApprovalReason: { type: String, trim: true },
        manualApprovalCategory: { type: String, enum: ['failed', 'incomplete'] },
        manualApprovalBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        manualApprovalAt: { type: Date }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

studentSchema.pre('validate', function(next) {
    if (typeof this.schoolCode === 'string') {
        this.schoolCode = this.schoolCode.trim().toUpperCase();
    }
    if (typeof this.studentClass === 'string') {
        this.studentClass = this.studentClass.trim();
    }
    if (typeof this.section === 'string') {
        this.section = this.section.trim().toUpperCase();
    }
    if (this.roll !== undefined && this.roll !== null) {
        this.roll = String(this.roll).trim();
    }
    if (!this.userId && this._id) {
        this.userId = this._id;
    }
    this.updatedAt = Date.now();
    next();
});

// Unique index: one student per school, class, roll
studentSchema.index({ schoolCode: 1, studentClass: 1, roll: 1 }, { unique: true });

// Index for search
studentSchema.index({ name: 'text', fatherName: 'text' });
studentSchema.index({ schoolCode: 1, classId: 1, sectionId: 1, roll: 1 });
studentSchema.index({ schoolCode: 1, studentClass: 1, section: 1, isActive: 1 });
studentSchema.index({ schoolCode: 1, parentId: 1, isActive: 1 });
studentSchema.index({ schoolCode: 1, 'guardian.email': 1, isActive: 1 });
studentSchema.index({ schoolCode: 1, 'academicHistory.academicYear': 1, 'academicHistory.promotionDate': -1 });
studentSchema.index({ schoolId: 1, classId: 1, sectionId: 1, isActive: 1 });

module.exports = mongoose.model('Student', studentSchema);
