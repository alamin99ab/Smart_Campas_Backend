/**
 * 📝 ADVANCED ATTENDANCE MODEL
 * Industry-level attendance system with auto-calculation and alerts
 */

const mongoose = require('mongoose');

const advancedAttendanceSchema = new mongoose.Schema({
    // Basic information
    schoolId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'School', 
        required: true 
    },
    academicSessionId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'AcademicSession', 
        required: true 
    },
    
    // Attendance type
    attendanceType: {
        type: String,
        enum: ['student', 'teacher'],
        required: true
    },
    
    // For student attendance
    studentId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    classId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Class' 
    },
    sectionId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Section' 
    },
    
    // For teacher attendance
    teacherId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    
    // Date and time
    date: { 
        type: Date, 
        required: true 
    },
    checkInTime: { 
        type: String,
        validate: {
            validator: function(v) {
                return !v || /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
            },
            message: 'Check-in time must be in HH:MM format'
        }
    },
    checkOutTime: { 
        type: String,
        validate: {
            validator: function(v) {
                return !v || /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
            },
            message: 'Check-out time must be in HH:MM format'
        }
    },
    
    // Subject and period information (for student attendance)
    subjectId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Subject' 
    },
    periodNumber: Number,
    roomId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Room' 
    },
    routineId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'AdvancedRoutine' 
    },
    
    // Attendance status
    status: {
        type: String,
        enum: ['present', 'absent', 'late', 'half_day', 'leave', 'excused'],
        required: true
    },
    
    // Late/Early details
    lateMinutes: Number,
    earlyLeaveMinutes: Number,
    isLate: { type: Boolean, default: false },
    isEarlyLeave: { type: Boolean, default: false },
    
    // Leave information
    leaveType: {
        type: String,
        enum: ['sick_leave', 'casual_leave', 'annual_leave', 'maternity_leave', 'paternity_leave', 'emergency', 'training', 'other']
    },
    leaveApprovedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    leaveDocument: {
        filename: String,
        url: String,
        publicId: String
    },
    
    // GPS and location tracking (optional)
    location: {
        latitude: Number,
        longitude: Number,
        address: String,
        accuracy: Number
    },
    deviceInfo: {
        deviceId: String,
        deviceType: String,
        appVersion: String
    },
    
    // Biometric verification (optional)
    biometricData: {
        type: { type: String, enum: ['fingerprint', 'face', 'iris'] },
        templateId: String,
        verified: { type: Boolean, default: false }
    },
    
    // Marked by information
    markedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    markedByRole: {
        type: String,
        enum: ['teacher', 'principal', 'admin', 'self', 'system'],
        required: true
    },
    markingMethod: {
        type: String,
        enum: ['manual', 'biometric', 'gps', 'rfid', 'face_recognition', 'auto'],
        default: 'manual'
    },
    
    // Notes and comments
    notes: String,
    teacherComments: String,
    parentComments: String,
    
    // Verification and approval
    verified: { type: Boolean, default: false },
    verifiedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    verifiedAt: Date,
    
    // Attendance alerts
    alerts: [{
        type: {
            type: String,
            enum: ['low_attendance', 'consecutive_absences', 'late_arrival', 'early_leave', 'irregular_pattern'],
            required: true
        },
        severity: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            required: true
        },
        message: String,
        triggeredAt: { type: Date, default: Date.now },
        acknowledged: { type: Boolean, default: false },
        acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        acknowledgedAt: Date
    }],
    
    // Attendance statistics (calculated)
    monthlyStats: {
        totalDays: { type: Number, default: 0 },
        presentDays: { type: Number, default: 0 },
        absentDays: { type: Number, default: 0 },
        lateDays: { type: Number, default: 0 },
        percentage: { type: Number, default: 0 }
    },
    
    // Academic impact
    academicImpact: {
        classesMissed: { type: Number, default: 0 },
        topicsMissed: [String],
        catchUpRequired: { type: Boolean, default: false },
        catchUpPlan: String
    },
    
    // Parent notifications
    parentNotifications: [{
        type: { type: String, enum: ['sms', 'email', 'in_app', 'push'] },
        recipient: String,
        sentAt: { type: Date, default: Date.now },
        status: { type: String, enum: ['sent', 'delivered', 'failed'], default: 'sent' },
        messageId: String
    }],
    
    // Audit fields
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
advancedAttendanceSchema.index({ schoolId: 1, attendanceType: 1, date: 1 });
advancedAttendanceSchema.index({ schoolId: 1, studentId: 1, date: 1 });
advancedAttendanceSchema.index({ schoolId: 1, teacherId: 1, date: 1 });
advancedAttendanceSchema.index({ schoolId: 1, classId: 1, sectionId: 1, date: 1 });
advancedAttendanceSchema.index({ schoolId: 1, status: 1, date: 1 });

// Compound indexes
advancedAttendanceSchema.index({ schoolId: 1, studentId: 1, academicSessionId: 1 });
advancedAttendanceSchema.index({ schoolId: 1, teacherId: 1, academicSessionId: 1 });

