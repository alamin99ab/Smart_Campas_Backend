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
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
    console.debug = () => {};
    console.log = () => {};
    console.info = () => {};
    // Keep warning/error visible in production for issues
}

let memoryMongoServer = null;

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
    '/api/students/bulk'
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
            ai: '/api/ai'
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

// Auth Routes - Working ✅
try {
    const authRoutes = require('./routes/auth');
    app.use('/api/auth', authRoutes);
    console.log('✅ Auth routes loaded - Login, Register, Password Reset');
} catch (error) {
    console.error('❌ Failed to load auth routes:', error.message);
}

// Super Admin Routes - Working ✅
try {
    const superAdminRoutes = require('./routes/superAdmin');
    app.use('/api/super-admin', superAdminRoutes);
    console.log('✅ Super Admin routes loaded - School Management, Platform Control');
} catch (error) {
    console.error('❌ Failed to load super admin routes:', error.message);
}

// Principal Routes - Working ✅
try {
    const principalRoutes = require('./routes/principal');
    app.use('/api/principal', principalRoutes);
    console.log('✅ Principal routes loaded - Academic Setup, Teacher/Student Management');
} catch (error) {
    console.error('❌ Failed to load principal routes:', error.message);
}

// Teacher Routes
console.log('Loading teacher routes...');
try {
    const teacherRoutes = require('./routes/teacher');
    console.log('Teacher routes module loaded successfully');
    app.use('/api/teacher', teacherRoutes);
    console.log('✅ Teacher routes mounted at /api/teacher');
} catch (error) {
    console.error('❌ Failed to load teacher routes:', error.message);
    console.error(error.stack);
}

// Student Routes
console.log('Loading student routes...');
try {
    const studentRoutes = require('./routes/student');
    console.log('Student routes module loaded successfully');
    app.use('/api/student', studentRoutes);
    console.log('✅ Student routes mounted at /api/student');
} catch (error) {
    console.error('❌ Failed to load student routes:', error.message);
    console.error(error.stack);
}

// Parent Routes - Working ✅
try {
    const parentRoutes = require('./routes/parent');
    app.use('/api/parent', parentRoutes);
    console.log('✅ Parent routes loaded - Children Monitoring, Dashboard');
} catch (error) {
    console.error('❌ Failed to load parent routes:', error.message);
}

// Accountant Routes - Working ✅
try {
    const accountantRoutes = require('./routes/accountant');
    app.use('/api/accountant', accountantRoutes);
    console.log('✅ Accountant routes loaded - Fee Management, Dashboard');
} catch (error) {
    console.error('❌ Failed to load accountant routes:', error.message);
}

// Dashboard Routes - Working ✅
try {
    const dashboardRoutes = require('./routes/dashboard');
    app.use('/api/dashboard', dashboardRoutes);
    console.log('✅ Dashboard routes loaded - Analytics for All Roles');
} catch (error) {
    console.error('❌ Failed to load dashboard routes:', error.message);
}

// Notice Routes - Working ✅
try {
    const noticeRoutes = require('./routes/notices');
    app.use('/api/notices', noticeRoutes);
    console.log('✅ Notice routes loaded - Communication System');
} catch (error) {
    console.error('❌ Failed to load notice routes:', error.message);
}

// Academic Session Routes
try {
    const academicSessionRoutes = require('./routes/academicSessionRoutes');
    app.use('/api/academic-sessions', academicSessionRoutes);
    console.log('✅ Academic Session routes loaded');
} catch (error) {
    console.error('❌ Failed to load academic session routes:', error.message);
}

// Admission Routes
try {
    const admissionRoutes = require('./routes/admissionRoutes');
    app.use('/api/admissions', admissionRoutes);
    console.log('✅ Admission routes loaded');
} catch (error) {
    console.error('❌ Failed to load admission routes:', error.message);
}

// Attendance Routes
try {
    const attendanceRoutes = require('./routes/attendanceRoutes');
    app.use('/api/attendance', attendanceRoutes);
    console.log('✅ Attendance routes loaded');
} catch (error) {
    console.error('❌ Failed to load attendance routes:', error.message);
}

// Exam Schedule Routes
try {
    const examScheduleRoutes = require('./routes/examScheduleRoutes');
    app.use('/api/exam-schedules', examScheduleRoutes);
    console.log('✅ Exam Schedule routes loaded');
} catch (error) {
    console.error('❌ Failed to load exam schedule routes:', error.message);
}

