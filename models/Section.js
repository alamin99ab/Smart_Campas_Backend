/**
 * 📚 SECTION MODEL
 * Section management for classes
 */

const mongoose = require('mongoose');

const sectionSchema = new mongoose.Schema({
    sectionName: {
        type: String,
        required: true,
        trim: true
    },
    classId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true
    },
    capacity: {
        type: Number,
        default: 40
    },
    roomNumber: {
        type: String,
        trim: true
    },
    schoolCode: {
        type: String,
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, {
    timestamps: true
});

// Index for better performance
sectionSchema.index({ classId: 1, sectionName: 1 });
sectionSchema.index({ schoolCode: 1 });

module.exports = mongoose.model('Section', sectionSchema);
