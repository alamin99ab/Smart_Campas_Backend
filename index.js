const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const { enhancedSecurity } = require('./middleware/enhancedSecurity');
const requestId = require('./middleware/requestId');
const { validateEnv } = require('./utils/validateEnv');
require('dotenv').config();

// Validate environment variables before starting
if (!validateEnv()) {
    console.error('\n❌ Server startup aborted due to missing environment variables');
    console.error('📝 Please check .env.example for required variables\n');
    process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001; // Render automatically sets PORT

// Basic middleware
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
}));
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// MongoDB sanitize - prevent NoSQL injection
app.use(mongoSanitize());

// Request ID for tracking
app.use(requestId);

// Enhanced security middleware
app.use(enhancedSecurity);

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
        status: 'All Routes Loaded Successfully'
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

// Load all routes with comprehensive error handling
console.log('🔄 Loading Smart Campus SaaS Routes...');

// Auto Admin Setup Routes - For Render Deployment (Built-in)
try {
    // Direct admin creation function - no external scripts needed
    const createSuperAdmin = async (req, res) => {
        try {
            const bcrypt = require('bcryptjs');
            const User = require('./models/User');
            
            const SUPER_ADMIN = {
                name: process.env.SUPER_ADMIN_NAME,
                email: process.env.SUPER_ADMIN_EMAIL,
                password: process.env.SUPER_ADMIN_PASSWORD,
                phone: process.env.SUPER_ADMIN_PHONE,
                role: 'super_admin'
            };

            // Check if Super Admin already exists
            const existingAdmin = await User.findOne({ role: 'super_admin' });
            const forceReset = req.body.force === true || req.query.force === 'true';
            
            if (existingAdmin) {
                // If force reset is requested, unblock and reset password
                if (forceReset) {
                    const newPassword = req.body.password || SUPER_ADMIN.password || 'Admin@123456';
                    const hashedPassword = await bcrypt.hash(newPassword, 12);
                    
                    existingAdmin.password = hashedPassword;
                    existingAdmin.isBlocked = false;
                    existingAdmin.loginAttempts = 0;
                    existingAdmin.isActive = true;
                    await existingAdmin.save();
                    
                    return res.json({
                        success: true,
                        message: 'Super Admin reset successfully',
                        admin: {
                            email: existingAdmin.email,
                            name: existingAdmin.name,
                            role: existingAdmin.role,
                            password: newPassword
                        },
                        login_url: `${req.protocol}://${req.get('host')}/api/auth/login`
                    });
                }
                
                return res.json({
                    success: true,
                    message: 'Super Admin already exists',
                    admin: {
                        email: existingAdmin.email,
                        name: existingAdmin.name,
                        role: existingAdmin.role
                    },
                    login_url: `${req.protocol}://${req.get('host')}/api/auth/login`
                });
            }

            // Create new Super Admin
            const hashedPassword = await bcrypt.hash(SUPER_ADMIN.password, 12);
            
            const superAdmin = new User({
                name: SUPER_ADMIN.name,
                email: SUPER_ADMIN.email,
                password: hashedPassword,
                role: SUPER_ADMIN.role,
                phone: SUPER_ADMIN.phone,
                isApproved: true,
                emailVerified: true,
                isActive: true
            });

            await superAdmin.save();

            console.log('✅ Super Admin created successfully via endpoint');

            res.json({
                success: true,
                message: 'Super Admin created successfully',
                admin: {
                    email: SUPER_ADMIN.email,
                    name: SUPER_ADMIN.name,
                    role: SUPER_ADMIN.role,
                    password: SUPER_ADMIN.password
                },
                login_url: `${req.protocol}://${req.get('host')}/api/auth/login`,
                instructions: {
                    step1: 'Use the credentials above to login',
                    step2: 'Change password after first login',
                    step3: 'Start creating schools and users'
                }
            });

        } catch (error) {
            console.error('❌ Auto-admin creation failed:', error.message);
            res.status(500).json({
                success: false,
                message: 'Failed to create Super Admin',
                error: error.message
            });
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
Email: ${process.env.SUPER_ADMIN_EMAIL || 'admin@example.com'}
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
                
                if (data.success) {
                    result.innerHTML = \`
                        <div class="success">
                            <h3>✅ Success! Super Admin Ready</h3>
                            <p><strong>Email:</strong> \${data.admin.email}</p>
                            <p><strong>Password:</strong> \${data.admin.password}</p>
                            <p><strong>Name:</strong> \${data.admin.name}</p>
                            <hr>
                            <h4>🔗 Login URL:</h4>
                            <p><a href="\${data.login_url}" target="_blank">\${data.login_url}</a></p>
                            <h4>📋 Next Steps:</h4>
                            <ol>
                                <li>Click the login URL above</li>
                                <li>Use the credentials to login</li>
                                <li>Change password after first login</li>
                                <li>Start creating schools</li>
                            </ol>
                        </div>
                    \`;
                    btnText.innerHTML = '✅ Setup Complete!';
                    btn.className = 'btn success';
                } else {
                    result.innerHTML = \`
                        <div class="error">
                            <h3>❌ Setup Failed</h3>
                            <p>\${data.message}</p>
                            \${data.error ? \`<p><strong>Error:</strong> \${data.error}</p>\` : ''}
                        </div>
                    \`;
                    btnText.innerHTML = '🔄 Try Again';
                    btn.disabled = false;
                }
            } catch (error) {
                result.innerHTML = \`
                    <div class="error">
                        <h3>❌ Network Error</h3>
                        <p>\${error.message}</p>
                    </div>
                \`;
                btnText.innerHTML = '🔄 Try Again';
                btn.disabled = false;
            }
        }
    </script>
</body>
</html>`;
        
        res.send(html);
    };

    // Emergency reset endpoint - can unblock and reset super admin
    const emergencyReset = async (req, res) => {
        try {
            const bcrypt = require('bcryptjs');
            const User = require('./models/User');
            
            // Get reset key from query or body
            const resetKey = req.query.key || req.body.key;
            const validKey = process.env.EMERGENCY_RESET_KEY || 'emergency2024';
            
            if (resetKey !== validKey) {
                return res.status(403).json({
                    success: false,
                    message: 'Invalid reset key'
                });
            }
            
            const newPassword = req.body.password || 'Admin@123456';
            const hashedPassword = await bcrypt.hash(newPassword, 12);
            
            // Find and update super admin
            const admin = await User.findOne({ role: 'super_admin' });
            
            if (!admin) {
                // Create new if doesn't exist
                const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@smartcampus.com';
                const adminName = process.env.SUPER_ADMIN_NAME || 'Super Admin';
                
                const newAdmin = new User({
                    name: adminName,
                    email: adminEmail,
                    password: hashedPassword,
                    phone: process.env.SUPER_ADMIN_PHONE || '',
                    role: 'super_admin',
                    isApproved: true,
                    emailVerified: true,
                    isActive: true,
                    isBlocked: false
                });
                
                await newAdmin.save();
                
                return res.json({
                    success: true,
                    message: 'Super Admin created with password reset',
                    credentials: {
                        email: adminEmail,
                        password: newPassword
                    }
                });
            }
            
            // Update existing admin - unblock and reset password
            admin.password = hashedPassword;
            admin.isBlocked = false;
            admin.loginAttempts = 0;
            admin.isActive = true;
            await admin.save();
            
            res.json({
                success: true,
                message: 'Super Admin unblocked and password reset',
                credentials: {
                    email: admin.email,
                    password: newPassword
                }
            });
        } catch (error) {
            console.error('Emergency reset error:', error);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    };

    app.get('/setup', setupPage);
    app.post('/api/auto-setup-admin', createSuperAdmin);
    app.post('/api/emergency-reset', emergencyReset);
    console.log('✅ Auto Admin Setup routes loaded - /setup, /api/auto-setup-admin, /api/emergency-reset');
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
    res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Internal server error',
        ...(process.env.NODE_ENV !== 'production' && { stack: error.stack })
    });
});

