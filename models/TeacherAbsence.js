/**
 * 👨‍🏫 TEACHER ABSENCE MODEL
 * Advanced teacher leave and substitute management system
 */

const mongoose = require('mongoose');

const teacherAbsenceSchema = new mongoose.Schema({
    // Basic information
    schoolId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'School', 
        required: true 
    },
    teacherId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    
    // Leave details
    leaveType: {
        type: String,
        enum: ['sick_leave', 'casual_leave', 'annual_leave', 'maternity_leave', 'paternity_leave', 'emergency', 'training', 'other'],
        required: true
    },
    
    // Date and time
    startDate: { 
        type: Date, 
        required: true 
    },
    endDate: { 
        type: Date, 
        required: true 
    },
    startTime: String, // For partial day leave
    endTime: String,   // For partial day leave
    
    // Duration calculation
    totalDays: { 
        type: Number, 
        required: true,
        min: 0.5
    },
    isHalfDay: { 
        type: Boolean, 
        default: false 
    },
    
    // Status tracking
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'cancelled', 'completed'],
        default: 'pending'
    },
    
    // Approval workflow
    approvedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    approvedAt: Date,
    rejectionReason: String,
    
    // Leave balance
    leaveBalance: {
        availableBefore: Number,
        usedAfter: Number,
        remaining: Number
    },
    
    // Substitute assignment
    substituteAssignments: [{
        date: { type: Date, required: true },
        periodNumber: { type: Number, required: true },
        classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
        sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
        subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
        roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
        originalRoutineId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdvancedRoutine' },
        
        // Substitute teacher
        substituteTeacherId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User',
            required: true 
        },
        
        // Assignment status
        assignmentStatus: {
            type: String,
            enum: ['assigned', 'accepted', 'rejected', 'completed'],
            default: 'assigned'
        },
        
        // Assignment details
        assignedBy: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User',
            required: true 
        },
        assignedAt: { 
            type: Date, 
            default: Date.now 
        },
        
        // Substitute response
        substituteResponse: String,
        respondedAt: Date,
        
        // Payment information
        substitutePayment: {
            amount: Number,
            currency: { type: String, default: 'BDT' },
            paid: { type: Boolean, default: false },
            paidAt: Date,
            paymentMethod: String,
            transactionId: String
        },
        
        // Notes
        notes: String,
        materialsProvided: { type: Boolean, default: false },
        lessonPlan: String
    }],
    
    // Attachments and documentation
    attachments: [{
        type: { type: String, enum: ['medical_certificate', 'application', 'other'] },
        filename: String,
        originalName: String,
        url: String,
        publicId: String,
        uploadedAt: { type: Date, default: Date.now }
    }],
    
    // Reason and details
    reason: { 
        type: String, 
        required: true 
    },
    detailedReason: String,
    
    // Emergency contact
    emergencyContact: {
        name: String,
        phone: String,
        relationship: String
    },
    
    // Work arrangement during absence
    workArrangement: {
        type: String,
        enum: ['substitute', 'students_self_study', 'class_cancelled', 'online_class', 'other'],
        default: 'substitute'
    },
    
    // Communication
    notificationsSent: [{
        type: { type: String, enum: ['email', 'sms', 'in_app'] },
        recipient: String,
        sentAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['sent', 'delivered', 'failed'], default: 'sent' }
    }],
    
    // Follow-up actions
    followUpRequired: { type: Boolean, default: false },
    followUpActions: [{
        action: String,
        dueDate: Date,
        completed: { type: Boolean, default: false },
        completedAt: Date,
        completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    
    // Impact assessment
    impactAssessment: {
        classesAffected: { type: Number, default: 0 },
        studentsAffected: { type: Number, default: 0 },
        substituteCost: { type: Number, default: 0 },
        academicImpact: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' }
    },
    
    // Audit fields
    createdBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    updatedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
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
teacherAbsenceSchema.index({ schoolId: 1, teacherId: 1, status: 1 });
teacherAbsenceSchema.index({ schoolId: 1, startDate: 1, endDate: 1 });
teacherAbsenceSchema.index({ schoolId: 1, status: 1, startDate: 1 });
teacherAbsenceSchema.index({ 'substituteAssignments.substituteTeacherId': 1, 'substituteAssignments.date': 1 });

// Pre-save middleware
teacherAbsenceSchema.pre('save', function() {
    this.updatedAt = Date.now();
});

// Virtual for checking if leave is currently active
teacherAbsenceSchema.virtual('isActive').get(function() {
    const now = new Date();
    return now >= this.startDate && now <= this.endDate && this.status === 'approved';
});

// Virtual for checking if leave is upcoming
teacherAbsenceSchema.virtual('isUpcoming').get(function() {
    const now = new Date();
    return now < this.startDate && this.status === 'approved';
});

// Instance methods
teacherAbsenceSchema.methods.canBeCancelled = function() {
    const now = new Date();
    const hoursUntilStart = (this.startDate - now) / (1000 * 60 * 60);
    return this.status === 'approved' && hoursUntilStart > 24;
};

teacherAbsenceSchema.methods.requiresSubstitute = function() {
    return this.workArrangement === 'substitute';
};

teacherAbsenceSchema.methods.getAffectedPeriods = function() {
    return this.substituteAssignments.map(assignment => ({
        date: assignment.date,
        periodNumber: assignment.periodNumber,
        classId: assignment.classId,
        subjectId: assignment.subjectId
    }));
};

teacherAbsenceSchema.methods.calculateTotalCost = function() {
    return this.substituteAssignments.reduce((total, assignment) => {
        return total + (assignment.substitutePayment?.amount || 0);
    }, 0);
};

// Static methods
teacherAbsenceSchema.statics.findActiveLeaves = function(schoolId, date) {
    return this.find({
        schoolId,
        status: 'approved',
        startDate: { $lte: date },
        endDate: { $gte: date }
    }).populate('teacherId', 'name email');
};

teacherAbsenceSchema.statics.findUpcomingLeaves = function(schoolId, days = 7) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);
    
    return this.find({
        schoolId,
        status: 'approved',
        startDate: { $gte: new Date(), $lte: futureDate }
    }).populate('teacherId', 'name email')
     .sort({ startDate: 1 });
};

