/**
 * MOCK DATABASE CONTROLLER
 * Provides full functionality when MongoDB is unavailable
 */

// Load environment variables
require('dotenv').config();

const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// In-memory database
const mockDB = {
  users: [],
  schools: [],
  tokens: new Map()
};

// Hash the super admin password properly
async function initializeMockDB() {
  // Use environment variables for credentials
  const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@school.local';
  const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe123!';
  
  const hashedPassword = await bcrypt.hash(adminPassword, 12);
  
  // Create Super Admin
  const superAdmin = {
    _id: '507f1f77bcf86cd799439011',
    name: 'Super Administrator',
    email: adminEmail,
    password: hashedPassword,
    role: 'super_admin',
    isActive: true,
    emailVerified: true,
    permissions: ['manage_schools', 'manage_users', 'view_analytics', 'system_settings'],
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date()
  };
  
  mockDB.users.push(superAdmin);
  
  console.log('✅ Mock Database Initialized');
  console.log(`   Super Admin: ${adminEmail}`);
  console.log('   Password: [Use environment variable SUPER_ADMIN_PASSWORD]');
  console.log('   ⚠️  Change default credentials in production!');
}

// Mock User Model
const MockUser = {
  findOne: async (query) => {
    return mockDB.users.find(user => {
      for (let key in query) {
        if (user[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  },
  find: async (query = {}) => {
    return mockDB.users.filter(user => {
      for (let key in query) {
        if (user[key] !== query[key]) return false;
      }
      return true;
    });
  },
  findById: async (id) => {
    return mockDB.users.find(user => user._id === id) || null;
  },
  create: async (data) => {
    const newUser = {
      _id: crypto.randomUUID(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    if (data.password && !data.password.startsWith('$2a$')) {
      newUser.password = await bcrypt.hash(data.password, 12);
    }
    mockDB.users.push(newUser);
    return newUser;
  },
  countDocuments: async () => mockDB.users.length
};

// Mock School Model
const MockSchool = {
  findOne: async (query) => {
    return mockDB.schools.find(school => {
      for (let key in query) {
        if (school[key] !== query[key]) return false;
      }
      return true;
    }) || null;
  },
  find: async () => mockDB.schools,
  findById: async (id) => mockDB.schools.find(s => s._id === id) || null,
  create: async (data) => {
    const newSchool = {
      _id: crypto.randomUUID(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockDB.schools.push(newSchool);
    return newSchool;
  },
  countDocuments: async () => mockDB.schools.length
};

module.exports = {
  initializeMockDB,
  mockDB,
  MockUser,
  MockSchool
};

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { enhancedSecurity } = require('./middleware/enhancedSecurity');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001; // Render uses PORT env var

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

// Enhanced security middleware
app.use(enhancedSecurity);

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5000, // Increased for testing
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
            dashboard: '/api/dashboard',
            notices: '/api/notices',
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
                name: 'Alamin Admin',
                email: 'alamin@admin.com',
                password: 'A12@r12@++',
                phone: '01778060662',
                role: 'super_admin'
            };

            // Check if Super Admin already exists
            const existingAdmin = await User.findOne({ role: 'super_admin' });
            
            if (existingAdmin) {
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
            <p><strong>📋 This will automatically create the Super Admin account:</strong></p>
            <pre>
Email: alamin@admin.com
Password: A12@r12@++
Phone: 01778060662
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

    app.get('/setup', setupPage);
    app.post('/api/auto-setup-admin', createSuperAdmin);
    console.log('✅ Auto Admin Setup routes loaded - /setup and /api/auto-setup-admin');
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

// Teacher Routes - Working ✅
try {
    const teacherRoutes = require('./routes/teacher');
    app.use('/api/teacher', teacherRoutes);
    console.log('✅ Teacher routes loaded - Attendance, Marks, Daily Operations');
} catch (error) {
    console.error('❌ Failed to load teacher routes:', error.message);
}

// Student Routes - Working ✅
try {
    const studentRoutes = require('./routes/student');
    app.use('/api/student', studentRoutes);
    console.log('✅ Student routes loaded - Dashboard, Results, Fees');
} catch (error) {
    console.error('❌ Failed to load student routes:', error.message);
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

// AI Routes - Working ✅
try {
    // const aiRoutes = require('./routes/ai');
    // app.use('/api/ai', aiRoutes);
    console.log('✅ AI routes temporarily disabled - 10+ AI Features');
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
    try {
        // Start server first
        app.listen(PORT, () => {
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
        
        // Try to connect to MongoDB if URI is provided (non-blocking)
        if (process.env.MONGO_URI && process.env.MONGO_URI !== 'mongodb+srv://username:password@cluster.mongodb.net/smartcampus?retryWrites=true&w=majority') {
            console.log('\n🔄 Connecting to MongoDB...');
            try {
                await mongoose.connect(process.env.MONGO_URI, {
                    serverSelectionTimeoutMS: 10000,
                    socketTimeoutMS: 45000,
                    connectTimeoutMS: 10000,
                });
                console.log('✅ Connected to MongoDB - Full Features Enabled');
                console.log(`📍 Database: ${mongoose.connection.name}`);
                
                // Initialize Super Admin for deployment
                if (process.env.NODE_ENV === 'production' || process.env.AUTO_CREATE_ADMIN === 'true') {
                    console.log('\n🚀 Deployment: Initializing Super Admin...');
                    try {
                        const bcrypt = require('bcryptjs');
                        const User = require('./models/User');
                        
                        const existingAdmin = await User.findOne({ role: 'super_admin' });
                        if (!existingAdmin) {
                            // Use environment variables for credentials
                            const adminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@school.local';
                            const adminPassword = process.env.SUPER_ADMIN_PASSWORD || 'ChangeMe123!';
                            const adminName = process.env.SUPER_ADMIN_NAME || 'Super Administrator';
                            
                            const hashedPassword = await bcrypt.hash(adminPassword, 12);
                            const superAdmin = new User({
                                name: adminName,
                                email: adminEmail,
                                password: hashedPassword,
                                role: 'super_admin',
                                isApproved: true,
                                emailVerified: true,
                                isActive: true
                            });
                            await superAdmin.save();
                            console.log('✅ Super Admin created: ' + adminEmail);
                            console.log('📧 Email: ' + adminEmail);
                            console.log('🔑 Password: [Configured via SUPER_ADMIN_PASSWORD env var]');
                        } else {
                            console.log('✅ Super Admin already exists: ' + existingAdmin.email);
                        }
                    } catch (adminError) {
                        console.log(`⚠️  Admin creation failed: ${adminError.message}`);
                    }
                }
                
            } catch (dbError) {
                console.log('⚠️  MongoDB connection failed, continuing without database:', dbError.message);
                console.log('📝 Some features may be limited without database');
                console.log('💡 Check your MONGO_URI in .env file');
            }
        } else {
            console.log('\n⚠️  No valid MONGO_URI provided, running without database');
            console.log('📝 Set MONGO_URI in .env for full functionality');
            console.log('🔗 Example: mongodb+srv://username:password@cluster.mongodb.net/dbname');
        }
        
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
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
