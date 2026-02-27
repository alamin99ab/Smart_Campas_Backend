
/**
 * ✅ ENHANCED VALIDATION MIDDLEWARE
 * Comprehensive input validation for all endpoints
 */

const { body, param, query, validationResult } = require('express-validator');

// Common validation chains
const validations = {
    email: body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Valid email required'),
    
    password: body('password')
        .isLength({ min: 8 })
        .withMessage('Password must be at least 8 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*d)(?=.*[@$!%*?&])[A-Za-zd@$!%*?&]/)
        .withMessage('Password must contain uppercase, lowercase, number, and special character'),
    
    name: body('name')
        .trim()
        .isLength({ min: 2, max: 50 })
        .withMessage('Name must be between 2 and 50 characters')
        .escape(),
    
    phone: body('phone')
        .optional()
        .isMobilePhone()
        .withMessage('Valid phone number required'),
    
    schoolCode: body('schoolCode')
        .trim()
        .isLength({ min: 3, max: 10 })
        .matches(/^[A-Z0-9]+$/)
        .withMessage('School code must be uppercase letters and numbers only'),
    
    objectId: param('id')
        .isMongoId()
        .withMessage('Valid ID required'),
    
    page: query('page')
        .optional()
        .isInt({ min: 1 })
        .withMessage('Page must be a positive integer'),
    
    limit: query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100')
};

// Validation result handler
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errors.array().map(error => ({
                field: error.param,
                message: error.msg,
                value: error.value
            })),
            timestamp: new Date().toISOString()
        });
    }
    next();
};

module.exports = {
    validations,
    handleValidationErrors
};
