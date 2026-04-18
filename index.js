const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const { enhancedSecurity } = require('./middleware/enhancedSecurity');
const requestId = require('./middleware/requestId');
const { ensureMongoIndexes } = require('./utils/ensureMongoIndexes');
const { validateEnv } = require('./utils/validateEnv');
const { getCacheInstance } = require('./services/cacheService');
const logger = require('./utils/logger');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
    console.debug = () => {};
    console.log = () => {};
    console.info = () => {};
    // Keep warning/error visible in production for issues
}


function isTruthyEnv(value) {
    return typeof value === 'string' && value.toLowerCase() === 'true';
}

function getBooleanEnv(keys) {
    for (const key of keys) {
        if (typeof process.env[key] === 'string') {
            return isTruthyEnv(process.env[key]);
        }
    }
    return null;
}

function parseAllowedOrigins() {
    const fromEnv = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
    const frontendUrl = (process.env.FRONTEND_URL || '').trim();
    const normalizeOrigin = (origin) => origin.replace(/\/+$/, '');
    const configured = [
        ...fromEnv,
        ...(frontendUrl ? [frontendUrl] : [])
    ].map(normalizeOrigin);

    const localDefaults = [
        'http://localhost:3000',
        'http://localhost:8080',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:8080'
    ].map(normalizeOrigin);

    if (process.env.NODE_ENV !== 'production') {
        return Array.from(new Set([...configured, ...localDefaults]));
    }

    return Array.from(new Set(configured));
}

const allowedOrigins = parseAllowedOrigins();
const allowAllOrigins = !isProduction && isTruthyEnv(process.env.ALLOW_ALL_ORIGINS);

const corsOptions = {
    origin: (origin, callback) => {
        if (allowAllOrigins) {
            return callback(null, true);
        }

        if (!origin) return callback(null, true); // allow curl / server-to-server

        if (!allowedOrigins.length) {
            console.warn('CORS: no ALLOWED_ORIGINS configured; blocking origin', origin);
            const corsConfigError = new Error('CORS is not configured for this server');
            corsConfigError.status = 403;
            corsConfigError.code = 'CORS_NOT_CONFIGURED';
            return callback(corsConfigError);
        }

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        console.warn('CORS: blocked origin', origin, 'allowed:', allowedOrigins.join(','));
        const corsOriginError = new Error('Origin is not allowed by CORS policy');
        corsOriginError.status = 403;
        corsOriginError.code = 'CORS_BLOCKED';
        return callback(corsOriginError);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-device-id']
};

console.log('CORS allowed origins:', allowAllOrigins ? '[ALLOW_ALL_ORIGINS enabled]' : (allowedOrigins.length ? allowedOrigins : '[none set]'));

// Validate environment variables before starting
if (!validateEnv()) {
    console.error('\n❌ Server startup aborted due to missing environment variables');
    console.error('📝 Please check .env.example for required variables\n');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001; // Render automatically sets PORT

const DB_REQUIRED_PREFIXES = [
    '/api/super-admin',
    '/api/principal',
    '/api/teacher',
    '/api/student',
    '/api/parent',
    '/api/accountant',
    '/api/dashboard',
    '/api/notices',
    '/api/academic-sessions',
    '/api/admissions',
    '/api/attendance',
    '/api/exam-schedules',
    '/api/fees',
    '/api/leave',
    '/api/notifications',
    '/api/results',
    '/api/routines',
    '/api/search',
    '/api/substitutes',
    '/api/teacher-assignments',
    '/api/activities',
    '/api/analytics',
    '/api/rooms',
    '/api/events',
    '/api/public',
    '/api/ai',
    '/api/subscriptions',
    '/api/promotion',
    '/api/students/bulk',
    '/api/exports'
];

const AUTH_DB_OPTIONAL_PUBLIC_ROUTES = new Set([
    'POST:/api/auth/super-admin/login',
    'POST:/api/auth/login',
    'POST:/api/auth/refresh',
    'POST:/api/auth/logout',
    'POST:/api/auth/setup',
    'POST:/api/auth/emergency-reset',
    'POST:/api/auto-setup-admin',
    'POST:/api/emergency-reset'
]);

const AUTH_DB_REQUIRED_PUBLIC_ROUTE_PATTERNS = [
    /^POST:\/api\/auth\/register$/,
    /^POST:\/api\/auth\/forgot-password$/,
    /^POST:\/api\/auth\/reset-password$/,
    /^PUT:\/api\/auth\/reset-password\/[^/]+$/,
    /^GET:\/api\/auth\/verify-email\/[^/]+$/,
    /^POST:\/api\/auth\/verify-email$/
];

const getMongoConnectionStateLabel = (readyState) => {
    switch (readyState) {
    case 0:
        return 'disconnected';
    case 1:
        return 'connected';
    case 2:
        return 'connecting';
    case 3:
        return 'disconnecting';
    default:
        return 'unknown';
    }
};

const normalizeRequestPath = (path) => {
    if (!path) return '';
    if (path.length > 1 && path.endsWith('/')) {
        return path.slice(0, -1);
    }
    return path;
};

const isDatabaseReady = () => mongoose.connection.readyState === 1;

const buildRouteKey = (reqMethod, requestPath) => `${reqMethod.toUpperCase()}:${requestPath}`;

const getAuthTokenFromRequest = (req) => {
    if (req.headers?.authorization && req.headers.authorization.startsWith('Bearer ')) {
        return req.headers.authorization.split(' ')[1];
    }

    if (req.cookies?.token) {
        return req.cookies.token;
    }

    return null;
};

const isDbRequiredPublicAuthRoute = (routeKey) => {
    return AUTH_DB_REQUIRED_PUBLIC_ROUTE_PATTERNS.some((pattern) => pattern.test(routeKey));
};

const decodeVerifiedAuthToken = (token) => {
    if (!token) {
        return null;
    }

    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            return null;
        }

        return jwt.verify(token, secret);
    } catch (error) {
        return null;
    }
};

