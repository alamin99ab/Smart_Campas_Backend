/**
 * 📅 ADVANCED CLASS ROUTINE MODEL
 * Industry-level routine management with conflict detection
 */

const mongoose = require('mongoose');

const advancedRoutineSchema = new mongoose.Schema({
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
    
    // Class and section information
    classId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Class', 
        required: true 
    },
    sectionId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Section' 
    },
    
    // Schedule information
    day: { 
        type: String, 
        enum: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
        required: true 
    },
    periodNumber: { 
        type: Number, 
        required: true,
        min: 1,
        max: 10
    },
    startTime: { 
        type: String, 
        required: true,
        validate: {
            validator: function(v) {
                return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
            },
            message: 'Start time must be in HH:MM format'
        }
    },
    endTime: { 
        type: String, 
        required: true,
        validate: {
            validator: function(v) {
                return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v);
            },
            message: 'End time must be in HH:MM format'
        }
    },
    
    // Subject and teacher
    subjectId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Subject', 
        required: true 
    },
    teacherId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Teacher', 
        required: true 
    },
    
    // Room information
    roomId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Room' 
    },
    roomNumber: String,
    
    // Routine type
    routineType: {
        type: String,
        enum: ['regular', 'exam', 'special', 'substitute'],
        default: 'regular'
    },
    
    // Status and validation
    status: {
        type: String,
        enum: ['draft', 'published', 'archived', 'cancelled'],
        default: 'draft'
    },
    
    // Conflict detection
    conflicts: [{
        type: {
            type: String,
            enum: ['teacher_conflict', 'room_conflict', 'class_conflict', 'teacher_load_exceeded'],
            required: true
        },
        description: String,
        conflictingResourceId: mongoose.Schema.Types.ObjectId,
        severity: {
            type: String,
            enum: ['low', 'medium', 'high', 'critical'],
            default: 'medium'
        },
        resolved: { type: Boolean, default: false },
        resolvedAt: Date,
        resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    
    // Substitute information
    substituteInfo: {
        originalTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
        substituteTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Teacher' },
        reason: String,
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        approvedAt: Date,
        startDate: Date,
        endDate: Date
    },
    
    // Additional information
    notes: String,
    isDoublePeriod: { type: Boolean, default: false },
    linkedPeriodId: { type: mongoose.Schema.Types.ObjectId, ref: 'AdvancedRoutine' },
    
    // Break information
    isBreak: { type: Boolean, default: false },
    breakType: {
        type: String,
        enum: ['short_break', 'lunch_break', 'tea_break'],
        required: function() { return this.isBreak; }
    },
    
    // Academic details
    topic: String,
    lessonPlan: String,
    resources: [{
        type: { type: String, enum: ['document', 'video', 'link', 'assignment'] },
        title: String,
        url: String,
        description: String
    }],
    
    // Attendance tracking
    attendanceTracking: {
        enabled: { type: Boolean, default: true },
        autoMark: { type: Boolean, default: false },
        checkInTime: String,
        checkOutTime: String
    },
    
    // Audit fields
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    publishedAt: Date,
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes for better performance
advancedRoutineSchema.index({ schoolId: 1, academicSessionId: 1, day: 1, periodNumber: 1 });
advancedRoutineSchema.index({ teacherId: 1, day: 1, startTime: 1 });
advancedRoutineSchema.index({ roomId: 1, day: 1, startTime: 1 });
advancedRoutineSchema.index({ classId: 1, sectionId: 1, day: 1 });
advancedRoutineSchema.index({ status: 1 });

// Pre-save middleware for conflict detection
advancedRoutineSchema.pre('save', async function() {
    this.updatedAt = Date.now();
    
    // Only check conflicts for regular routines
    if (this.routineType === 'regular' && !this.isBreak) {
        await this.detectConflicts();
    }
});

// Instance methods
advancedRoutineSchema.methods.detectConflicts = async function() {
    const conflicts = [];
    
    // Check teacher conflict
    const teacherConflict = await this.constructor.findOne({
        _id: { $ne: this._id },
        schoolId: this.schoolId,
        teacherId: this.teacherId,
        day: this.day,
        $or: [
            { startTime: { $lt: this.endTime }, endTime: { $gt: this.startTime } }
        ],
        status: { $ne: 'cancelled' }
    });
    
    if (teacherConflict) {
        conflicts.push({
            type: 'teacher_conflict',
            description: `Teacher is already scheduled at this time`,
            conflictingResourceId: teacherConflict._id,
            severity: 'high'
        });
    }
    
    // Check room conflict
    if (this.roomId) {
        const roomConflict = await this.constructor.findOne({
            _id: { $ne: this._id },
            schoolId: this.schoolId,
            roomId: this.roomId,
            day: this.day,
            $or: [
                { startTime: { $lt: this.endTime }, endTime: { $gt: this.startTime } }
            ],
            status: { $ne: 'cancelled' }
        });
        
        if (roomConflict) {
            conflicts.push({
                type: 'room_conflict',
                description: `Room is already occupied at this time`,
                conflictingResourceId: roomConflict._id,
                severity: 'high'
            });
        }
    }
    
    // Check class conflict
    const classConflict = await this.constructor.findOne({
        _id: { $ne: this._id },
        schoolId: this.schoolId,
        classId: this.classId,
        sectionId: this.sectionId,
        day: this.day,
        $or: [
            { startTime: { $lt: this.endTime }, endTime: { $gt: this.startTime } }
        ],
        status: { $ne: 'cancelled' }
    });
    
    if (classConflict) {
        conflicts.push({
            type: 'class_conflict',
            description: `Class is already scheduled at this time`,
            conflictingResourceId: classConflict._id,
            severity: 'critical'
        });
    }
    
    // Check teacher load
    const teacherLoad = await this.constructor.countDocuments({
        schoolId: this.schoolId,
        teacherId: this.teacherId,
        academicSessionId: this.academicSessionId,
        status: { $ne: 'cancelled' }
    });
    
    // Get teacher's maximum load from school settings
    const School = require('./School');
    const school = await School.findById(this.schoolId);
    const maxTeacherLoad = school?.academicSettings?.maxTeacherLoad || 30;
    
    if (teacherLoad >= maxTeacherLoad) {
        conflicts.push({
            type: 'teacher_load_exceeded',
            description: `Teacher has exceeded maximum load of ${maxTeacherLoad} periods`,
            severity: 'medium'
        });
    }
    
    this.conflicts = conflicts;
};

advancedRoutineSchema.methods.hasConflicts = function() {
    return this.conflicts && this.conflicts.some(conflict => !conflict.resolved);
};

advancedRoutineSchema.methods.getUnresolvedConflicts = function() {
    return this.conflicts ? this.conflicts.filter(conflict => !conflict.resolved) : [];
};

advancedRoutineSchema.methods.resolveConflict = function(conflictIndex, resolvedBy) {
    if (this.conflicts && this.conflicts[conflictIndex]) {
        this.conflicts[conflictIndex].resolved = true;
        this.conflicts[conflictIndex].resolvedAt = new Date();
        this.conflicts[conflictIndex].resolvedBy = resolvedBy;
    }
};

// Static methods
advancedRoutineSchema.statics.findByTeacher = function(teacherId, day) {
    const query = { teacherId, status: { $ne: 'cancelled' } };
    if (day) query.day = day;
    
    return this.find(query)
        .populate('classId', 'className section')
        .populate('subjectId', 'subjectName subjectCode')
        .populate('roomId', 'roomNumber')
        .sort({ day: 1, periodNumber: 1 });
};

advancedRoutineSchema.statics.findByClass = function(classId, sectionId, day) {
    const query = { classId, status: { $ne: 'cancelled' } };
    if (sectionId) query.sectionId = sectionId;
    if (day) query.day = day;
    
    return this.find(query)
        .populate('teacherId', 'name email')
        .populate('subjectId', 'subjectName subjectCode')
        .populate('roomId', 'roomNumber')
        .sort({ day: 1, periodNumber: 1 });
};

advancedRoutineSchema.statics.getWeeklyRoutine = function(schoolId, classId, sectionId) {
    return this.find({
        schoolId,
        classId,
        sectionId,
        status: 'published',
        routineType: 'regular'
    })
    .populate('teacherId', 'name email')
    .populate('subjectId', 'subjectName subjectCode')
    .populate('roomId', 'roomNumber')
    .sort({ day: 1, periodNumber: 1 });
};

advancedRoutineSchema.statics.getTeacherSchedule = function(schoolId, teacherId, startDate, endDate) {
    return this.find({
        schoolId,
        teacherId,
        status: { $ne: 'cancelled' },
        createdAt: { $gte: startDate, $lte: endDate }
    })
    .populate('classId', 'className section')
    .populate('subjectId', 'subjectName subjectCode')
    .populate('roomId', 'roomNumber')
    .sort({ createdAt: -1 });
};

advancedRoutineSchema.statics.detectAllConflicts = async function(schoolId, academicSessionId) {
    const routines = await this.find({
        schoolId,
        academicSessionId,
        status: { $ne: 'cancelled' }
    });
    
    const allConflicts = [];
    
    for (const routine of routines) {
        await routine.detectConflicts();
        if (routine.hasConflicts()) {
            allConflicts.push({
                routineId: routine._id,
                conflicts: routine.getUnresolvedConflicts()
            });
        }
    }
    
    return allConflicts;
};

module.exports = mongoose.model('AdvancedRoutine', advancedRoutineSchema);
