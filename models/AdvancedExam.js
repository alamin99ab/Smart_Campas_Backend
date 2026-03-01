/**
 * 🧾 ADVANCED EXAM MODEL
 * Industry-level exam and result system with GPA calculation
 */

const mongoose = require('mongoose');

const advancedExamSchema = new mongoose.Schema({
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
    
    // Exam details
    examName: { 
        type: String, 
        required: true 
    },
    examType: {
        type: String,
        enum: ['midterm', 'final', 'weekly_test', 'assignment', 'practical', 'quiz', 'project', 'comprehensive'],
        required: true
    },
    examCode: {
        type: String,
        unique: true,
        required: true
    },
    
    // Class and subject information
    classId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Class', 
        required: true 
    },
    sectionId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Section' 
    },
    subjectId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Subject', 
        required: true 
    },
    
    // Schedule
    startDate: { 
        type: Date, 
        required: true 
    },
    endDate: { 
        type: Date, 
        required: true 
    },
    duration: { 
        type: Number, // in minutes
        required: true 
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
    
    // Marks configuration
    marksConfiguration: {
        fullMarks: { 
            type: Number, 
            required: true,
            min: 1
        },
        passMarks: { 
            type: Number, 
            required: true,
            min: 0
        },
        passPercentage: {
            type: Number,
            default: function() {
                return Math.round((this.passMarks / this.marksConfiguration.fullMarks) * 100);
            }
        },
        gradingScale: {
            type: String,
            enum: ['gpa_4', 'gpa_5', 'percentage', 'custom'],
            default: 'gpa_5'
        },
        gradeDistribution: [{
            grade: String,
            minPercentage: Number,
            maxPercentage: Number,
            gpa: Number,
            description: String
        }]
    },
    
    // Exam status
    status: {
        type: String,
        enum: ['draft', 'scheduled', 'in_progress', 'completed', 'cancelled', 'published'],
        default: 'draft'
    },
    
    // Room and invigilation
    roomId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Room' 
    },
    invigilators: [{
        teacherId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User' 
        },
        role: {
            type: String,
            enum: ['chief_invigilator', 'invigilator', 'assistant'],
            default: 'invigilator'
        }
    }],
    
    // Student registration
    registeredStudents: [{
        studentId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User' 
        },
        rollNumber: String,
        registrationDate: { 
            type: Date, 
            default: Date.now 
        },
        attendanceStatus: {
            type: String,
            enum: ['present', 'absent', 'late', 'excused'],
            default: 'pending'
        },
        specialNeeds: String,
        accommodations: String
    }],
    
    // Results
    results: [{
        studentId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User' 
        },
        marksObtained: { 
            type: Number,
            min: 0,
            max: function() { return this.marksConfiguration?.fullMarks || 100; }
        },
        percentage: Number,
        grade: String,
        gpa: Number,
        remarks: String,
        
        // Component-wise marks (for detailed evaluation)
        components: [{
            componentName: String,
            maxMarks: Number,
            obtainedMarks: Number,
            weightage: Number
        }],
        
        // Submission details
        submittedBy: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User' 
        },
        submittedAt: Date,
        
        // Verification
        verified: { type: Boolean, default: false },
        verifiedBy: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User' 
        },
        verifiedAt: Date,
        
        // Moderation
        moderated: { type: Boolean, default: false },
        originalMarks: Number,
        moderationReason: String,
        moderatedBy: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User' 
        },
        moderatedAt: Date
    }],
    
    // Exam materials
    materials: [{
        type: { 
            type: String, 
            enum: ['question_paper', 'answer_sheet', 'instruction', 'reference_material'] 
        },
        title: String,
        filename: String,
        url: String,
        publicId: String,
        uploadedAt: { 
            type: Date, 
            default: Date.now 
        },
        uploadedBy: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User' 
        }
    }],
    
    // Instructions and guidelines
    instructions: [{
        type: { 
            type: String, 
            enum: ['general', 'subject_specific', 'special_instruction'] 
        },
        title: String,
        content: String,
        order: Number
    }],
    
    // Evaluation criteria
    evaluationCriteria: [{
        criterion: String,
        description: String,
        maxMarks: Number,
        weightage: Number
    }],
    
    // Exam settings
    settings: {
        allowLateSubmission: { type: Boolean, default: false },
        lateSubmissionPenalty: { type: Number, default: 0 },
        showResultsImmediately: { type: Boolean, default: false },
        allowRevaluation: { type: Boolean, default: false },
        revaluationDeadline: Date,
        revaluationFee: { type: Number, default: 0 }
    },
    
    // Statistics
    statistics: {
        totalRegistered: { type: Number, default: 0 },
        totalAppeared: { type: Number, default: 0 },
        totalPassed: { type: Number, default: 0 },
        totalFailed: { type: Number, default: 0 },
        averageMarks: { type: Number, default: 0 },
        highestMarks: { type: Number, default: 0 },
        lowestMarks: { type: Number, default: 0 },
        passPercentage: { type: Number, default: 0 },
        gradeDistribution: [{
            grade: String,
            count: Number,
            percentage: Number
        }]
    },
    
    // Notifications
    notificationsSent: [{
        type: { 
            type: String, 
            enum: ['exam_schedule', 'reminder', 'result_published', 'revaluation_deadline'] 
        },
        recipientType: {
            type: String,
            enum: ['students', 'teachers', 'parents', 'all']
        },
        sentAt: { 
            type: Date, 
            default: Date.now 
        },
        status: { 
            type: String, 
            enum: ['sent', 'delivered', 'failed'], 
            default: 'sent' 
        }
    }],
    
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
    publishedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    publishedAt: Date,
    
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
advancedExamSchema.index({ schoolId: 1, academicSessionId: 1 });
advancedExamSchema.index({ schoolId: 1, classId: 1, subjectId: 1 });
advancedExamSchema.index({ schoolId: 1, examType: 1, status: 1 });
advancedExamSchema.index({ schoolId: 1, startDate: 1, endDate: 1 });
advancedExamSchema.index({ 'results.studentId': 1 });

