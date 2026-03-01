/**
 * 🚀 RENDER PRODUCTION SERVER
 * Optimized for Render deployment with maximum reliability
 */

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

require('dotenv').config();

const app = express();

// Basic configuration
const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'production';
const MONGO_URI = process.env.MONGO_URI;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
    origin: process.env.FRONTEND_URL || true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: NODE_ENV === 'production' ? 100 : 1000,
    message: {
        error: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(limiter);
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint (Render uses this)
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: NODE_ENV,
        memory: {
            used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
            total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
        }
    });
});

// API info endpoint
app.get('/api', (req, res) => {
    res.json({
        message: '🚀 Smart Campus SaaS API',
        version: '2.0.0',
        environment: NODE_ENV,
        endpoints: {
            health: '/api/health',
            auth: '/api/auth',
            docs: '/api-docs'
        }
    });
});

// Basic routes (load only essential ones first)
try {
    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);
    console.log('✅ Auth routes loaded');
} catch (error) {
    console.error('❌ Failed to load auth routes:', error.message);
}

try {
    const superAdminRoutes = require('./routes/superAdmin');
    app.use('/api/super-admin', superAdminRoutes);
    console.log('✅ Super Admin routes loaded');
} catch (error) {
    console.error('❌ Failed to load super admin routes:', error.message);
}

// Load other routes with error handling
const routeModules = [
    { path: '/api/principal', file: './routes/principal' },
    { path: '/api/teacher', file: './routes/teacher' },
    { path: '/api/student', file: './routes/student' },
    { path: '/api/dashboard', file: './routes/dashboard' },
    { path: '/api/notices', file: './routes/notices' },
    { path: '/api/ai', file: './routes/ai' }
];

routeModules.forEach(route => {
    try {
        const routes = require(route.file);
        app.use(route.path, routes);
        console.log(`✅ ${route.path} routes loaded`);
    } catch (error) {
        console.error(`❌ Failed to load ${route.path} routes:`, error.message);
    }
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.originalUrl,
        method: req.method
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error:', error);
    
    res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Internal server error',
        ...(NODE_ENV !== 'production' && { stack: error.stack })
    });
});

// Database connection and server start
const startServer = async () => {
    try {
        // Connect to MongoDB if URI is provided
        if (MONGO_URI) {
            console.log('🔄 Connecting to MongoDB...');
            await mongoose.connect(MONGO_URI, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });
            console.log('✅ Connected to MongoDB');
        } else {
            console.log('⚠️  MONGO_URI not provided, running without database');
        }
        
        // Start server
        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
            console.log(`📍 Environment: ${NODE_ENV}`);
            console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
            console.log(`📚 API info: http://localhost:${PORT}/api`);
        });
        
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        
        // Try to start server without database
        if (error.message.includes('MongoDB')) {
            console.log('🔄 Attempting to start server without database...');
            app.listen(PORT, () => {
                console.log(`🚀 Server running on port ${PORT} (database disabled)`);
                console.log(`📍 Environment: ${NODE_ENV}`);
            });
        } else {
            process.exit(1);
        }
    }
};

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    mongoose.connection.close(() => {
        console.log('MongoDB connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    mongoose.connection.close(() => {
        console.log('MongoDB connection closed');
        process.exit(0);
    });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

// Start the server
startServer();

module.exports = app;