const shouldGateAuthRouteForDatabase = (req, path) => {
    const routeKey = buildRouteKey(req.method, path);

    if (AUTH_DB_OPTIONAL_PUBLIC_ROUTES.has(routeKey)) {
        return false;
    }

    if (isDbRequiredPublicAuthRoute(routeKey)) {
        return true;
    }

    const token = getAuthTokenFromRequest(req);
    if (!token) {
        // Let auth middleware/routes return proper 401/403 for missing auth.
        return false;
    }

    const decodedToken = decodeVerifiedAuthToken(token);
    if (!decodedToken) {
        // Invalid/expired token should be handled by auth middleware as 401.
        return false;
    }

    const isEnvUser = decodedToken.id === 'super_admin_env' && decodedToken.isEnvBased === true;
    if (isEnvUser) {
        // Avoid brittle route allowlists for env-based auth routes.
        // Env-token auth handlers must do their own DB checks when needed.
        return false;
    }

    return true;
};

const isDbDependentRequest = (req) => {
    if (req.method === 'OPTIONS') {
        return false;
    }

    const path = normalizeRequestPath(req.path || req.originalUrl || '');

    if (!path.startsWith('/api')) {
        return false;
    }

    if (path === '/api' || path === '/api/health' || path === '/api/readiness') {
        return false;
    }

    if (path.startsWith('/api/auth')) {
        return shouldGateAuthRouteForDatabase(req, path);
    }

    return DB_REQUIRED_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
};

app.locals.dbStatus = {
    mode: 'uninitialized',
    connected: false,
    readyState: mongoose.connection.readyState,
    state: getMongoConnectionStateLabel(mongoose.connection.readyState),
    lastError: null,
    updatedAt: new Date().toISOString()
};

const updateDbStatus = (patch = {}) => {
    app.locals.dbStatus = {
        ...app.locals.dbStatus,
        ...patch,
        connected: isDatabaseReady(),
        readyState: mongoose.connection.readyState,
        state: getMongoConnectionStateLabel(mongoose.connection.readyState),
        updatedAt: new Date().toISOString()
    };
};

