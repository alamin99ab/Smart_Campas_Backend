/**
 * Room Model - Classroom management for Smart Campus
 * Prevents overbooking in routine
 */
const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    schoolCode: { type: String, required: true, index: true },
    roomNumber: { type: String, required: true },
    building: { type: String },
    floor: { type: String },
    capacity: { type: Number, default: 40 },
    roomType: { type: String, enum: ['Classroom', 'Lab', 'Library', 'Hall', 'Office'], default: 'Classroom' },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

roomSchema.index({ schoolCode: 1, roomNumber: 1 }, { unique: true });

module.exports = mongoose.model('Room', roomSchema);
