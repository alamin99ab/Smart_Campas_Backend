const { body, validationResult } = require('express-validator');

// Validation rules
exports.validateRegister = [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').isLength({ min: 6, max: 128 }).withMessage('Password must be 6-128 characters'),
    body('role').isIn(['principal', 'teacher', 'student', 'parent', 'accountant']).withMessage('Invalid role'),
];

exports.validateLogin = [
    body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
    body('password').notEmpty().withMessage('Password required'),
];

exports.validateSchool = [
    body('schoolName').trim().notEmpty().withMessage('School name is required').isLength({ max: 200 }),
    body('schoolCode').trim().notEmpty().withMessage('School code is required').isLength({ min: 3, max: 10 }),
    body('address').trim().notEmpty().withMessage('Address is required'),
    body('phone').trim().notEmpty().withMessage('Phone is required').isMobilePhone(),
    body('email').trim().isEmail().withMessage('Valid email required').normalizeEmail(),
    body('principalName').trim().notEmpty().withMessage('Principal name is required').isLength({ max: 100 }),
    body('principalEmail').trim().isEmail().withMessage('Valid principal email required').normalizeEmail(),
    body('principalPhone').trim().notEmpty().withMessage('Principal phone is required').isMobilePhone(),
    body('principalPassword').isLength({ min: 6 }).withMessage('Principal password must be at least 6 characters'),
];

exports.validateClass = [
    body('className').trim().notEmpty().withMessage('Class name is required'),
    body('section').trim().notEmpty().withMessage('Section is required').isLength({ max: 5 }),
    body('classLevel').isInt({ min: 1, max: 12 }).withMessage('Class level must be 1-12'),
    body('capacity').isInt({ min: 1, max: 100 }).withMessage('Capacity must be 1-100'),
    body('academicYear').trim().notEmpty().withMessage('Academic year is required'),
];

exports.validateSubject = [
    body('subjectName').trim().notEmpty().withMessage('Subject name is required').isLength({ max: 100 }),
    body('subjectCode').trim().notEmpty().withMessage('Subject code is required').isLength({ min: 2, max: 10 }),
    body('category').isIn(['Core', 'Elective', 'Optional', 'Extra-curricular']).withMessage('Invalid category'),
    body('classLevels').isArray().withMessage('Class levels must be an array'),
    body('credits').isFloat({ min: 0.5, max: 5 }).withMessage('Credits must be 0.5-5'),
    body('periodsPerWeek').isInt({ min: 1, max: 10 }).withMessage('Periods per week must be 1-10'),
    body('passingMarks').isInt({ min: 0, max: 100 }).withMessage('Passing marks must be 0-100'),
    body('totalMarks').isInt({ min: 50, max: 200 }).withMessage('Total marks must be 50-200'),
];

exports.checkValidation = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(e => ({ field: e.path, message: e.msg }))
        });
    }
    next();
};