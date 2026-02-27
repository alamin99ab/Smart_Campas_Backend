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
const { standardizedResponse } = require('./middleware/enhanced/standardizedResponse');
const { errorHandler } = require('./middleware/enhanced/errorHandler');
const { validations, handleValidationErrors } = require('./middleware/enhanced/validation');
const { rateLimiters, securityHeaders, sanitizeInput, corsOptions } = require('./middleware/enhanced/security');
const { sanitize, noPrototypePollution } = require('./middleware/securityMiddleware');
const requestId = require('./middleware/requestId');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const teacherRoutes = require('./routes/teacherRoutes');
const schoolRoutes = require('./routes/schoolRoutes');
const noticeRoutes = require('./routes/noticeRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const resultRoutes = require('./routes/resultRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const principalRoutes = require('./routes/principalRoutes');
const apiRoutes = require('./routes/apiRoutes');
const publicRoutes = require('./routes/publicRoutes');

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
app.use(noPrototypePollution());
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

if (isProduction) {
    app.set('trust proxy', 1);
}

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
    maxPoolSize: 10,
    minPoolSize: 2,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 5000,
    heartbeatFrequencyMS: 10000,
    retryWrites: true,
    retryReads: true
})
.then(() => logger.info('MongoDB connected successfully'))
.catch(err => {
    logger.error('MongoDB connection error:', err);
    process.exit(1);
});

// MongoDB connection event listeners
mongoose.connection.on('error', err => {
    logger.error('MongoDB connection error:', err);
});
mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
});

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
// app.use('/api/student', enhancedStudentRoutes);
app.use('/api/teacher', teacherRoutes);
// app.use('/api/teacher', enhancedTeacherRoutes);
app.use('/api', apiRoutes);
app.use('/api/public', publicRoutes);

// Comment out all routes for debugging
// app.use('/api/admin', adminRoutes);
// app.use('/api/admit', admitRoutes);
// app.use('/api/fee', feeRoutes);
// app.use('/api/notifications', notificationRoutes);
// app.use('/api/events', eventRoutes);
// app.use('/api/activity', activityRoutes);
// app.use('/api/search', searchRoutes);
// app.use('/api/admission', admissionRoutes);
// app.use('/api/routine', routineRoutes);
// app.use('/api/teacher-assignments', teacherAssignmentRoutes);

// API Documentation route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

// 404 handler (must be before error handler)
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'API endpoint not found' });
});

// Enhanced error handling (must be last middleware)
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`, {
        environment: process.env.NODE_ENV || 'development',
        port: PORT
    });
});

module.exports = app;