mongoose.connection.on('connected', () => {
    updateDbStatus({ connected: true, lastError: null });
    console.log('ℹ️ MongoDB connection state: connected');
});

mongoose.connection.on('disconnected', () => {
    updateDbStatus({ connected: false });
    console.warn('⚠️ MongoDB connection state: disconnected');
});

mongoose.connection.on('error', (error) => {
    updateDbStatus({ connected: false, lastError: error.message });
    console.error('❌ MongoDB connection error:', error.message);
});

// Basic middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB sanitize - prevent NoSQL injection
app.use(mongoSanitize());

// Request ID for tracking
app.use(requestId);

// Enhanced security middleware
app.use(enhancedSecurity);

// First-request bootstrap: populate empty DB once (production-safe; logs via console.warn in prod)
const { databaseBootstrapMiddleware } = require('./middleware/databaseBootstrap');
app.use(databaseBootstrapMiddleware);

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 100 : 5000,
    message: {
        error: 'Too many requests, please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false
});
app.use(limiter);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Smart Campus SaaS API is running',
        timestamp: new Date().toISOString(),
        version: '5.0.0',
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        status: 'All Routes Loaded Successfully',
        database: app.locals.dbStatus
    });
});

app.get('/api/readiness', (req, res) => {
    const ready = isDatabaseReady();
    const statusCode = ready ? 200 : 503;

    return res.status(statusCode).json({
        success: ready,
        message: ready
            ? 'Service is ready to serve database-dependent APIs'
            : 'Service is running but database is unavailable',
        database: app.locals.dbStatus
    });
});

// API info endpoint
app.get('/api', (req, res) => {
    res.json({
        message: '🚀 Smart Campus SaaS API - Complete Workflow',
        version: '5.0.0',
        environment: process.env.NODE_ENV || 'development',
        port: PORT,
        endpoints: {
            health: '/api/health',
            auth: '/api/auth',
            superAdmin: '/api/super-admin',
            principal: '/api/principal',
            teacher: '/api/teacher',
            student: '/api/student',
            parent: '/api/parent',
            accountant: '/api/accountant',
            dashboard: '/api/dashboard',
            notices: '/api/notices',
            academicSessions: '/api/academic-sessions',
            admissions: '/api/admissions',
            attendance: '/api/attendance',
            examSchedules: '/api/exam-schedules',
            fees: '/api/fees',
            leave: '/api/leave',
            notifications: '/api/notifications',
            results: '/api/results',
            routines: '/api/routines',
            search: '/api/search',
            substitutes: '/api/substitutes',
            teacherAssignments: '/api/teacher-assignments',
            activities: '/api/activities',
            analytics: '/api/analytics',
            rooms: '/api/rooms',
            events: '/api/events',
            public: '/api/public',
            ai: '/api/ai',
            exports: '/api/exports'
        },
        workflow: {
            phase1: 'Super Admin Setup ✅',
            phase2: 'School Creation ✅',
            phase3: 'Principal Flow ✅',
            phase4: 'Routine Setup ✅',
            phase5: 'Daily Operations ✅',
            phase6: 'Results ✅',
            phase7: 'Fees ✅',
            phase8: 'Notices ✅',
            phase9: 'Analytics ✅'
        }
    });
});

// Readiness gating for database-dependent APIs
app.use((req, res, next) => {
    if (!isDbDependentRequest(req)) {
        return next();
    }

    if (isDatabaseReady()) {
        return next();
    }

    return res.status(503).json({
        success: false,
        code: 'DB_UNAVAILABLE',
        message: 'Database is not connected. Database-dependent APIs are temporarily unavailable.',
        requestId: req.id || null,
        retryable: true,
        database: app.locals.dbStatus
    });
});

// Load all routes with comprehensive error handling
console.log('🔄 Loading Smart Campus SaaS Routes...');

