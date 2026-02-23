/**
 * 📚 LIBRARY MODEL
 * Industry-level library model for Smart Campus System
 */

const mongoose = require('mongoose');

const librarySchema = new mongoose.Schema({
    bookId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Book',
        required: true
    },
    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Student',
        required: true
    },
    issuedDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    dueDate: {
        type: Date,
        required: true
    },
    returnDate: {
        type: Date
    },
    fine: {
        type: Number,
        default: 0,
        min: 0
    },
    status: {
        type: String,
        enum: ['Issued', 'Returned', 'Overdue'],
        default: 'Issued'
    },
    remarks: String,
    issuedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    returnedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    schoolCode: {
        type: String,
        required: true,
        index: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Indexes for better performance
librarySchema.index({ studentId: 1, status: 1 });
librarySchema.index({ bookId: 1, status: 1 });
librarySchema.index({ schoolCode: 1, dueDate: 1 });
librarySchema.index({ dueDate: 1 });

// Update the updatedAt field before saving
librarySchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Virtual for checking if book is overdue
librarySchema.virtual('isOverdue').get(function() {
    return this.dueDate < new Date() && this.status !== 'Returned';
});

// Virtual for days overdue
librarySchema.virtual('daysOverdue').get(function() {
    if (!this.isOverdue) return 0;
    const today = new Date();
    const diffTime = Math.abs(today - this.dueDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Ensure virtuals are included in JSON
librarySchema.set('toJSON', { virtuals: true });
librarySchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Library', librarySchema);