teacherAbsenceSchema.statics.getTeacherLeaveHistory = function(schoolId, teacherId, academicYear) {
    const yearStart = new Date(academicYear, 0, 1);
    const yearEnd = new Date(academicYear, 11, 31);
    
    return this.find({
        schoolId,
        teacherId,
        startDate: { $gte: yearStart, $lte: yearEnd }
    }).sort({ startDate: -1 });
};

teacherAbsenceSchema.statics.getSubstituteAvailability = function(schoolId, date, periodNumber) {
    return this.aggregate([
        {
            $match: {
                schoolId: new mongoose.Types.ObjectId(schoolId),
                status: 'approved',
                startDate: { $lte: date },
                endDate: { $gte: date }
            }
        },
        { $unwind: '$substituteAssignments' },
        {
            $match: {
                'substituteAssignments.date': new Date(date),
                'substituteAssignments.periodNumber': periodNumber
            }
        },
        {
            $group: {
                _id: '$substituteAssignments.substituteTeacherId',
                assignments: { $push: '$substituteAssignments' }
            }
        }
    ]);
};

teacherAbsenceSchema.statics.getLeaveStatistics = function(schoolId, startDate, endDate) {
    return this.aggregate([
        {
            $match: {
                schoolId: new mongoose.Types.ObjectId(schoolId),
                startDate: { $gte: new Date(startDate), $lte: new Date(endDate) }
            }
        },
        {
            $group: {
                _id: {
                    leaveType: '$leaveType',
                    status: '$status'
                },
                count: { $sum: 1 },
                totalDays: { $sum: '$totalDays' },
                totalCost: { $sum: '$substituteAssignments.substitutePayment.amount' }
            }
        },
        {
            $group: {
                _id: '$_id.leaveType',
                statuses: {
                    $push: {
                        status: '$_id.status',
                        count: '$count',
                        totalDays: '$totalDays',
                        totalCost: '$totalCost'
                    }
                },
                totalCount: { $sum: '$count' },
                totalDays: { $sum: '$totalDays' },
                totalCost: { $sum: '$totalCost' }
            }
        }
    ]);
};

teacherAbsenceSchema.statics.getTeacherLeaveBalance = function(schoolId, teacherId, leaveType) {
    // This would typically integrate with a separate leave balance system
    // For now, returning a mock implementation
    return Promise.resolve({
        available: 15, // Default annual leave
        used: 0,
        remaining: 15
    });
};

module.exports = mongoose.model('TeacherAbsence', teacherAbsenceSchema);
