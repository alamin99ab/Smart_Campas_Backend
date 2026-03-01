const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
// const xss = require('xss-clean');

const logger = require('./utils/logger');
const { validateEnv, getCorsOrigin, isProduction } = require('./config/env');
validateEnv();

// Enhanced middleware
const standardizedResponse = require('./middleware/enhanced/standardizedResponse');
const errorHandler = require('./middleware/enhanced/errorHandler');
const { validations, handleValidationErrors } = require('./middleware/enhanced/validation');
const { rateLimiters, securityHeaders, sanitizeInput, corsOptions } = require('./middleware/enhanced/security');
const { sanitize, noPrototypePollution } = require('./middleware/securityMiddleware');
const requestId = require('./middleware/requestId');

// 🚀 SMART CAMPUS SaaS - COMPLETE WORKFLOW ROUTES
const authRoutes = require('./routes/auth');
const superAdminRoutes = require('./routes/superAdmin');
const principalRoutes = require('./routes/principal');
const teacherRoutes = require('./routes/teacher');
const studentRoutes = require('./routes/student');
const dashboardRoutes = require('./routes/dashboard');
const noticeRoutes = require('./routes/notices');

// 🤖 AI ROUTES - SMART CAMPUS INTELLIGENCE
const aiRoutes = require('./routes/ai');

// Legacy routes (for backward compatibility)
const studentRoutesLegacy = require('./routes/studentRoutes');
const teacherRoutesLegacy = require('./routes/teacherRoutes');
const schoolRoutes = require('./routes/schoolRoutes');
const noticeRoutesLegacy = require('./routes/noticeRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const resultRoutes = require('./routes/resultRoutes');
const dashboardRoutesLegacy = require('./routes/dashboardRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const superAdminRoutesLegacy = require('./routes/superAdminRoutes');
const principalRoutesLegacy = require('./routes/principalRoutes');
const apiRoutes = require('./routes/apiRoutes');
const publicRoutes = require('./routes/publicRoutes');
const feeRoutes = require('./routes/feeRoutes');
const routineRoutes = require('./routes/routineRoutes');
const leaveRoutes = require('./routes/leaveRoutes');
const substituteRoutes = require('./routes/substituteRoutes');
const roomRoutes = require('./routes/roomRoutes');
const academicSessionRoutes = require('./routes/academicSessionRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const eventRoutes = require('./routes/eventRoutes');
const activityRoutes = require('./routes/activityRoutes');
const searchRoutes = require('./routes/searchRoutes');
const admissionRoutes = require('./routes/admissionRoutes');
const teacherAssignmentRoutes = require('./routes/teacherAssignmentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const examScheduleRoutes = require('./routes/examScheduleRoutes');
const admitRoutes = require('./routes/admitRoutes');

// API Documentation
const { specs, swaggerUi } = require('./docs/api-documentation');

const app = express();

// Enhanced security headers
app.use(securityHeaders);

// CORS configuration
app.use(cors(corsOptions));

// Request parsing and sanitization
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));
app.use(sanitizeInput);
app.use(noPrototypePollution);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Request ID and logging
app.use(requestId);

// Rate limiting
app.use('/api/auth', rateLimiters.auth);
app.use(rateLimiters.general);

// Standardized response format
app.use(standardizedResponse);

// 🚀 SMART CAMPUS SaaS - COMPLETE WORKFLOW API ROUTES

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Smart Campus SaaS API is running',
        timestamp: new Date().toISOString(),
        version: '5.0.0'
    });
});

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// 🔹 PHASE 1 & 2: AUTHENTICATION & SUPER ADMIN
app.use('/api/auth', authRoutes);
app.use('/api/super-admin', superAdminRoutes);

// 🔹 PHASE 3: PRINCIPAL FLOW
app.use('/api/principal', principalRoutes);

// 🔹 PHASE 5: DAILY OPERATION FLOW
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);

// 🔹 PHASE 9: ANALYTICS FLOW
app.use('/api/dashboard', dashboardRoutes);

// 🔹 PHASE 8: NOTICE FLOW
app.use('/api/notices', require('./routes/notices'));

// 🤖 PHASE 10: AI INTELLIGENCE FLOW
app.use('/api/ai', aiRoutes);