// Fee Routes
try {
    const feeRoutes = require('./routes/feeRoutes');
    app.use('/api/fees', feeRoutes);
    console.log('✅ Fee routes loaded');
} catch (error) {
    console.error('❌ Failed to load fee routes:', error.message);
}

// Leave Routes
try {
    const leaveRoutes = require('./routes/leaveRoutes');
    app.use('/api/leave', leaveRoutes);
    console.log('✅ Leave routes loaded');
} catch (error) {
    console.error('❌ Failed to load leave routes:', error.message);
}

// Notification Routes
try {
    const notificationRoutes = require('./routes/notificationRoutes');
    app.use('/api/notifications', notificationRoutes);
    console.log('✅ Notification routes loaded');
} catch (error) {
    console.error('❌ Failed to load notification routes:', error.message);
}

// Result Routes
console.log('Loading result routes...');
try {
    const resultRoutes = require('./routes/resultRoutes');
    console.log('Result routes module loaded successfully');
    app.use('/api/results', resultRoutes);
    console.log('✅ Result routes mounted at /api/results');
} catch (error) {
    console.error('❌ Failed to load result routes:', error.message);
    console.error(error.stack);
}

// Routine Routes
try {
    const routineRoutes = require('./routes/routineRoutes');
    app.use('/api/routines', routineRoutes);
    // Legacy alias '/api/routine' removed for clarity and to avoid redundancy
    console.log('✅ Routine routes loaded');
} catch (error) {
    console.error('❌ Failed to load routine routes:', error.message);
}

// Search Routes
try {
    const searchRoutes = require('./routes/searchRoutes');
    app.use('/api/search', searchRoutes);
    console.log('✅ Search routes loaded');
} catch (error) {
    console.error('❌ Failed to load search routes:', error.message);
}

// Substitute Routes
try {
    const substituteRoutes = require('./routes/substituteRoutes');
    app.use('/api/substitutes', substituteRoutes);
    console.log('✅ Substitute routes loaded');
} catch (error) {
    console.error('❌ Failed to load substitute routes:', error.message);
}

// Teacher Assignment Routes
try {
    const teacherAssignmentRoutes = require('./routes/teacherAssignmentRoutes');
    app.use('/api/teacher-assignments', teacherAssignmentRoutes);
    console.log('✅ Teacher Assignment routes loaded');
} catch (error) {
    console.error('❌ Failed to load teacher assignment routes:', error.message);
}

// Activity Routes
try {
    const activityRoutes = require('./routes/activityRoutes');
    app.use('/api/activities', activityRoutes);
    console.log('✅ Activity routes loaded');
} catch (error) {
    console.error('❌ Failed to load activity routes:', error.message);
}

// Analytics Routes
try {
    const analyticsRoutes = require('./routes/analyticsRoutes');
    app.use('/api/analytics', analyticsRoutes);
    console.log('✅ Analytics routes loaded');
} catch (error) {
    console.error('❌ Failed to load analytics routes:', error.message);
}

// Room Routes
try {
    const roomRoutes = require('./routes/roomRoutes');
    app.use('/api/rooms', roomRoutes);
    console.log('✅ Room routes loaded');
} catch (error) {
    console.error('❌ Failed to load room routes:', error.message);
}

// Event Routes
try {
    const eventRoutes = require('./routes/eventRoutes');
    app.use('/api/events', eventRoutes);
    console.log('✅ Event routes loaded');
} catch (error) {
    console.error('❌ Failed to load event routes:', error.message);
}

// Public Routes
try {
    const publicRoutes = require('./routes/publicRoutes');
    app.use('/api/public', publicRoutes);
    console.log('✅ Public routes loaded');
} catch (error) {
    console.error('❌ Failed to load public routes:', error.message);
}

// AI Routes
try {
    const aiRoutes = require('./routes/ai');
    app.use('/api/ai', aiRoutes);
    console.log('✅ AI routes loaded - 10+ AI Features');
} catch (error) {
    console.error('❌ Failed to load AI routes:', error.message);
}

// Subscription Routes (SaaS)
try {
    const subscriptionRoutes = require('./routes/subscriptionRoutes');
    app.use('/api/subscriptions', subscriptionRoutes);
    console.log('✅ Subscription routes loaded - SaaS subscription management');
} catch (error) {
    console.error('❌ Failed to load subscription routes:', error.message);
}

// Promotion Routes
try {
    const promotionRoutes = require('./routes/promotionRoutes');
    app.use('/api/promotion', promotionRoutes);
    console.log('✅ Promotion routes loaded - Academic promotion management');
} catch (error) {
    console.error('❌ Failed to load promotion routes:', error.message);
}

