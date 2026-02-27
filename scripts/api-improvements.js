/**
 * 🔧 API IMPROVEMENTS & ANALYSIS SCRIPT
 * Analyzes current API structure and implements improvements
 */

const fs = require('fs');
const path = require('path');

// API improvement recommendations
const improvements = {
    responseFormat: {
        issue: 'Inconsistent response formats across endpoints',
        solution: 'Standardize API response structure',
        priority: 'High'
    },
    errorHandling: {
        issue: 'Missing comprehensive error handling',
        solution: 'Implement global error handling middleware',
        priority: 'High'
    },
    validation: {
        issue: 'Insufficient input validation',
        solution: 'Add comprehensive request validation',
        priority: 'High'
    },
    security: {
        issue: 'Missing security headers and rate limiting',
        solution: 'Implement security middleware',
        priority: 'High'
    },
    documentation: {
        issue: 'No API documentation',
        solution: 'Generate comprehensive API docs',
        priority: 'Medium'
    },
    performance: {
        issue: 'No caching or optimization',
        solution: 'Add caching and performance monitoring',
        priority: 'Medium'
    }
};

/**
 * Create standardized response middleware
 */
function createResponseMiddleware() {
    return `
/**
 * 🎯 STANDARDIZED RESPONSE MIDDLEWARE
 * Ensures consistent API response format
 */

const standardizedResponse = (req, res, next) => {
    // Override res.json to standardize format
    const originalJson = res.json;
    
    res.json = function(data) {
        // If data already has standard format, use it
        if (data && typeof data === 'object' && data.hasOwnProperty('success')) {
            return originalJson.call(this, data);
        }
        
        // Standardize the response
        const standardResponse = {
            success: res.statusCode < 400,
            data: data,
            message: res.statusCode < 400 ? 'Success' : 'Error',
            timestamp: new Date().toISOString(),
            requestId: req.id || null
        };
        
        // Add pagination if present
        if (data && data.pagination) {
            standardResponse.pagination = data.pagination;
            standardResponse.data = data.data || data;
        }
        
        return originalJson.call(this, standardResponse);
    };
    
    next();
};

module.exports = standardizedResponse;
`;
}

/**
 * Create enhanced error handling middleware
 */
function createErrorHandlingMiddleware() {
    return `
/**
 * 🛡️ ENHANCED ERROR HANDLING MIDDLEWARE
 * Comprehensive error handling for all API endpoints
 */

const logger = require('./utils/logger');

const errorHandler = (err, req, res, next) => {
    let error = { ...err };
    error.message = err.message;

    // Log error
    logger.error('API Error:', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        requestId: req.id,
        body: req.body,
        params: req.params,
        query: req.query
    });

    // Mongoose bad ObjectId
    if (err.name === 'CastError') {
        const message = 'Resource not found';
        error = { message, statusCode: 404 };
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const message = 'Duplicate field value';
        error = { message, statusCode: 400 };
    }

    // Mongoose validation error
    if (err.name === 'ValidationError') {
        const message = Object.values(err.errors).map(val => val.message).join(', ');
        error = { message, statusCode: 400 };
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
        const message = 'Invalid token';
        error = { message, statusCode: 401 };
    }

    if (err.name === 'TokenExpiredError') {
        const message = 'Token expired';
        error = { message, statusCode: 401 };
    }

    // Rate limiting errors
    if (err.status === 429) {
        const message = 'Too many requests, please try again later';
        error = { message, statusCode: 429 };
    }

    res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Internal Server Error',
        error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        timestamp: new Date().toISOString(),
        requestId: req.id
    });
};

module.exports = errorHandler;
`;
}

/**
 * Create enhanced validation middleware
 */
function createValidationMiddleware() {
    return `
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
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
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
`;
}

/**
 * Create security middleware
 */
function createSecurityMiddleware() {
    return `
/**
 * 🔒 ENHANCED SECURITY MIDDLEWARE
 * Comprehensive security features for API protection
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');

// Rate limiting configurations
const rateLimiters = {
    general: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        message: {
            success: false,
            message: 'Too many requests from this IP, please try again later',
            retryAfter: '15 minutes'
        },
        standardHeaders: true,
        legacyHeaders: false
    }),
    
    auth: rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 5, // limit each IP to 5 auth requests per windowMs
        message: {
            success: false,
            message: 'Too many authentication attempts, please try again later',
            retryAfter: '15 minutes'
        },
        skipSuccessfulRequests: true
    }),
    
    upload: rateLimit({
        windowMs: 60 * 60 * 1000, // 1 hour
        max: 10, // limit each IP to 10 uploads per hour
        message: {
            success: false,
            message: 'Too many upload attempts, please try again later',
            retryAfter: '1 hour'
        }
    })
};

// Security headers configuration
const securityHeaders = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "https:"],
            scriptSrc: ["'self'"],
            connectSrc: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    }
});

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
    // Sanitize request body
    if (req.body) {
        req.body = mongoSanitize(req.body);
        req.body = xss(req.body);
    }
    
    // Sanitize query parameters
    if (req.query) {
        req.query = mongoSanitize(req.query);
        req.query = xss(req.query);
    }
    
    // Sanitize URL parameters
    if (req.params) {
        req.params = mongoSanitize(req.params);
        req.params = xss(req.params);
    }
    
    next();
};

// CORS configuration
const corsOptions = {
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://yourdomain.com'] 
        : ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    optionsSuccessStatus: 200
};

module.exports = {
    rateLimiters,
    securityHeaders,
    sanitizeInput,
    corsOptions
};
`;
}

