/**
 * Validation Middleware
 * Comprehensive input validation using Joi schemas
 */

const Joi = require('joi');
const mongoose = require('mongoose');

/**
 * Common validation patterns
 */
const objectIdPattern = Joi.string().custom((value, helpers) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
        return helpers.error('objectId.invalid');
    }
    return value;
}, 'ObjectId validation').messages({
    'objectId.invalid': 'Invalid ID format'
});

const commonPatterns = {
    objectId: objectIdPattern,
    
    email: Joi.string().email().max(255),
    phone: Joi.string().pattern(/^[+]?[\d\s\-\(\)]+$/).max(20),
    name: Joi.string().trim().min(2).max(100),
    rollNumber: Joi.string().trim().min(1).max(50),
    
    positiveNumber: Joi.number().min(0),
    marks: Joi.number().min(0).max(100),
    percentage: Joi.number().min(0).max(100),
    
    date: Joi.date().iso(),
    futureDate: Joi.date().min('now'),
    pastDate: Joi.date().max('now'),
    
    status: Joi.string().valid('active', 'inactive', 'pending', 'completed', 'cancelled'),
    attendanceStatus: Joi.string().valid('Present', 'Absent', 'Late', 'Holiday', 'Excused'),
    feeStatus: Joi.string().valid('Paid', 'Partial', 'Unpaid'),
    examStatus: Joi.string().valid('draft', 'scheduled', 'active', 'completed', 'archived'),
    resultStatus: Joi.string().valid('draft', 'verified', 'published'),
    
    schoolCode: Joi.string().trim().min(3).max(20).uppercase(),
    className: Joi.string().trim().min(1).max(50),
    section: Joi.string().trim().min(1).max(10).uppercase(),
    subjectName: Joi.string().trim().min(2).max(100),
    
    paymentMethod: Joi.string().valid('Cash', 'Bank', 'Mobile Banking', 'Cheque', 'Online'),
    
    array: {
        nonEmpty: Joi.array().min(1),
        optional: Joi.array().optional(),
        ofObjectIds: Joi.array().items(objectIdPattern)
    }
};

/**
 * Validation schemas for different entities
 */
