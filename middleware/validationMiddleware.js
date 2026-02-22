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
    body('schoolName').notEmpty().withMessage('School name required'),
    body('schoolCode').notEmpty().withMessage('School code required'),
    body('principalEmail').isEmail().withMessage('Valid principal email required'),
    body('principalPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
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