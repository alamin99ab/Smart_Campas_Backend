const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');

require('dotenv').config();

const app = express();

const { validateEnv, getCorsOrigin, isProduction } = require('./config/env');
validateEnv();

const logger = require('./utils/logger');
const errorHandler = require('./middleware/enhanced/errorHandler');
const { sanitize, noPrototypePollution } = require('./middleware/securityMiddleware');
const requestId = require('./middleware/requestId');

const authRoutes = require('./routes/auth');
const superAdminRoutes = require('./routes/superAdmin');
const principalRoutes = require('./routes/principal');
const teacherRoutes = require('./routes/teacher');
const studentRoutes = require('./routes/student');
const dashboardRoutes = require('./routes/dashboard');
const noticeRoutes = require('./routes/notices');
const aiRoutes = require('./routes/ai');

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

const { specs, swaggerUi } = require('./docs/api-documentation');

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
        },
    },
    crossOriginEmbedderPolicy: false
}));

app.use(cors(corsOptions));
app.use(compression());
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());
app.use(sanitize());
app.use(noPrototypePollution());
app.use(requestId);

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: isProduction ? 100 : 1000,
    message: {
        error: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));

app.use('/api/auth', authRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/principal', principalRoutes);
app.use('/api/teacher', teacherRoutes);
app.use('/api/student', studentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notices', require('./routes/notices'));
app.use('/api/ai', aiRoutes);

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

app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        message: 'Smart Campus SaaS API is running',
        timestamp: new Date().toISOString(),
        version: '5.0.0',
        environment: process.env.NODE_ENV || 'production'
    });
});

app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        if (process.env.MONGO_URI) {
            await mongoose.connect(process.env.MONGO_URI);
            logger.info('Connected to MongoDB');
        }
        
        app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`, {
                environment: process.env.NODE_ENV || 'production',
                port: PORT
            });
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

process.on('SIGTERM', () => {
    logger.info('SIGTERM received');
    mongoose.connection.close(() => {
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received');
    mongoose.connection.close(() => {
        process.exit(0);
    });
});

module.exports = app;
