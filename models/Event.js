/**
 * 📅 EVENT MODEL
 * Industry-level event model for Smart Campus System
 */

const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    eventType: {
        type: String,
        enum: ['Holiday', 'Exam', 'Meeting', 'Sports', 'Cultural', 'Workshop', 'Seminar', 'Other'],
        required: true
    },
    eventDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date
    },
    startTime: String,
    endTime: String,
    venue: {
        type: String,
        required: true
    },
    targetAudience: {
        type: [String],
        enum: ['student', 'teacher', 'parent', 'admin', 'all'],
        default: ['all']
    },
    classes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class'
    }],
    departments: [String],
    attachments: [{
        filename: String,
        originalName: String,
        path: String,
        size: Number,
        mimeType: String
    }],
    isRecurring: {
        type: Boolean,
        default: false
    },
    recurringPattern: {
        type: String,
        enum: ['Daily', 'Weekly', 'Monthly', 'Yearly']
    },
    recurringEndDate: Date,
    status: {
        type: String,
        enum: ['Upcoming', 'Ongoing', 'Completed', 'Cancelled'],
        default: 'Upcoming'
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        default: 'Medium'
    },
    maxParticipants: Number,
    currentParticipants: {
        type: Number,
        default: 0
    },
    registrationRequired: {
        type: Boolean,
        default: false
    },
    registrationDeadline: Date,
    organizer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    contactPerson: String,
    contactPhone: String,
    contactEmail: String,
    schoolCode: {
        type: String,
        required: true,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true
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
eventSchema.index({ schoolCode: 1, eventDate: 1 });
eventSchema.index({ targetAudience: 1, eventDate: 1 });
eventSchema.index({ eventType: 1, eventDate: 1 });
eventSchema.index({ status: 1 });
eventSchema.index({ eventDate: 1 });

// Update the updatedAt field before saving
eventSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    
    // Update status based on event dates
    const now = new Date();
    if (this.endDate) {
        if (now < this.eventDate) {
            this.status = 'Upcoming';
        } else if (now >= this.eventDate && now <= this.endDate) {
            this.status = 'Ongoing';
        } else {
            this.status = 'Completed';
        }
    } else {
        if (now < this.eventDate) {
            this.status = 'Upcoming';
        } else {
            this.status = 'Completed';
        }
    }
    
    next();
});

// Virtual for checking if event is today
eventSchema.virtual('isToday').get(function() {
    const today = new Date();
    return this.eventDate.toDateString() === today.toDateString();
});

// Virtual for checking if registration is open
eventSchema.virtual('isRegistrationOpen').get(function() {
    if (!this.registrationRequired || !this.registrationDeadline) return false;
    return new Date() < this.registrationDeadline;
});

// Virtual for checking if event is full
eventSchema.virtual('isFull').get(function() {
    if (!this.maxParticipants) return false;
    return this.currentParticipants >= this.maxParticipants;
});

// Ensure virtuals are included in JSON
eventSchema.set('toJSON', { virtuals: true });
eventSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Event', eventSchema);