/**
 * Create API documentation generator
 */
function createAPIDocumentation() {
    return `
/**
 * 📚 API DOCUMENTATION GENERATOR
 * Auto-generates comprehensive API documentation
 */

const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'Smart Campus API',
            version: '1.0.0',
            description: 'Comprehensive Smart Campus Management System API',
            contact: {
                name: 'API Support',
                email: 'support@smartcampus.com'
            }
        },
        servers: [
            {
                url: process.env.NODE_ENV === 'production' 
                    ? 'https://api.smartcampus.com' 
                    : 'http://localhost:5000',
                description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
            }
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT'
                }
            },
            schemas: {
                User: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        name: { type: 'string' },
                        email: { type: 'string' },
                        role: { type: 'string', enum: ['super_admin', 'admin', 'principal', 'teacher', 'student', 'parent'] },
                        schoolCode: { type: 'string' },
                        isActive: { type: 'boolean' },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                School: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string' },
                        schoolName: { type: 'string' },
                        schoolCode: { type: 'string' },
                        address: { type: 'string' },
                        phone: { type: 'string' },
                        email: { type: 'string' },
                        isActive: { type: 'boolean' },
                        createdAt: { type: 'string', format: 'date-time' }
                    }
                },
                ApiResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                        message: { type: 'string' },
                        data: { type: 'object' },
                        timestamp: { type: 'string', format: 'date-time' },
                        requestId: { type: 'string' }
                    }
                },
                ErrorResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean', example: false },
                        message: { type: 'string' },
                        error: { type: 'string' },
                        timestamp: { type: 'string', format: 'date-time' },
                        requestId: { type: 'string' }
                    }
                }
            }
        }
    },
    apis: ['./routes/*.js', './controllers/*.js']
};

const specs = swaggerJsdoc(swaggerOptions);

module.exports = {
    specs,
    swaggerUi
};
`;
}

/**
 * Generate all improvement files
 */
function generateImprovements() {
    console.log('🔧 Generating API Improvements...\n');
    
    const improvementsDir = path.join(__dirname, '../middleware/enhanced');
    if (!fs.existsSync(improvementsDir)) {
        fs.mkdirSync(improvementsDir, { recursive: true });
    }
    
    // Create enhanced middleware files
    fs.writeFileSync(
        path.join(improvementsDir, 'standardizedResponse.js'),
        createResponseMiddleware()
    );
    
    fs.writeFileSync(
        path.join(improvementsDir, 'errorHandler.js'),
        createErrorHandlingMiddleware()
    );
    
    fs.writeFileSync(
        path.join(improvementsDir, 'validation.js'),
        createValidationMiddleware()
    );
    
    fs.writeFileSync(
        path.join(improvementsDir, 'security.js'),
        createSecurityMiddleware()
    );
    
    // Create documentation file
    fs.writeFileSync(
        path.join(__dirname, '../docs/api-documentation.js'),
        createAPIDocumentation()
    );
    
    console.log('✅ Enhanced middleware files created:');
    console.log('   📁 middleware/enhanced/standardizedResponse.js');
    console.log('   📁 middleware/enhanced/errorHandler.js');
    console.log('   📁 middleware/enhanced/validation.js');
    console.log('   📁 middleware/enhanced/security.js');
    console.log('   📁 docs/api-documentation.js');
    
    console.log('\n🎯 Priority Improvements:');
    Object.entries(improvements).forEach(([key, improvement]) => {
        console.log(`\n${key.toUpperCase()} (${improvement.priority}):`);
        console.log(`   Issue: ${improvement.issue}`);
        console.log(`   Solution: ${improvement.solution}`);
    });
    
    console.log('\n📋 Implementation Steps:');
    console.log('1. Install required packages:');
    console.log('   npm install express-validator express-rate-limit helmet mongo-sanitize xss-clean hpp swagger-jsdoc swagger-ui-express');
    
    console.log('\n2. Update index.js to include enhanced middleware:');
    console.log('   const { standardizedResponse } = require("./middleware/enhanced/standardizedResponse");');
    console.log('   const { errorHandler } = require("./middleware/enhanced/errorHandler");');
    console.log('   const { validations, handleValidationErrors } = require("./middleware/enhanced/validation");');
    console.log('   const { rateLimiters, securityHeaders, sanitizeInput } = require("./middleware/enhanced/security");');
    
    console.log('\n3. Add middleware to app:');
    console.log('   app.use(securityHeaders);');
    console.log('   app.use(sanitizeInput);');
    console.log('   app.use(standardizedResponse);');
    console.log('   app.use("/api/auth", rateLimiters.auth);');
    console.log('   app.use(rateLimiters.general);');
    console.log('   app.use(errorHandler);');
    
    console.log('\n4. Add API documentation route:');
    console.log('   const { specs, swaggerUi } = require("./docs/api-documentation");');
    console.log('   app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(specs));');
}

// Run improvements generation
if (require.main === module) {
    generateImprovements();
}

module.exports = {
    generateImprovements,
    improvements
};