const schemas = {
    // Student schemas
    student: {
        create: Joi.object({
            name: commonPatterns.name.required(),
            roll: commonPatterns.rollNumber.required(),
            studentClass: commonPatterns.className.required(),
            section: commonPatterns.section.required(),
            fatherName: commonPatterns.name.optional(),
            motherName: commonPatterns.name.optional(),
            dateOfBirth: commonPatterns.pastDate.optional(),
            gender: Joi.string().valid('Male', 'Female', 'Other').optional(),
            address: Joi.string().trim().max(500).optional(),
            phone: commonPatterns.phone.optional(),
            guardian: Joi.object({
                name: commonPatterns.name.required(),
                phone: commonPatterns.phone.required(),
                email: commonPatterns.email.optional()
            }).optional(),
            emergencyContact: commonPatterns.phone.optional()
        }),
        
        update: Joi.object({
            name: commonPatterns.name.optional(),
            roll: commonPatterns.rollNumber.optional(),
            studentClass: commonPatterns.className.optional(),
            section: commonPatterns.section.optional(),
            fatherName: commonPatterns.name.optional(),
            motherName: commonPatterns.name.optional(),
            dateOfBirth: commonPatterns.pastDate.optional(),
            gender: Joi.string().valid('Male', 'Female', 'Other').optional(),
            address: Joi.string().trim().max(500).optional(),
            phone: commonPatterns.phone.optional(),
            guardian: Joi.object({
                name: commonPatterns.name.optional(),
                phone: commonPatterns.phone.optional(),
                email: commonPatterns.email.optional()
            }).optional(),
            emergencyContact: commonPatterns.phone.optional()
        })
    },
    
    // Teacher schemas
    teacher: {
        create: Joi.object({
            name: commonPatterns.name.required(),
            email: commonPatterns.email.required(),
            phone: commonPatterns.phone.required(),
            qualification: Joi.string().trim().min(2).max(200).required(),
            experience: Joi.string().trim().min(2).max(200).required(),
            subjects: commonPatterns.array.nonEmpty.items(commonPatterns.subjectName).required(),
            employeeId: Joi.string().trim().min(3).max(50).optional()
        }),
        
        update: Joi.object({
            name: commonPatterns.name.optional(),
            email: commonPatterns.email.optional(),
            phone: commonPatterns.phone.optional(),
            qualification: Joi.string().trim().min(2).max(200).optional(),
            experience: Joi.string().trim().min(2).max(200).optional(),
            subjects: commonPatterns.array.optional.items(commonPatterns.subjectName),
            employeeId: Joi.string().trim().min(3).max(50).optional()
        })
    },
    
    // Attendance schemas
    attendance: {
        take: Joi.object({
            studentClass: commonPatterns.className.required(),
            section: commonPatterns.section.required(),
            date: commonPatterns.date.required(),
            subject: commonPatterns.subjectName.optional(),
            records: Joi.array().items(
                Joi.object({
                    studentId: commonPatterns.objectId.required(),
                    status: commonPatterns.attendanceStatus.required(),
                    remarks: Joi.string().trim().max(200).optional()
                })
            ).min(1).required()
        }),
        
        report: Joi.object({
            studentClass: Joi.alternatives().try(
                commonPatterns.className,
                commonPatterns.objectId
            ).required(),
            section: commonPatterns.section.required(),
            date: commonPatterns.date.optional(),
            startDate: commonPatterns.date.optional(),
            endDate: commonPatterns.date.optional(),
            subject: commonPatterns.subjectName.optional(),
            studentId: commonPatterns.objectId.optional(),
            page: Joi.number().integer().min(1).default(1),
            limit: Joi.number().integer().min(1).max(100).default(30)
        })
    },
    
    // Result schemas
    result: {
        upload: Joi.object({
            examId: commonPatterns.objectId.required(),
            studentId: commonPatterns.objectId.required(),
            subjects: Joi.array().items(
                Joi.object({
                    subjectId: commonPatterns.objectId.required(),
                    marks: commonPatterns.marks.required(),
                    maxMarks: Joi.number().min(1).max(200).required(),
                    grade: Joi.string().trim().max(10).optional(),
                    remarks: Joi.string().trim().max(200).optional()
                })
            ).min(1).required()
        }),
        
        update: Joi.object({
            subjects: Joi.array().items(
                Joi.object({
                    subjectId: commonPatterns.objectId.required(),
                    marks: commonPatterns.marks.required(),
                    maxMarks: Joi.number().min(1).max(200).optional(),
                    grade: Joi.string().trim().max(10).optional(),
                    remarks: Joi.string().trim().max(200).optional()
                })
            ).min(1).required()
        }),
        
        search: Joi.object({
            examId: commonPatterns.objectId.optional(),
            studentId: commonPatterns.objectId.optional(),
            classId: commonPatterns.objectId.optional(),
            section: commonPatterns.section.optional(),
            status: commonPatterns.resultStatus.optional(),
            page: Joi.number().integer().min(1).default(1),
            limit: Joi.number().integer().min(1).max(100).default(30)
        })
    },
    
    // Exam schemas
    exam: {
        create: Joi.object({
            title: Joi.string().trim().min(3).max(200).required(),
            type: Joi.string().valid('mid_term', 'final', 'half_yearly', 'annual', 'test_exam', 'class_test', 'quiz', 'assessment', 'practical', 'assignment', 'other').required(),
            category: Joi.string().valid('school_exam', 'class_test', 'special_exam').required(),
            classId: commonPatterns.objectId.required(),
            section: commonPatterns.section.optional(),
            subjectId: commonPatterns.objectId.optional(),
            startDate: commonPatterns.date.required(),
            endDate: commonPatterns.date.min(Joi.ref('startDate')).required(),
            maxMarks: Joi.number().min(1).max(1000).required(),
            duration: Joi.number().min(15).max(480).required(), // minutes
            instructions: Joi.string().trim().max(1000).optional()
        }),
        
        update: Joi.object({
            title: Joi.string().trim().min(3).max(200).optional(),
            type: Joi.string().valid('mid_term', 'final', 'half_yearly', 'annual', 'test_exam', 'class_test', 'quiz', 'assessment', 'practical', 'assignment', 'other').optional(),
            category: Joi.string().valid('school_exam', 'class_test', 'special_exam').optional(),
            classId: commonPatterns.objectId.optional(),
            section: commonPatterns.section.optional(),
            subjectId: commonPatterns.objectId.optional(),
            startDate: commonPatterns.date.optional(),
            endDate: commonPatterns.date.min(Joi.ref('startDate')).optional(),
            maxMarks: Joi.number().min(1).max(1000).optional(),
            duration: Joi.number().min(15).max(480).optional(),
            instructions: Joi.string().trim().max(1000).optional(),
            status: commonPatterns.examStatus.optional()
        })
    },
    
    // Fee schemas
    fee: {
        create: Joi.object({
            studentId: commonPatterns.objectId.required(),
            amountDue: commonPatterns.positiveNumber.required(),
            month: Joi.number().integer().min(1).max(12).required(),
            year: Joi.number().integer().min(2020).max(2030).required(),
            feeType: Joi.string().trim().min(2).max(50).required(),
            dueDate: commonPatterns.date.optional(),
            description: Joi.string().trim().max(500).optional()
        }),
        
        payment: Joi.object({
            studentId: commonPatterns.objectId.required(),
            amount: commonPatterns.positiveNumber.required(),
            paymentMethod: commonPatterns.paymentMethod.required(),
            transactionId: Joi.string().trim().max(100).optional(),
            remarks: Joi.string().trim().max(500).optional(),
            feeId: commonPatterns.objectId.optional(),
            month: Joi.number().integer().min(1).max(12).optional(),
            year: Joi.number().integer().min(2020).max(2030).optional()
        }),
        
        search: Joi.object({
            studentId: commonPatterns.objectId.optional(),
            month: Joi.number().integer().min(1).max(12).optional(),
            year: Joi.number().integer().min(2020).max(2030).optional(),
            status: commonPatterns.feeStatus.optional(),
            feeType: Joi.string().trim().max(50).optional(),
            page: Joi.number().integer().min(1).default(1),
            limit: Joi.number().integer().min(1).max(100).default(30)
        })
    },
    
    // Routine import schemas
    routineImport: {
        upload: Joi.object({
            schoolId: commonPatterns.objectId.required(),
            sessionId: commonPatterns.objectId.required(),
            classId: commonPatterns.objectId.required(),
            sectionId: commonPatterns.objectId.optional()
        }),
        
        confirm: Joi.object({
            importBatchId: Joi.string().trim().min(10).max(100).required(),
            importMode: Joi.string().valid('merge', 'replace').default('merge')
        })
    },
    
    // Class/Section/Subject schemas
    class: {
        create: Joi.object({
            className: commonPatterns.className.required(),
            section: commonPatterns.section.required(),
            classLevel: Joi.number().integer().min(1).max(12).required(),
            maxStudents: Joi.number().integer().min(1).max(200).default(40),
            roomNumber: Joi.string().trim().max(20).optional(),
            description: Joi.string().trim().max(500).optional()
        }),
        
        update: Joi.object({
            className: commonPatterns.className.optional(),
            section: commonPatterns.section.optional(),
            classLevel: Joi.number().integer().min(1).max(12).optional(),
            maxStudents: Joi.number().integer().min(1).max(200).optional(),
            roomNumber: Joi.string().trim().max(20).optional(),
            description: Joi.string().trim().max(500).optional(),
            status: commonPatterns.status.optional()
        })
    },
    
    subject: {
        create: Joi.object({
            subjectName: commonPatterns.subjectName.required(),
            subjectCode: Joi.string().trim().min(2).max(20).required(),
            description: Joi.string().trim().max(500).optional(),
            maxMarks: Joi.number().min(1).max(200).default(100),
            passMarks: Joi.number().min(0).max(200).default(33),
            isPractical: Joi.boolean().default(false)
        }),
        
        update: Joi.object({
            subjectName: commonPatterns.subjectName.optional(),
            subjectCode: Joi.string().trim().min(2).max(20).optional(),
            description: Joi.string().trim().max(500).optional(),
            maxMarks: Joi.number().min(1).max(200).optional(),
            passMarks: Joi.number().min(0).max(200).optional(),
            isPractical: Joi.boolean().optional(),
            status: commonPatterns.status.optional()
        })
    },
    
    // Common query parameter schemas
    query: {
        pagination: Joi.object({
            page: Joi.number().integer().min(1).default(1),
            limit: Joi.number().integer().min(1).max(100).default(30),
            sort: Joi.string().trim().max(50).optional(),
            order: Joi.string().valid('asc', 'desc').default('desc')
        }),
        
        dateRange: Joi.object({
            startDate: commonPatterns.date.optional(),
            endDate: commonPatterns.date.min(Joi.ref('startDate')).optional()
        }),
        
        search: Joi.object({
            q: Joi.string().trim().min(1).max(100).optional(),
            search: Joi.string().trim().min(1).max(100).optional()
        })
    }
};

