// models/Student.js
const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    roll: { type: Number, required: true },
    studentClass: { type: String, required: true },
    section: { type: String },
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
        promotionType: { type: String, enum: ['all', 'passing', 'manual'] }
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Unique index: one student per school, class, roll
studentSchema.index({ schoolCode: 1, studentClass: 1, roll: 1 }, { unique: true });

// Index for search
studentSchema.index({ name: 'text', fatherName: 'text' });

module.exports = mongoose.model('Student', studentSchema);