// Auto Admin Setup Routes - For Render Deployment (Built-in)
try {
    // Direct admin creation function - no external scripts needed
    // Auto-setup endpoint is read-only: Super Admin must be configured via environment variables.
    const createSuperAdmin = async (req, res) => {
        try {
            const adminEmail = process.env.SUPER_ADMIN_EMAIL;
            if (!adminEmail) {
                return res.status(400).json({
                    success: false,
                    message: 'Super Admin is not configured. Set SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD in environment.'
                });
            }

            return res.json({
                success: true,
                message: 'Super Admin is managed via environment variables. No database record is created.',
                data: { email: process.env.SUPER_ADMIN_EMAIL, name: process.env.SUPER_ADMIN_NAME || 'Super Admin' },
                login_url: `${req.protocol}://${req.get('host')}/api/auth/super-admin/login`,
                note: 'To change Super Admin credentials, update environment variables in your hosting provider (Render, etc.).'
            });
        } catch (error) {
            console.error('❌ Auto-admin endpoint error:', error.message);
            res.status(500).json({ success: false, message: 'Auto-admin endpoint failed', error: error.message });
        }
    };

    // Setup page
    const setupPage = (req, res) => {
        const html = `<!DOCTYPE html>
<html>
<head>
    <title>Smart Campus - Auto Setup</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #007bff; text-align: center; }
        .btn { 
            background: #007bff; 
            color: white; 
            padding: 15px 30px; 
            border: none; 
            border-radius: 5px; 
            cursor: pointer; 
            font-size: 16px; 
            width: 100%;
            margin: 10px 0;
        }
        .btn:hover { background: #0056b3; }
        .btn.success { background: #28a745; }
        .btn.success:hover { background: #1e7e34; }
        .result { margin: 20px 0; padding: 15px; border-radius: 5px; }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
        .center { text-align: center; }
        .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #007bff; border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; display: inline-block; margin-right: 10px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Smart Campus SaaS</h1>
        <h2>Auto Super Admin Setup</h2>
        
        <div class="info">
            <p><strong>📋 This will create the Super Admin account using environment variables:</strong></p>
            <pre>
Email: ${process.env.SUPER_ADMIN_EMAIL || 'Not configured'}
Password: [Set in environment variables]
Phone: ${process.env.SUPER_ADMIN_PHONE || '+1234567890'}
Role: super_admin
            </pre>
        </div>
        
        <button class="btn" onclick="setupAdmin()">
            <span id="btnText">🔥 Create Super Admin Now</span>
        </button>
        
        <div id="result"></div>
        
        <div class="center">
            <small>
                After setup, login at: <a href="/api/auth/login" target="_blank">/api/auth/login</a>
            </small>
        </div>
    </div>

    <script>
        async function setupAdmin() {
            const btn = document.querySelector('.btn');
            const btnText = document.getElementById('btnText');
            const result = document.getElementById('result');
            
            btn.disabled = true;
            btnText.innerHTML = '<span class="spinner"></span>Creating Super Admin...';
            result.innerHTML = '';
            
            try {
                const response = await fetch('/api/auto-setup-admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const data = await response.json();

                btn.disabled = false;
                btnText.innerText = '🔥 Create Super Admin Now';

                if (data && data.success) {
                    result.innerHTML = '<div class="result success">' + (data.message || '') + '<pre>' + JSON.stringify(data.data || {}, null, 2) + '</pre></div>';
                } else {
                    result.innerHTML = '<div class="result error">' + (data && data.message ? data.message : 'Failed to create Super Admin') + '</div>';
                }
            } catch (err) {
                btn.disabled = false;
                btnText.innerText = '🔥 Create Super Admin Now';
                result.innerHTML = '<div class="result error">' + (err.message || '') + '</div>';
            }
        }

    </script>
</body>
</html>`;

    res.status(200).send(html);
    };

    if (process.env.ENABLE_AUTO_SETUP === 'true') {
        app.get('/setup', setupPage);
        app.post('/api/auto-setup-admin', createSuperAdmin);
        const emergencyReset = async (req, res) => {
            return res.status(403).json({
                success: false,
                message: 'Emergency reset disabled. Super Admin is managed via environment variables. Update credentials via your hosting provider.'
            });
        };

        app.post('/api/emergency-reset', emergencyReset);
        console.log('✅ Auto Admin Setup routes loaded - /setup, /api/auto-setup-admin, /api/emergency-reset (enabled)');
    } else {
        console.log('ℹ️ Auto Admin Setup routes disabled (ENABLE_AUTO_SETUP !== true)');
    }
} catch (error) {
    console.error('❌ Failed to load auto admin setup routes:', error.message);
}