/**
 * Validation middleware factory
 */
const validate = (schema, source = 'body') => {
    return (req, res, next) => {
        const data = source === 'query' ? req.query : 
                   source === 'params' ? req.params : 
                   req.body;
        
        const { error, value } = schema.validate(data, {
            abortEarly: false,
            stripUnknown: true,
            convert: true
        });
        
        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));
            
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors
            });
        }
        
        // Replace the original data with validated and sanitized data
        if (source === 'query') {
            req.query = value;
        } else if (source === 'params') {
            req.params = value;
        } else {
            req.body = value;
        }
        
        next();
    };
};

/**
 * ObjectId validation middleware
 */
const validateObjectId = (paramName = 'id') => {
    return (req, res, next) => {
        const id = req.params[paramName];
        
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: `Invalid ${paramName} format`
            });
        }
        
        next();
    };
};

/**
 * Multiple ObjectId validation
 */
const validateObjectIds = (...paramNames) => {
    return (req, res, next) => {
        const errors = [];
        
        for (const paramName of paramNames) {
            const id = req.params[paramName] || req.body[paramName];
            
            if (id && !mongoose.Types.ObjectId.isValid(id)) {
                errors.push(paramName);
            }
        }
        
        if (errors.length > 0) {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format for: ${errors.join(', ')}`
            });
        }
        
        next();
    };
};

/**
 * Mass assignment protection middleware
 */
const protectFields = (allowedFields = []) => {
    return (req, res, next) => {
        if (req.body && typeof req.body === 'object') {
            const filtered = {};
            
            for (const field of allowedFields) {
                if (field in req.body) {
                    filtered[field] = req.body[field];
                }
            }
            
            req.body = filtered;
        }
        
        next();
    };
};

/**
 * Prevent sensitive field assignment
 */
const preventSensitiveFields = (req, res, next) => {
    const sensitiveFields = [
        'schoolId',
        'schoolCode', 
        'role',
        'isActive',
        'isApproved',
        'approvedBy',
        'approvedAt',
        'createdAt',
        'updatedAt',
        '_id',
        '__v'
    ];
    
    if (req.body && typeof req.body === 'object') {
        for (const field of sensitiveFields) {
            delete req.body[field];
        }
    }
    
    next();
};

module.exports = {
    schemas,
    commonPatterns,
    validate,
    validateObjectId,
    validateObjectIds,
    protectFields,
    preventSensitiveFields
};