// Pre-save middleware
advancedAttendanceSchema.pre('save', function() {
    this.updatedAt = Date.now();
});

// Virtual for checking if attendance is for today
advancedAttendanceSchema.virtual('isToday').get(function() {
    const today = new Date();
    return this.date.toDateString() === today.toDateString();
});

// Virtual for calculating attendance duration
advancedAttendanceSchema.virtual('duration').get(function() {
    if (this.checkInTime && this.checkOutTime) {
        const checkIn = new Date(`2000-01-01T${this.checkInTime}`);
        const checkOut = new Date(`2000-01-01T${this.checkOutTime}`);
        return (checkOut - checkIn) / (1000 * 60); // Duration in minutes
    }
    return 0;
});

// Instance methods
advancedAttendanceSchema.methods.calculateMonthlyStats = async function() {
    const startOfMonth = new Date(this.date.getFullYear(), this.date.getMonth(), 1);
    const endOfMonth = new Date(this.date.getFullYear(), this.date.getMonth() + 1, 0);
    
    const monthlyAttendance = await this.constructor.find({
        schoolId: this.schoolId,
        attendanceType: this.attendanceType,
        studentId: this.studentId,
        teacherId: this.teacherId,
        date: { $gte: startOfMonth, $lte: endOfMonth }
    });
    
    const totalDays = monthlyAttendance.length;
    const presentDays = monthlyAttendance.filter(a => a.status === 'present').length;
    const absentDays = monthlyAttendance.filter(a => a.status === 'absent').length;
    const lateDays = monthlyAttendance.filter(a => a.isLate).length;
    const percentage = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
    
    this.monthlyStats = {
        totalDays,
        presentDays,
        absentDays,
        lateDays,
        percentage: Math.round(percentage * 100) / 100
    };
    
    await this.save();
    return this.monthlyStats;
};

advancedAttendanceSchema.methods.checkAttendanceAlerts = async function() {
    const alerts = [];
    
    if (this.attendanceType === 'student') {
        // Check for low attendance
        if (this.monthlyStats.percentage < 75) {
            alerts.push({
                type: 'low_attendance',
                severity: this.monthlyStats.percentage < 60 ? 'critical' : 'high',
                message: `Attendance percentage is ${this.monthlyStats.percentage}% (below 75%)`
            });
        }
        
        // Check for consecutive absences
        const consecutiveAbsences = await this.getConsecutiveAbsences();
        if (consecutiveAbsences >= 3) {
            alerts.push({
                type: 'consecutive_absences',
                severity: consecutiveAbsences >= 5 ? 'critical' : 'high',
                message: `${consecutiveAbsences} consecutive days absent`
            });
        }
        
        // Check for late arrival pattern
        const latePattern = await this.getLatePattern();
        if (latePattern >= 3) {
            alerts.push({
                type: 'late_arrival',
                severity: 'medium',
                message: `Late arrival pattern detected (${latePattern} times this month)`
            });
        }
    }
    
    this.alerts = alerts;
    if (alerts.length > 0) {
        await this.save();
        await this.sendAlertNotifications();
    }
    
    return alerts;
};

advancedAttendanceSchema.methods.getConsecutiveAbsences = async function() {
    const attendances = await this.constructor.find({
        schoolId: this.schoolId,
        studentId: this.studentId,
        date: { $lte: this.date }
    }).sort({ date: -1 }).limit(10);
    
    let consecutive = 0;
    for (const attendance of attendances) {
        if (attendance.status === 'absent') {
            consecutive++;
        } else {
            break;
        }
    }
    
    return consecutive;
};

advancedAttendanceSchema.methods.getLatePattern = async function() {
    const startOfMonth = new Date(this.date.getFullYear(), this.date.getMonth(), 1);
    const endOfMonth = new Date(this.date.getFullYear(), this.date.getMonth() + 1, 0);
    
    const lateAttendances = await this.constructor.find({
        schoolId: this.schoolId,
        studentId: this.studentId,
        date: { $gte: startOfMonth, $lte: endOfMonth },
        isLate: true
    });
    
    return lateAttendances.length;
};

advancedAttendanceSchema.methods.sendAlertNotifications = async function() {
    const User = require('./User');
    
    if (this.attendanceType === 'student' && this.studentId) {
        const student = await User.findById(this.studentId).populate('parentIds');
        
        if (student && student.parentIds && student.parentIds.length > 0) {
            for (const parent of student.parentIds) {
                // Send notification to parent
                this.parentNotifications.push({
                    type: 'in_app',
                    recipient: parent._id,
                    status: 'sent'
                });
            }
        }
    }
    
    await this.save();
};

