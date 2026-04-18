/**
 * Performance Indexes for Smart Campus SaaS
 * Strategic indexes for common query patterns to optimize performance
 */

const mongoose = require('mongoose');

/**
 * Create performance indexes for multi-tenant school management system
 * These indexes are designed to support the most common query patterns
 * identified in the audit phase
 */
const createPerformanceIndexes = async () => {
    try {
        console.log('Creating performance indexes...');

        // User collection indexes
        await User.collection.createIndex(
            { schoolId: 1, role: 1, isActive: 1 },
            { name: 'user_school_role_active' }
        );
        
        await User.collection.createIndex(
            { schoolCode: 1, role: 1, createdAt: -1 },
            { name: 'user_school_role_created' }
        );

        // Student collection indexes
        await Student.collection.createIndex(
            { schoolCode: 1, studentClass: 1, section: 1, isActive: 1 },
            { name: 'student_school_class_section_active' }
        );
        
        await Student.collection.createIndex(
            { schoolCode: 1, parentId: 1 },
            { name: 'student_school_parent' }
        );

        // Attendance collection indexes
        await Attendance.collection.createIndex(
            { schoolId: 1, date: -1, studentClass: 1, section: 1 },
            { name: 'attendance_school_date_class_section' }
        );
        
        await Attendance.collection.createIndex(
            { schoolId: 1, date: -1, 'records.studentId': 1 },
            { name: 'attendance_school_date_student' }
        );

        // Advanced Attendance collection indexes
        const AdvancedAttendance = require('../models/AdvancedAttendance');
        await AdvancedAttendance.collection.createIndex(
            { schoolId: 1, date: -1, attendanceType: 1 },
            { name: 'advanced_attendance_school_date_type' }
        );
        
        await AdvancedAttendance.collection.createIndex(
            { schoolId: 1, studentId: 1, date: -1 },
            { name: 'advanced_attendance_school_student_date' }
        );
        
        await AdvancedAttendance.collection.createIndex(
            { schoolId: 1, markedBy: 1, date: -1 },
            { name: 'advanced_attendance_school_teacher_date' }
        );

        // Result collection indexes
        await Result.collection.createIndex(
            { schoolCode: 1, studentId: 1, examDate: -1 },
            { name: 'result_school_student_exam_date' }
        );
        
        await Result.collection.createIndex(
            { schoolCode: 1, classId: 1, section: 1, examDate: -1 },
            { name: 'result_school_class_section_exam_date' }
        );
        
        await Result.collection.createIndex(
            { schoolCode: 1, examId: 1, isPublished: 1 },
            { name: 'result_school_exam_published' }
        );
        
        await Result.collection.createIndex(
            { schoolCode: 1, status: 1, isActive: 1 },
            { name: 'result_school_status_active' }
        );

        // Fee collection indexes
        await Fee.collection.createIndex(
            { schoolCode: 1, studentId: 1, year: -1, month: -1 },
            { name: 'fee_school_student_year_month' }
        );
        
        await Fee.collection.createIndex(
            { schoolCode: 1, status: 1, year: -1, month: -1 },
            { name: 'fee_school_status_year_month' }
        );

        // Payment History collection indexes
        const PaymentHistory = require('../models/PaymentHistory');
        await PaymentHistory.collection.createIndex(
            { schoolId: 1, createdAt: -1, amount: 1 },
            { name: 'payment_school_created_amount' }
        );
        
        await PaymentHistory.collection.createIndex(
            { schoolId: 1, studentId: 1, createdAt: -1 },
            { name: 'payment_school_student_created' }
        );

        // Exam collection indexes
        await Exam.collection.createIndex(
            { schoolCode: 1, classId: 1, subjectId: 1, isActive: 1 },
            { name: 'exam_school_class_subject_active' }
        );
        
        await Exam.collection.createIndex(
            { schoolCode: 1, startDate: -1, isActive: 1 },
            { name: 'exam_school_start_date_active' }
        );

        // Notice collection indexes
        await Notice.collection.createIndex(
            { $or: [{ schoolId: 1 }, { isGlobal: true }], createdAt: -1, isPublished: 1 },
            { name: 'notice_school_created_published' }
        );
        
        await Notice.collection.createIndex(
            { schoolId: 1, targetType: 1, status: 1, publishDate: -1 },
            { name: 'notice_school_target_status_date' }
        );

        // Teacher Assignment collection indexes
        const TeacherAssignment = require('../models/TeacherAssignment');
        await TeacherAssignment.collection.createIndex(
            { schoolCode: 1, teacher: 1, isActive: 1 },
            { name: 'assignment_school_teacher_active' }
        );
        
        await TeacherAssignment.collection.createIndex(
            { schoolCode: 1, classes: 1, subject: 1, isActive: 1 },
            { name: 'assignment_school_class_subject_active' }
        );

        // Class Routine collection indexes
        const ClassRoutine = require('../models/ClassRoutine');
        await ClassRoutine.collection.createIndex(
            { schoolCode: 1, studentClass: 1, section: 1, isActive: 1 },
            { name: 'routine_school_class_section_active' }
        );
        
        await ClassRoutine.collection.createIndex(
            { schoolCode: 1, isPublished: 1, createdAt: -1 },
            { name: 'routine_school_published_created' }
        );

        // Class collection indexes
        await Class.collection.createIndex(
            { schoolCode: 1, className: 1, section: 1, isActive: 1 },
            { name: 'class_school_name_section_active' }
        );
        
        await Class.collection.createIndex(
            { schoolId: 1, createdAt: -1, isActive: 1 },
            { name: 'class_school_created_active' }
        );

        // Subject collection indexes
        await Subject.collection.createIndex(
            { schoolCode: 1, subjectName: 1, isActive: 1 },
            { name: 'subject_school_name_active' }
        );

        // School collection indexes
        await School.collection.createIndex(
            { schoolCode: 1, isActive: 1, createdAt: -1 },
            { name: 'school_code_active_created' }
        );
        
        await School.collection.createIndex(
            { 'subscription.endDate': 1, isActive: 1 },
            { name: 'school_subscription_end_active' }
        );

        // Audit Log collection indexes
        await AuditLog.collection.createIndex(
            { schoolId: 1, user: 1, createdAt: -1 },
            { name: 'audit_school_user_created' }
        );
        
        await AuditLog.collection.createIndex(
            { schoolId: 1, action: 1, createdAt: -1 },
            { name: 'audit_school_action_created' }
        );

        console.log('Performance indexes created successfully');
        return true;
    } catch (error) {
        console.error('Error creating performance indexes:', error);
        return false;
    }
};