// Legacy routes (for backward compatibility)
app.use('/api/v1', publicRoutes);
app.use('/api/v1', authRoutes);
app.use('/api/v1', superAdminRoutesLegacy);
app.use('/api/v1', principalRoutesLegacy);
app.use('/api/v1', teacherRoutesLegacy);
app.use('/api/v1', studentRoutesLegacy);
app.use('/api/v1', schoolRoutes);
app.use('/api/v1', noticeRoutesLegacy);
app.use('/api/v1', attendanceRoutes);
app.use('/api/v1', resultRoutes);
app.use('/api/v1', dashboardRoutesLegacy);
app.use('/api/v1', analyticsRoutes);
app.use('/api/v1', feeRoutes);
app.use('/api/v1', routineRoutes);
app.use('/api/v1', leaveRoutes);
app.use('/api/v1', substituteRoutes);
app.use('/api/v1', roomRoutes);
app.use('/api/v1', academicSessionRoutes);
app.use('/api/v1', notificationRoutes);
app.use('/api/v1', eventRoutes);
app.use('/api/v1', activityRoutes);
app.use('/api/v1', searchRoutes);
app.use('/api/v1', admissionRoutes);
app.use('/api/v1', teacherAssignmentRoutes);
app.use('/api/v1', adminRoutes);
app.use('/api/v1', examScheduleRoutes);
app.use('/api/v1', admitRoutes);
app.use('/api/v1', apiRoutes);

if (isProduction) {
    app.set('trust proxy', 1);
}

// Start server first so API is reachable even when DB is connecting or down
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`, {
        environment: process.env.NODE_ENV || 'development',
        port: PORT
    });
});

// MongoDB connection (non-blocking); skip when TEST_MODE=1 for running API tests without DB
if (process.env.TEST_MODE !== '1') {
mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 10,
    minPoolSize: 2,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 3000,
    heartbeatFrequencyMS: 10000,
    retryWrites: true,
    retryReads: true
})
.then(() => logger.info('MongoDB connected successfully'))
.catch(err => {
    logger.error('MongoDB connection error:', err.message || err);
    logger.warn('Server starting without database – set MONGO_URI in .env for full API.');
})

// MongoDB connection event listeners
mongoose.connection.on('error', err => {
    logger.error('MongoDB connection error:', err);
});
mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
});
} else {
    logger.info('TEST_MODE=1: Skipping MongoDB connection for API testing.');
}

// Graceful shutdown
process.on('SIGINT', async () => {
    logger.info('SIGINT received, closing MongoDB connection...');
    await mongoose.connection.close();
    logger.info('MongoDB connection closed through app termination');
    process.exit(0);
});
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, closing MongoDB connection...');
    await mongoose.connection.close();
    logger.info('MongoDB connection closed through app termination');
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

app.get('/', (req, res) => {
    res.json({
        success: true,
        data: {
            message: 'Welcome to Smart Campus API',
            status: 'active',
            version: '1.0',
            timestamp: new Date().toISOString()
        }
    });
});

// Basic health check for testing
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'healthy',
        healthy: true,
        timestamp: new Date().toISOString(),
        service: 'Smart Campus API'
    });
});

// Enable authentication routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/school', schoolRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/results', resultRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/principal', principalRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api', apiRoutes);
app.use('/api/public', publicRoutes);

// Fee, Routine, Leave, Substitute, Room, Academic Session
app.use('/api/fee', feeRoutes);
app.use('/api/routine', routineRoutes);
app.use('/api/leaves', leaveRoutes);
app.use('/api/substitutes', substituteRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/academic-sessions', academicSessionRoutes);

// Notifications, Events, Activity, Search, Admission, Teacher Assignments
app.use('/api/notifications', notificationRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/admission', admissionRoutes);
app.use('/api/teacher-assignments', teacherAssignmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/exam-schedule', examScheduleRoutes);
app.use('/api/admit', admitRoutes);

// API Documentation route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// 404 handler (must be before error handler)
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'API endpoint not found', timestamp: new Date().toISOString() });
});

// Enhanced error handling (must be last middleware)
app.use(errorHandler);

module.exports = app;