// Static methods
advancedAttendanceSchema.statics.getStudentAttendanceReport = async function(
    schoolId, 
    studentId, 
    academicSessionId,
    startDate,
    endDate
) {
    const matchStage = {
        schoolId: new mongoose.Types.ObjectId(schoolId),
        studentId: new mongoose.Types.ObjectId(studentId),
        attendanceType: 'student'
    };
    
    if (academicSessionId) {
        matchStage.academicSessionId = new mongoose.Types.ObjectId(academicSessionId);
    }
    
    if (startDate && endDate) {
        matchStage.date = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    }
    
    const attendanceData = await this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: {
                    year: { $year: '$date' },
                    month: { $month: '$date' }
                },
                totalDays: { $sum: 1 },
                presentDays: {
                    $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
                },
                absentDays: {
                    $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
                },
                leaveDays: {
                    $sum: { $cond: [{ $in: ['$status', ['leave', 'excused']] }, 1, 0] }
                },
                lateDays: {
                    $sum: { $cond: ['$isLate', 1, 0] }
                }
            }
        },
        {
            $addFields: {
                percentage: {
                    $multiply: [
                        { $divide: ['$presentDays', '$totalDays'] },
                        100
                    ]
                }
            }
        },
        { $sort: { '_id.year': -1, '_id.month': 1 } }
    ]);
    
    return attendanceData;
};

advancedAttendanceSchema.statics.getClassAttendanceReport = async function(
    schoolId,
    classId,
    sectionId,
    date
) {
    const attendances = await this.find({
        schoolId,
        classId,
        sectionId,
        date: new Date(date),
        attendanceType: 'student'
    }).populate('studentId', 'name rollNumber')
     .populate('subjectId', 'subjectName');
    
    const summary = {
        totalStudents: attendances.length,
        present: attendances.filter(a => a.status === 'present').length,
        absent: attendances.filter(a => a.status === 'absent').length,
        late: attendances.filter(a => a.isLate).length,
        leave: attendances.filter(a => ['leave', 'excused'].includes(a.status)).length
    };
    
    summary.percentage = summary.totalStudents > 0 
        ? Math.round((summary.present / summary.totalStudents) * 100) 
        : 0;
    
    return {
        attendances,
        summary
    };
};

advancedAttendanceSchema.statics.getTeacherAttendanceReport = async function(
    schoolId,
    teacherId,
    academicSessionId
) {
    const matchStage = {
        schoolId: new mongoose.Types.ObjectId(schoolId),
        teacherId: new mongoose.Types.ObjectId(teacherId),
        attendanceType: 'teacher'
    };
    
    if (academicSessionId) {
        matchStage.academicSessionId = new mongoose.Types.ObjectId(academicSessionId);
    }
    
    const report = await this.aggregate([
        { $match: matchStage },
        {
            $group: {
                _id: null,
                totalDays: { $sum: 1 },
                presentDays: {
                    $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
                },
                absentDays: {
                    $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
                },
                leaveDays: {
                    $sum: { $cond: [{ $in: ['$status', ['leave', 'excused']] }, 1, 0] }
                },
                lateDays: {
                    $sum: { $cond: ['$isLate', 1, 0] }
                },
                averageCheckIn: { $avg: '$checkInTime' },
                averageCheckOut: { $avg: '$checkOutTime' }
            }
        },
        {
            $addFields: {
                percentage: {
                    $multiply: [
                        { $divide: ['$presentDays', '$totalDays'] },
                        100
                    ]
                }
            }
        }
    ]);
    
    return report[0] || {
        totalDays: 0,
        presentDays: 0,
        absentDays: 0,
        leaveDays: 0,
        lateDays: 0,
        percentage: 0
    };
};

advancedAttendanceSchema.statics.getAttendanceAnalytics = async function(
    schoolId,
    startDate,
    endDate,
    groupBy = 'day'
) {
    const groupStage = {};
    
    switch (groupBy) {
        case 'day':
            groupStage._id = { $dateToString: { format: '%Y-%m-%d', date: '$date' } };
            break;
        case 'week':
            groupStage._id = { $week: '$date' };
            break;
        case 'month':
            groupStage._id = { $dateToString: { format: '%Y-%m', date: '$date' } };
            break;
    }
    
    const analytics = await this.aggregate([
        {
            $match: {
                schoolId: new mongoose.Types.ObjectId(schoolId),
                date: {
                    $gte: new Date(startDate),
                    $lte: new Date(endDate)
                }
            }
        },
        {
            $group: {
                ...groupStage,
                totalAttendances: { $sum: 1 },
                presentCount: {
                    $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] }
                },
                absentCount: {
                    $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] }
                },
                lateCount: {
                    $sum: { $cond: ['$isLate', 1, 0] }
                }
            }
        },
        {
            $addFields: {
                attendanceRate: {
                    $multiply: [
                        { $divide: ['$presentCount', '$totalAttendances'] },
                        100
                    ]
                }
            }
        },
        { $sort: { '_id': 1 } }
    ]);
    
    return analytics;
};

module.exports = mongoose.model('AdvancedAttendance', advancedAttendanceSchema);