// Student Bulk Import Routes
try {
    const studentBulkRoutes = require('./routes/studentBulkRoutes');
    app.use('/api/students/bulk', studentBulkRoutes);
    console.log('✅ Student bulk routes loaded - Bulk import support');
} catch (error) {
    console.error('❌ Failed to load student bulk routes:', error.message);
}

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
            ai: '/api/ai'
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

// Database connection and server start
const startServer = async () => {
    let dbConnected = false;

    // Check if we should use mock database for testing
    let useMockDB = process.env.USE_MOCK_DB === 'true' || process.env.NODE_ENV === 'test';
    let useMemoryDB = process.env.USE_MEMORY_DB === 'true';

    if (process.env.NODE_ENV === 'production' && (useMockDB || useMemoryDB)) {
        console.error('[DB] USE_MOCK_DB / USE_MEMORY_DB are not allowed in production.');
        process.exit(1);
    }

    if (useMemoryDB) {
        updateDbStatus({ mode: 'memory', connected: false, lastError: null });
    } else if (useMockDB) {
        updateDbStatus({ mode: 'mock', connected: false, lastError: null });
    } else {
        updateDbStatus({ mode: 'mongo', connected: false, lastError: null });
    }

    if (useMemoryDB) {
        try {
            console.log('\n[DB] Starting in-memory MongoDB replica set for local development...');
            let MongoMemoryReplSet;
            try {
                MongoMemoryReplSet = require('mongodb-memory-server').MongoMemoryReplSet;
            } catch (importError) {
                throw new Error(`mongodb-memory-server is required when USE_MEMORY_DB=true (${importError.message})`);
            }

            if (useMemoryDB && MongoMemoryReplSet) {
                memoryMongoServer = await MongoMemoryReplSet.create({
                    replSet: { count: 1 },
                    instanceOpts: [{
                        dbName: process.env.MEMORY_DB_NAME || 'smart-campus-dev'
                    }]
                });

                const memoryMongoUri = memoryMongoServer.getUri();
                await mongoose.connect(memoryMongoUri, {
                    serverSelectionTimeoutMS: 10000,
                    socketTimeoutMS: 30000,
                    connectTimeoutMS: 10000,
                    maxPoolSize: 5,
                    minPoolSize: 1,
                    retryWrites: false
                });

                dbConnected = true;
                updateDbStatus({ mode: 'memory', connected: true, lastError: null });
                console.log('[DB] In-memory MongoDB replica set started successfully');
                console.log(`[DB] Database: ${mongoose.connection.name}`);
                await ensureMongoIndexes();
            }
        } catch (memoryError) {
            updateDbStatus({ mode: 'memory', connected: false, lastError: memoryError.message });
            console.error('[DB] Failed to start in-memory MongoDB:', memoryError.message);
            process.exit(1);
        }
    }

    if (!dbConnected && useMockDB) {
        console.log('\n[DB] Using Mock Database mode...');
        console.warn('[DB] Database-backed features are disabled in mock mode.');
        updateDbStatus({ mode: 'mock', connected: false, lastError: app.locals.dbStatus.lastError });
    }

    if (!dbConnected && !useMockDB) {
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

    // Start server
    app.listen(PORT, '0.0.0.0', () => {
        console.log('\n[Startup] SMART CAMPUS SaaS - COMPLETE WORKFLOW RUNNING');
        console.log(`[Startup] Server: http://localhost:${PORT}`);
        console.log(`[Startup] Health Check: http://localhost:${PORT}/api/health`);
        console.log(`[Startup] API Info: http://localhost:${PORT}/api`);
        console.log(`[DB] Environment: ${process.env.NODE_ENV || 'development'}`);
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
    });
};

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('\nSIGTERM received, shutting down gracefully...');
    try {
        await mongoose.connection.close();
        if (memoryMongoServer) {
            await memoryMongoServer.stop();
        }
        console.log('MongoDB connection closed');
        process.exit(0);
    } catch (err) {
        console.error('Error closing MongoDB connection on SIGTERM:', err);
        process.exit(1);
    }
});

process.on('SIGINT', async () => {
    console.log('\nSIGINT received, shutting down gracefully...');
    try {
        await mongoose.connection.close();
        if (memoryMongoServer) {
            await memoryMongoServer.stop();
        }
        console.log('MongoDB connection closed');
        process.exit(0);
    } catch (err) {
        console.error('Error closing MongoDB connection on SIGINT:', err);
        process.exit(1);
    }
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