// Pre-save middleware
advancedExamSchema.pre('save', function() {
    this.updatedAt = Date.now();
    
    // Update statistics if results have changed
    if (this.isModified('results')) {
        this.calculateStatistics();
    }
});

// Virtual for checking if exam is today
advancedExamSchema.virtual('isToday').get(function() {
    const today = new Date();
    return today >= this.startDate && today <= this.endDate;
});

// Virtual for exam duration in hours
advancedExamSchema.virtual('durationInHours').get(function() {
    return Math.round(this.duration / 60 * 100) / 100;
});

// Instance methods
advancedExamSchema.methods.calculateStatistics = function() {
    const results = this.results.filter(r => r.marksObtained !== undefined && r.marksObtained !== null);
    
    if (results.length === 0) {
        this.statistics = {
            totalRegistered: this.registeredStudents.length,
            totalAppeared: 0,
            totalPassed: 0,
            totalFailed: 0,
            averageMarks: 0,
            highestMarks: 0,
            lowestMarks: 0,
            passPercentage: 0,
            gradeDistribution: []
        };
        return;
    }
    
    const marks = results.map(r => r.marksObtained);
    const totalPassed = results.filter(r => r.marksObtained >= this.marksConfiguration.passMarks).length;
    
    // Calculate grade distribution
    const gradeDistribution = {};
    results.forEach(result => {
        const grade = result.grade || 'N/A';
        gradeDistribution[grade] = (gradeDistribution[grade] || 0) + 1;
    });
    
    const gradeDistributionArray = Object.entries(gradeDistribution).map(([grade, count]) => ({
        grade,
        count,
        percentage: Math.round((count / results.length) * 100)
    }));
    
    this.statistics = {
        totalRegistered: this.registeredStudents.length,
        totalAppeared: results.length,
        totalPassed,
        totalFailed: results.length - totalPassed,
        averageMarks: Math.round((marks.reduce((a, b) => a + b, 0) / marks.length) * 100) / 100,
        highestMarks: Math.max(...marks),
        lowestMarks: Math.min(...marks),
        passPercentage: Math.round((totalPassed / results.length) * 100),
        gradeDistribution: gradeDistributionArray
    };
};

advancedExamSchema.methods.calculateGradeAndGPA = function(marksObtained) {
    const percentage = (marksObtained / this.marksConfiguration.fullMarks) * 100;
    const scale = this.marksConfiguration.gradingScale;
    
    let grade, gpa;
    
    if (scale === 'gpa_5') {
        if (percentage >= 80) { grade = 'A+'; gpa = 5.00; }
        else if (percentage >= 70) { grade = 'A'; gpa = 4.00; }
        else if (percentage >= 60) { grade = 'A-'; gpa = 3.50; }
        else if (percentage >= 50) { grade = 'B'; gpa = 3.00; }
        else if (percentage >= 40) { grade = 'C'; gpa = 2.00; }
        else if (percentage >= 33) { grade = 'D'; gpa = 1.00; }
        else { grade = 'F'; gpa = 0.00; }
    } else if (scale === 'gpa_4') {
        if (percentage >= 90) { grade = 'A'; gpa = 4.00; }
        else if (percentage >= 80) { grade = 'B'; gpa = 3.00; }
        else if (percentage >= 70) { grade = 'C'; gpa = 2.00; }
        else if (percentage >= 60) { grade = 'D'; gpa = 1.00; }
        else { grade = 'F'; gpa = 0.00; }
    } else {
        // Percentage scale
        if (percentage >= 80) grade = 'Excellent';
        else if (percentage >= 60) grade = 'Good';
        else if (percentage >= 40) grade = 'Average';
        else grade = 'Poor';
        gpa = null;
    }
    
    return {
        percentage: Math.round(percentage * 100) / 100,
        grade,
        gpa
    };
};

