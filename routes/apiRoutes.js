/**
 * 🔗 API ROUTES
 * Additional API endpoints for enhanced functionality
 */

const express = require('express');
const router = express.Router();

// Health check with detailed status
router.get('/status', (req, res) => {
    res.json({
        success: true,
        data: {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: '2.0.0',
            environment: process.env.NODE_ENV || 'development',
            features: {
                authentication: true,
                fileUpload: true,
                emailService: true,
                smsService: true,
                analytics: true,
                realtime: true
            }
        }
    });
});

// API documentation endpoint
router.get('/docs', (req, res) => {
    res.json({
        success: true,
        data: {
            title: 'Smart Campus API',
            version: '2.0.0',
            description: 'Complete API documentation for Smart Campus Management System',
            baseUrl: `${req.protocol}://${req.get('host')}/api`,
            endpoints: {
                authentication: {
                    login: 'POST /auth/login',
                    register: 'POST /auth/register',
                    logout: 'POST /auth/logout',
                    profile: 'GET /auth/profile',
                    changePassword: 'PUT /auth/change-password',
                    forgotPassword: 'POST /auth/forgot-password',
                    resetPassword: 'PUT /auth/reset-password/:token'
                },
                public: {
                    notices: 'GET /public/notices',
                    results: 'GET /public/results',
                    resultByRoll: 'GET /public/result/:rollNumber',
                    schoolInfo: 'GET /public/school/:schoolCode',
                    dashboard: 'GET /public/dashboard/:schoolCode'
                },
                superAdmin: {
                    schools: 'GET|POST /super-admin/schools',
                    updateSchool: 'PUT /super-admin/schools/:id',
                    deleteSchool: 'DELETE /super-admin/schools/:id',
                    analytics: 'GET /super-admin/analytics',
                    users: 'GET /super-admin/users',
                    systemLogs: 'GET /super-admin/logs'
                },
                principal: {
                    classes: 'GET|POST /principal/classes',
                    subjects: 'GET|POST /principal/subjects',
                    teachers: 'GET|POST /principal/teachers',
                    students: 'GET /principal/students',
                    routine: 'POST /principal/routine',
                    analytics: 'GET /principal/analytics',
                    notices: 'GET|POST /principal/notices'
                },
                teacher: {
                    dashboard: 'GET /teacher/dashboard',
                    attendance: 'GET|POST /teacher/attendance',
                    results: 'GET|POST /teacher/results',
                    students: 'GET /teacher/students/:classId',
                    notices: 'GET|POST /teacher/notices',
                    routine: 'GET /teacher/routine',
                    profile: 'GET|PUT /teacher/profile'
                },
                student: {
                    dashboard: 'GET /student/dashboard',
                    notices: 'GET /student/notices',
                    results: 'GET /student/results',
                    attendance: 'GET /student/attendance',
                    routine: 'GET /student/routine',
                    profile: 'GET|PUT /student/profile',
                    assignments: 'GET /student/assignments',
                    fees: 'GET /student/fees'
                }
            }
        }
    });
});

// Test endpoint for debugging
router.get('/test', (req, res) => {
    res.json({
        success: true,
        data: {
            message: 'API is working correctly!',
            timestamp: new Date().toISOString(),
            requestInfo: {
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                method: req.method,
                url: req.url,
                headers: req.headers
            }
        }
    });
});

module.exports = router;
