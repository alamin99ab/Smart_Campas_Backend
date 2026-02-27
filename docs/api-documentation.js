
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
