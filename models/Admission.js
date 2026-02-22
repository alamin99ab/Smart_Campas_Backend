const mongoose = require('mongoose');

const admissionSchema = new mongoose.Schema({
    schoolCode: { type: String, required: true, index: true },
    studentName: { type: String, required: true, trim: true },
    dateOfBirth: { type: Date, required: true },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
    fatherName: { type: String, required: true },
    motherName: { type: String },
    guardian: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        email: { type: String },
        relation: { type: String, default: 'Father' }
    },
    address: { type: String, required: true },
    previousSchool: { type: String },
    appliedClass: { type: String, required: true },
    documents: [{
        type: { type: String, enum: ['birth_certificate', 'previous_certificate', 'photo', 'id_card', 'other'] },
        url: { type: String },
        publicId: { type: String },
        uploadedAt: { type: Date, default: Date.now }
    }],
    studentId: { type: String, unique: true, sparse: true },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'registered'],
        default: 'pending'
    },
    remarks: { type: String },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: { type: Date },
    registeredAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

admissionSchema.index({ schoolCode: 1, status: 1, createdAt: -1 });
admissionSchema.pre('save', function () {
    this.updatedAt = Date.now();
});

module.exports = mongoose.model('Admission', admissionSchema);