/**
 * Drop performance indexes (for maintenance or testing)
 */
const dropPerformanceIndexes = async () => {
    try {
        console.log('Dropping performance indexes...');
        
        const indexNames = [
            'user_school_role_active',
            'user_school_role_created',
            'student_school_class_section_active',
            'student_school_parent',
            'attendance_school_date_class_section',
            'attendance_school_date_student',
            'advanced_attendance_school_date_type',
            'advanced_attendance_school_student_date',
            'advanced_attendance_school_teacher_date',
            'result_school_student_exam_date',
            'result_school_class_section_exam_date',
            'result_school_exam_published',
            'result_school_status_active',
            'fee_school_student_year_month',
            'fee_school_status_year_month',
            'payment_school_created_amount',
            'payment_school_student_created',
            'exam_school_class_subject_active',
            'exam_school_start_date_active',
            'notice_school_created_published',
            'notice_school_target_status_date',
            'assignment_school_teacher_active',
            'assignment_school_class_subject_active',
            'routine_school_class_section_active',
            'routine_school_published_created',
            'class_school_name_section_active',
            'class_school_created_active',
            'subject_school_name_active',
            'school_code_active_created',
            'school_subscription_end_active',
            'audit_school_user_created',
            'audit_school_action_created'
        ];

        for (const indexName of indexNames) {
            try {
                await User.collection.dropIndex(indexName);
            } catch (error) {
                // Index might not exist, continue
            }
        }

        console.log('Performance indexes dropped successfully');
        return true;
    } catch (error) {
        console.error('Error dropping performance indexes:', error);
        return false;
    }
};

/**
 * Get index statistics for monitoring
 */
const getIndexStats = async () => {
    try {
        const collections = [
            'users', 'students', 'attendances', 'results', 'fees',
            'paymenthistories', 'exams', 'notices', 'teacherassignments',
            'classroutines', 'classes', 'subjects', 'schools', 'auditlogs'
        ];

        const stats = {};
        
        for (const collectionName of collections) {
            try {
                const collection = mongoose.connection.db.collection(collectionName);
                const indexes = await collection.indexes();
                stats[collectionName] = {
                    count: indexes.length,
                    indexes: indexes.map(idx => ({
                        name: idx.name,
                        keys: idx.key,
                        unique: idx.unique || false
                    }))
                };
            } catch (error) {
                stats[collectionName] = { error: error.message };
            }
        }

        return stats;
    } catch (error) {
        console.error('Error getting index stats:', error);
        return null;
    }
};

module.exports = {
    createPerformanceIndexes,
    dropPerformanceIndexes,
    getIndexStats
};