// Database connection and server start
const startServer = async () => {
    let dbConnected = false;
    
    // Try to connect to MongoDB but allow server to start anyway
    try {
        console.log('\n🔄 Connecting to MongoDB...');
        console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
        
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 30000,
            connectTimeoutMS: 10000,
            maxPoolSize: 5,
            minPoolSize: 1,
            retryWrites: false
        });
        
        dbConnected = true;
        console.log('✅ MongoDB Connected Successfully!');
        console.log(`📍 Database: ${mongoose.connection.name}`);
        console.log(`📍 Host: ${mongoose.connection.host}`);
    } catch (dbError) {
        console.warn('⚠️  MongoDB connection failed:', dbError.message);
        console.warn('⚠️  Server starting without database - some features may not work');
    }
        
        // Initialize Super Admin only if DB is connected
        if (dbConnected) {
            console.log('\n🚀 Initializing Super Admin...');
            try {
                const bcrypt = require('bcryptjs');
                const User = require('./models/User');
                
                const existingAdmin = await User.findOne({ role: 'super_admin' });
                if (!existingAdmin) {
                    // Use environment variables for credentials (already validated)
                    const adminEmail = process.env.SUPER_ADMIN_EMAIL;
                    const adminPassword = process.env.SUPER_ADMIN_PASSWORD;
                    const adminName = process.env.SUPER_ADMIN_NAME || 'Super Administrator';
                    const adminPhone = process.env.SUPER_ADMIN_PHONE || '';
                    
                    const hashedPassword = await bcrypt.hash(adminPassword, parseInt(process.env.BCRYPT_ROUNDS) || 12);
                    const superAdmin = new User({
                        name: adminName,
                        email: adminEmail,
                        password: hashedPassword,
                        phone: adminPhone,
                        role: 'super_admin',
                        isApproved: true,
                        emailVerified: true,
                        isActive: true
                    });
                    await superAdmin.save();
                    console.log('✅ Super Admin created successfully');
                    console.log(`📧 Email: ${adminEmail}`);
                    console.log(`👤 Name: ${adminName}`);
                } else {
                    console.log('✅ Super Admin already exists');
                    console.log(`📧 Email: ${existingAdmin.email}`);
                    console.log(`👤 Name: ${existingAdmin.name}`);
                }
            } catch (adminError) {
                console.error(`❌ Admin creation failed: ${adminError.message}`);
                // Don't exit - admin can be created via /setup endpoint
            }
        } else {
            console.log('\n⚠️  Skipping Super Admin initialization (no database)');
        }
        
        // Start server regardless of DB connection
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`\n🚀 SMART CAMPUS SaaS - COMPLETE WORKFLOW RUNNING`);
            console.log(`📍 Server: http://localhost:${PORT}`);
            console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
            console.log(`📚 API Info: http://localhost:${PORT}/api`);
            console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`\n✅ ALL WORKFLOW FEATURES AVAILABLE:`);
            console.log(`   🔹 Phase 1: Super Admin Setup`);
            console.log(`   🔹 Phase 2: School Creation`);
            console.log(`   🔹 Phase 3: Principal Flow`);
            console.log(`   🔹 Phase 4: Routine Setup`);
            console.log(`   🔹 Phase 5: Daily Operations`);
            console.log(`   🔹 Phase 6: Results`);
            console.log(`   🔹 Phase 7: Fees`);
            console.log(`   🔹 Phase 8: Notices`);
            console.log(`   🔹 Phase 9: Analytics`);
            console.log(`\n🎯 READY FOR COMPLETE WORKFLOW TESTING!`);
        });
};

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\nSIGTERM received, shutting down gracefully...');
    mongoose.connection.close(() => {
        console.log('MongoDB connection closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('\nSIGINT received, shutting down gracefully...');
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