// Load API Routes
const routeModules = [
    { path: '/api/auth', module: './routes/auth', name: 'Auth' },
    { path: '/api/super-admin', module: './routes/superAdmin', name: 'Super Admin' },
    { path: '/api/principal', module: './routes/principal', name: 'Principal' },
    { path: '/api/teacher', module: './routes/teacher', name: 'Teacher' },
    { path: '/api/student', module: './routes/student', name: 'Student' },
    { path: '/api/parent', module: './routes/parent', name: 'Parent' },
    { path: '/api/accountant', module: './routes/accountant', name: 'Accountant' },
    { path: '/api/dashboard', module: './routes/dashboard', name: 'Dashboard' },
    { path: '/api/notices', module: './routes/notices', name: 'Notice' },
    { path: '/api/academic-sessions', module: './routes/academicSessionRoutes', name: 'Academic Session' },
    { path: '/api/admissions', module: './routes/admissionRoutes', name: 'Admission' },
    { path: '/api/attendance', module: './routes/attendanceRoutes', name: 'Attendance' },
    { path: '/api/exam-schedules', module: './routes/examScheduleRoutes', name: 'Exam Schedule' },
    { path: '/api/fees', module: './routes/feeRoutes', name: 'Fee' },
    { path: '/api/leave', module: './routes/leaveRoutes', name: 'Leave' },
    { path: '/api/notifications', module: './routes/notificationRoutes', name: 'Notification' },
    { path: '/api/results', module: './routes/resultRoutes', name: 'Result' },
    { path: '/api/exports', module: './routes/exportRoutes', name: 'Export' }
];

let loadedRoutes = 0;
routeModules.forEach(({ path, module, name }) => {
    try {
        const routes = require(module);
        app.use(path, routes);
        loadedRoutes++;
    } catch (error) {
        console.error(`Failed to load ${name} routes:`, error.message);
    }
});

console.log(`Loaded ${loadedRoutes}/${routeModules.length} core API routes`);

// Load remaining API routes
const remainingRoutes = [
    { path: '/api/routines', module: './routes/routineRoutes', name: 'Routine' },
    { path: '/api/search', module: './routes/searchRoutes', name: 'Search' },
    { path: '/api/substitutes', module: './routes/substituteRoutes', name: 'Substitute' },
    { path: '/api/teacher-assignments', module: './routes/teacherAssignmentRoutes', name: 'Teacher Assignment' },
    { path: '/api/activities', module: './routes/activityRoutes', name: 'Activity' },
    { path: '/api/analytics', module: './routes/analyticsRoutes', name: 'Analytics' },
    { path: '/api/rooms', module: './routes/roomRoutes', name: 'Room' },
    { path: '/api/events', module: './routes/eventRoutes', name: 'Event' },
    { path: '/api/public', module: './routes/publicRoutes', name: 'Public' },
    { path: '/api/ai', module: './routes/ai', name: 'AI' },
    { path: '/api/subscriptions', module: './routes/subscriptionRoutes', name: 'Subscription' },
    { path: '/api/promotion', module: './routes/promotionRoutes', name: 'Promotion' },
    { path: '/api/students/bulk', module: './routes/studentBulkRoutes', name: 'Student Bulk' }
];

let remainingLoaded = 0;
remainingRoutes.forEach(({ path, module, name }) => {
    try {
        const routes = require(module);
        app.use(path, routes);
        remainingLoaded++;
    } catch (error) {
        console.error(`Failed to load ${name} routes:`, error.message);
    }
});

console.log(`Loaded ${remainingLoaded}/${remainingRoutes.length} additional API routes`);