advancedExamSchema.methods.addStudentResult = function(studentId, marksObtained, submittedBy, remarks) {
    // Check if student is registered
    const isRegistered = this.registeredStudents.some(
        student => student.studentId.toString() === studentId.toString()
    );
    
    if (!isRegistered) {
        throw new Error('Student not registered for this exam');
    }
    
    // Calculate grade and GPA
    const { percentage, grade, gpa } = this.calculateGradeAndGPA(marksObtained);
    
    // Remove existing result if any
    this.results = this.results.filter(
        result => result.studentId.toString() !== studentId.toString()
    );
    
    // Add new result
    this.results.push({
        studentId,
        marksObtained,
        percentage,
        grade,
        gpa,
        remarks,
        submittedBy,
        submittedAt: new Date()
    });
    
    // Update student attendance
    const studentRegistration = this.registeredStudents.find(
        student => student.studentId.toString() === studentId.toString()
    );
    if (studentRegistration) {
        studentRegistration.attendanceStatus = 'present';
    }
    
    return this.save();
};

advancedExamSchema.methods.publishResults = function(publishedBy) {
    this.status = 'published';
    this.publishedBy = publishedBy;
    this.publishedAt = new Date();
    return this.save();
};

// Static methods
advancedExamSchema.statics.getStudentExamResults = async function(
    schoolId,
    studentId,
    academicSessionId,
    examType
) {
    const matchStage = {
        schoolId: new mongoose.Types.ObjectId(schoolId),
        'results.studentId': new mongoose.Types.ObjectId(studentId)
    };
    
    if (academicSessionId) {
        matchStage.academicSessionId = new mongoose.Types.ObjectId(academicSessionId);
    }
    
    if (examType) {
        matchStage.examType = examType;
    }
    
    const results = await this.aggregate([
        { $match: matchStage },
        { $unwind: '$results' },
        { $match: { 'results.studentId': new mongoose.Types.ObjectId(studentId) } },
        {
            $lookup: {
                from: 'subjects',
                localField: 'subjectId',
                foreignField: '_id',
                as: 'subject'
            }
        },
        { $unwind: '$subject' },
        {
            $lookup: {
                from: 'classes',
                localField: 'classId',
                foreignField: '_id',
                as: 'class'
            }
        },
        { $unwind: '$class' },
        {
            $project: {
                examName: 1,
                examType: 1,
                examCode: 1,
                startDate: 1,
                subjectName: '$subject.subjectName',
                className: '$class.className',
                marksObtained: '$results.marksObtained',
                percentage: '$results.percentage',
                grade: '$results.grade',
                gpa: '$results.gpa',
                remarks: '$results.remarks',
                fullMarks: '$marksConfiguration.fullMarks',
                passMarks: '$marksConfiguration.passMarks'
            }
        },
        { $sort: { startDate: -1 } }
    ]);
    
    return results;
};

advancedExamSchema.statics.getClassExamResults = async function(
    schoolId,
    classId,
    sectionId,
    examId
) {
    const matchStage = {
        schoolId: new mongoose.Types.ObjectId(schoolId),
        classId: new mongoose.Types.ObjectId(classId)
    };
    
    if (sectionId) {
        matchStage.sectionId = new mongoose.Types.ObjectId(sectionId);
    }
    
    if (examId) {
        matchStage._id = new mongoose.Types.ObjectId(examId);
    }
    
    const results = await this.aggregate([
        { $match: matchStage },
        { $unwind: '$results' },
        {
            $lookup: {
                from: 'users',
                localField: 'results.studentId',
                foreignField: '_id',
                as: 'student'
            }
        },
        { $unwind: '$student' },
        {
            $lookup: {
                from: 'subjects',
                localField: 'subjectId',
                foreignField: '_id',
                as: 'subject'
            }
        },
        { $unwind: '$subject' },
        {
            $project: {
                examName: 1,
                examType: 1,
                studentName: '$student.name',
                studentRoll: '$student.rollNumber',
                subjectName: '$subject.subjectName',
                marksObtained: '$results.marksObtained',
                percentage: '$results.percentage',
                grade: '$results.grade',
                gpa: '$results.gpa',
                remarks: '$results.remarks',
                fullMarks: '$marksConfiguration.fullMarks',
                passMarks: '$marksConfiguration.passMarks'
            }
        },
        { $sort: { 'student.rollNumber': 1, 'subject.subjectName': 1 } }
    ]);
    
    return results;
};

advancedExamSchema.statics.calculateStudentGPA = async function(
    schoolId,
    studentId,
    academicSessionId
) {
    const results = await this.getStudentExamResults(schoolId, studentId, academicSessionId);
    
    if (results.length === 0) {
        return {
            totalGPA: 0,
            averageGPA: 0,
            totalSubjects: 0,
            gradeDistribution: {}
        };
    }
    
    const validResults = results.filter(r => r.gpa !== null && r.gpa !== undefined);
    const totalGPA = validResults.reduce((sum, result) => sum + result.gpa, 0);
    const averageGPA = totalGPA / validResults.length;
    
    // Grade distribution
    const gradeDistribution = {};
    results.forEach(result => {
        gradeDistribution[result.grade] = (gradeDistribution[result.grade] || 0) + 1;
    });
    
    return {
        totalGPA: Math.round(totalGPA * 100) / 100,
        averageGPA: Math.round(averageGPA * 100) / 100,
        totalSubjects: results.length,
        gradeDistribution
    };
};

module.exports = mongoose.model('AdvancedExam', advancedExamSchema);
