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
// const enhancedStudentRoutes = require('./routes/enhancedStudentRoutes');
// const enhancedTeacherRoutes = require('./routes/enhancedTeacherRoutes');
const publicRoutes = require('./routes/publicRoutes');

const app = express();

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 150,
    message: { success: false, message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
});
app.use('/api', apiLimiter);

const healthLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
    message: { success: false, message: 'Too many health checks.' }
});

app.use(helmet());
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000, // Much higher for testing
    message: { success: false, message: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false
}));
app.use(requestId);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
// app.use(xss());
app.use(sanitize);
app.use(noPrototypePollution);

const corsOrigin = getCorsOrigin();
app.use(cors({
    origin: Array.isArray(corsOrigin) ? corsOrigin : [corsOrigin],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'X-Request-Id']
}));

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

app.use((req, res) => {
    res.status(404).json({ success: false, message: 'API endpoint not found' });
});

app.use((err, req, res, next) => {
    logger.error('Server error:', {
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        ip: req.ip,
        requestId: req.id
    });
    
    const status = err.status || err.statusCode || 500;
    const message = status === 500 && isProduction
        ? 'Internal server error'
        : (err.message || 'Internal server error');
    
    res.status(status).json({
        success: false,
        message,
        ...(isProduction ? {} : { stack: err.stack })
    });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT}`, {
        environment: process.env.NODE_ENV || 'development',
        port: PORT
    });
});

module.exports = app;