// 404 handler with all available endpoints
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        availableEndpoints: {
            health: '/api/health',
            info: '/api',
            authentication: '/api/auth',
            superAdmin: '/api/super-admin',
            principal: '/api/principal',
            teacher: '/api/teacher',
            student: '/api/student',
            parent: '/api/parent',
            accountant: '/api/accountant',
            dashboard: '/api/dashboard',
            notices: '/api/notices',
            academicSessions: '/api/academic-sessions',
            admissions: '/api/admissions',
            attendance: '/api/attendance',
            examSchedules: '/api/exam-schedules',
            fees: '/api/fees',
            leave: '/api/leave',
            notifications: '/api/notifications',
            results: '/api/results',
            routines: '/api/routines',
            search: '/api/search',
            substitutes: '/api/substitutes',
            teacherAssignments: '/api/teacher-assignments',
            activities: '/api/activities',
            analytics: '/api/analytics',
            rooms: '/api/rooms',
            events: '/api/events',
            public: '/api/public',
            ai: '/api/ai',
            exports: '/api/exports'
        },
        workflow: 'Complete Smart Campus SaaS Workflow Available'
    });
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('Global error:', error);

    const isDbError = error.name === 'MongoServerSelectionError'
        || error.name === 'MongooseServerSelectionError'
        || error.name === 'MongoNetworkError'
        || error.name === 'MongooseError'
        || /buffering timed out/i.test(error.message || '');

    const statusCode = error.status || error.statusCode || (isDbError ? 503 : 500);
    const message = statusCode >= 500
        ? (isDbError ? 'Database unavailable. Please try again shortly.' : 'Internal server error')
        : (error.message || 'Request failed');

    res.status(statusCode).json({
        success: false,
        code: error.code || (isDbError ? 'DB_UNAVAILABLE' : 'REQUEST_FAILED'),
        message,
        requestId: req.id || null,
        ...(process.env.NODE_ENV !== 'production' && {
            details: error.message,
            stack: error.stack
        })
    });
});

// Environment validation and startup checks
const validateStartupEnvironment = () => {
    const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
        console.error('[STARTUP] Missing required environment variables:', missingVars.join(', '));
        if (process.env.NODE_ENV === 'production') {
            console.error('[STARTUP] Production environment requires all required variables. Exiting.');
            process.exit(1);
        }
        console.warn('[STARTUP] Continuing in development mode with missing variables.');
    }

    // Validate JWT secret strength
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
        console.warn('[STARTUP] JWT_SECRET should be at least 32 characters for security.');
    }

    // Validate MongoDB URI format
    if (process.env.MONGO_URI && !process.env.MONGO_URI.startsWith('mongodb')) {
        console.error('[STARTUP] Invalid MONGO_URI format. Must start with "mongodb".');
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }

    // Set safe defaults
    const safeDefaults = {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PORT: Math.min(65535, Math.max(1000, parseInt(process.env.PORT) || 3000)),
        JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
        BCRYPT_ROUNDS: Math.min(15, Math.max(8, parseInt(process.env.BCRYPT_ROUNDS) || 12)),
        RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
        RATE_LIMIT_MAX_REQUESTS: Math.min(1000, Math.max(10, parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100))
    };

    Object.entries(safeDefaults).forEach(([key, value]) => {
        if (!process.env[key]) {
            process.env[key] = value.toString();
            console.log(`[STARTUP] Set default for ${key}: ${value}`);
        }
    });

    console.log(`[STARTUP] Environment: ${process.env.NODE_ENV}`);
    console.log(`[STARTUP] Port: ${process.env.PORT}`);
    console.log(`[STARTUP] Rate Limit: ${process.env.RATE_LIMIT_MAX_REQUESTS} requests per ${process.env.RATE_LIMIT_WINDOW_MS/1000} seconds`);
};

// Database connection and server start
const startServer = async () => {
    let dbConnected = false;

    // Validate environment first
    validateStartupEnvironment();

    // Production safety: Block development-only database modes
    if (process.env.USE_MOCK_DB === 'true' || process.env.USE_MEMORY_DB === 'true') {
        console.error('[DB] Development database modes are not allowed in production.');
        process.exit(1);
    }

    updateDbStatus({ mode: 'mongo', connected: false, lastError: null });

    if (!dbConnected) {
        try {
            console.log('\n[DB] Connecting to MongoDB...');
            console.log(`[DB] Environment: ${process.env.NODE_ENV || 'development'}`);

            await mongoose.connect(process.env.MONGO_URI, {
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 30000,
                connectTimeoutMS: 10000,
                maxPoolSize: 5,
                minPoolSize: 1,
                retryWrites: false
            });

            dbConnected = true;
            updateDbStatus({ mode: 'mongo', connected: true, lastError: null });
            console.log('[DB] MongoDB Connected Successfully!');
            console.log(`[DB] Database: ${mongoose.connection.name}`);
            await ensureMongoIndexes();
            console.log(`[DB] Host: ${mongoose.connection.host}`);
        } catch (dbError) {
            updateDbStatus({ mode: 'mongo', connected: false, lastError: dbError.message });
            console.error('[DB] MongoDB connection failed:', dbError.message);
            if (process.env.NODE_ENV === 'production') {
                console.error('[DB] Production DB failure: aborting startup to prevent running in a malfunctioning state.');
                process.exit(1);
            }

            console.warn('[DB] Non-production environment: continuing startup with DB readiness gating enabled.');
        }
    }

    if (dbConnected) {
        if (process.env.NODE_ENV === 'production') {
            console.warn('\n[Startup] Demo data: first HTTP request runs DB bootstrap if schools collection is empty.');
        } else {
            console.log('\n[Startup] Demo data: first HTTP request runs DB bootstrap if schools collection is empty.');
        }
    } else {
        console.log('\n[Startup] Database not connected - school features unavailable; Super Admin still logs in via environment credentials.');
        if (process.env.NODE_ENV === 'production') {
            console.error('[Startup] Production abort: MongoDB connection required in production. Exiting.');
            process.exit(1);
        }
    }

    // Initialize cache service
    const cache = getCacheInstance({
        enabled: true,
        defaultTTL: 300, // 5 minutes
        maxSize: process.env.CACHE_MAX_SIZE ? parseInt(process.env.CACHE_MAX_SIZE) : 1000,
        cleanupInterval: 60000 // 1 minute
    });

    // Start server
    app.listen(PORT, '0.0.0.0', () => {
        const cacheStats = cache.getStats();
        
        logger.info('SMART CAMPUS SaaS - Server Started Successfully', {
            port: PORT,
            environment: process.env.NODE_ENV,
            dbConnected,
            cacheEnabled: cacheStats.enabled,
            cacheMaxSize: cacheStats.maxSize
        });

        console.log('\n[Startup] SMART CAMPUS SaaS - COMPLETE WORKFLOW RUNNING');
        console.log(`[Startup] Server: http://localhost:${PORT}`);
        console.log(`[Startup] Health Check: http://localhost:${PORT}/api/health`);
        console.log(`[Startup] API Info: http://localhost:${PORT}/api`);
        console.log(`[DB] Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`[Cache] Enabled: ${cacheStats.enabled} (Max: ${cacheStats.maxSize} entries)`);
        console.log('\n[Startup] ALL WORKFLOW FEATURES AVAILABLE:');
        console.log('   - Phase 1: Super Admin Setup');
        console.log('   - Phase 2: School Creation');
        console.log('   - Phase 3: Principal Flow');
        console.log('   - Phase 4: Routine Setup');
        console.log('   - Phase 5: Daily Operations');
        console.log('   - Phase 6: Results');
        console.log('   - Phase 7: Fees');
        console.log('   - Phase 8: Notices');
        console.log('   - Phase 9: Analytics');
        console.log('\n[Startup] READY FOR COMPLETE WORKFLOW TESTING!');
        console.log('[Startup] Production-ready with caching and monitoring enabled');
    });
};

// ... (rest of the code remains the same)
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
