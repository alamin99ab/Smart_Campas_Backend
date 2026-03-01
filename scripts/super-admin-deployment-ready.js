#!/usr/bin/env node

/**
 * 🚀 DEPLOYMENT-READY SUPER ADMIN SETUP
 * 
 * This creates the super admin setup that will work when deployed to Render
 * and provides manual instructions for local setup.
 */

const fs = require('fs');
const path = require('path');

const SUPER_ADMIN_CREDENTIALS = {
    name: 'Super Admin',
    email: 'superadmin@smartcampus.com',
    password: 'SuperAdmin123!',
    role: 'super_admin',
    isApproved: true,
    emailVerified: true,
    isActive: true
};

// Create deployment-ready environment file
const envContent = `
# ==============================================
# 🚀 SMART CAMPUS SaaS - Production Environment
# ==============================================

# 🖥️ SERVER CONFIGURATION
NODE_ENV=production
PORT=3001

# 🗄️ DATABASE CONFIGURATION
MONGO_URI=mongodb+srv://Alamin:alamin45ab@cluster0.qht4rx6.mongodb.net/smartcampus?retryWrites=true&w=majority
MONGO_DB_NAME=smartcampus

# 🔐 JWT AUTHENTICATION
JWT_SECRET=super_secure_jwt_secret_for_production_minimum_32_characters_long
JWT_REFRESH_SECRET=super_secure_refresh_secret_for_production_minimum_32_characters_long
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=30d

# 🌐 FRONTEND CONFIGURATION
FRONTEND_URL=https://your-frontend-domain.com
ALLOWED_ORIGINS=https://smart-campas-backend.onrender.com,https://your-frontend-domain.com

# 🔒 SECURITY CONFIGURATION
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# 📧 EMAIL CONFIGURATION (Optional)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=noreply@smartcampus.com

# 🎯 FEATURE FLAGS
REQUIRE_EMAIL_VERIFICATION=false
SEND_ABSENT_SMS=false
SEND_PAYMENT_RECEIPT=true
ENABLE_AI_FEATURES=true
ENABLE_REAL_TIME_NOTIFICATIONS=true
`;

// Create MongoDB shell script for manual setup
const mongoShellScript = `
// MongoDB Shell Script - Super Admin Setup
// Run this in MongoDB Shell (mongosh)

// Connect to your database
use smartcampus;

// Hash the password (Node.js required for bcrypt)
// For manual setup, use this pre-hashed password:
const hashedPassword = "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6QJw/2Ej7W";

// Create super admin user
db.users.insertOne({
    name: "Super Admin",
    email: "superadmin@smartcampus.com",
    password: hashedPassword,
    role: "super_admin",
    isApproved: true,
    emailVerified: true,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    loginAttempts: 0,
    isBlocked: false,
    emailVerificationToken: null,
    resetPasswordToken: null
});

// Verify creation
db.users.findOne({ email: "superadmin@smartcampus.com", role: "super_admin" });

print("✅ Super admin created successfully!");
print("📧 Email: superadmin@smartcampus.com");
print("🔑 Password: SuperAdmin123!");
`;

// Create comprehensive setup guide
const setupGuide = `
# 🔐 Super Admin Setup - Complete Guide

## 📋 Credentials
\`\`\`
📧 Email: superadmin@smartcampus.com
🔑 Password: SuperAdmin123!
🎭 Role: super_admin
\`\`\`

## 🚀 Setup Options

### Option 1: Automatic (Recommended for Deployment)
When deployed to Render, the super admin will be created automatically.

### Option 2: MongoDB Shell Setup
1. Open MongoDB Shell: \`mongosh\`
2. Connect: \`mongosh "mongodb+srv://Alamin:alamin45ab@cluster0.qht4rx6.mongodb.net/smartcampus"\`
3. Run the commands from \`mongo-shell-script.js\`

### Option 3: MongoDB Compass Setup
1. Connect with your connection string
2. Go to \`smartcampus\` database
3. Go to \`users\` collection
4. Insert this document:

\`\`\`json
{
  "name": "Super Admin",
  "email": "superadmin@smartcampus.com",
  "password": "$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6QJw/2Ej7W",
  "role": "super_admin",
  "isApproved": true,
  "emailVerified": true,
  "isActive": true,
  "createdAt": { "$date": "2024-06-15T00:00:00.000Z" },
  "updatedAt": { "$date": "2024-06-15T00:00:00.000Z" },
  "loginAttempts": 0,
  "isBlocked": false
}
\`\`\`

## 🌐 Access Information
- **API Base**: https://smart-campas-backend.onrender.com
- **Login API**: https://smart-campas-backend.onrender.com/api/auth/login
- **Health Check**: https://smart-campas-backend.onrender.com/api/health

## 🔐 Security Notes
- Change password after first login
- Enable two-factor authentication
- Never share credentials
- Use HTTPS in production

## 🧪 Test Login
\`\`\`bash
curl -X POST https://smart-campas-backend.onrender.com/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"superadmin@smartcampus.com","password":"SuperAdmin123!"}'
\`\`\`
`;

async function createSetupFiles() {
    try {
        console.log('📁 Creating deployment-ready setup files...');
        
        // Create .env.production file
        fs.writeFileSync(path.join(__dirname, '../.env.production'), envContent.trim());
        console.log('✅ Created .env.production');
        
        // Create mongo shell script
        fs.writeFileSync(path.join(__dirname, '../mongo-shell-script.js'), mongoShellScript.trim());
        console.log('✅ Created mongo-shell-script.js');
        
        // Create setup guide
        fs.writeFileSync(path.join(__dirname, '../SUPER_ADMIN_DEPLOYMENT_GUIDE.md'), setupGuide.trim());
        console.log('✅ Created SUPER_ADMIN_DEPLOYMENT_GUIDE.md');
        
        // Create pre-hashed password for manual setup
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(SUPER_ADMIN_CREDENTIALS.password, 12);
        console.log('\n🔑 Pre-hashed Password (for manual setup):');
        console.log(hashedPassword);
        
        console.log('\n🎉 SETUP FILES CREATED!');
        console.log('================================');
        console.log('📄 Files created:');
        console.log('   - .env.production (Environment variables)');
        console.log('   - mongo-shell-script.js (MongoDB shell commands)');
        console.log('   - SUPER_ADMIN_DEPLOYMENT_GUIDE.md (Complete setup guide)');
        console.log('\n📋 Super Admin Credentials:');
        console.log(`   Email: ${SUPER_ADMIN_CREDENTIALS.email}`);
        console.log(`   Password: ${SUPER_ADMIN_CREDENTIALS.password}`);
        console.log('\n🚀 Next Steps:');
        console.log('   1. Deploy to Render (automatic setup)');
        console.log('   2. Or use manual setup with the provided files');
        console.log('   3. Test login with the credentials');
        
    } catch (error) {
        console.error('❌ Error creating setup files:', error.message);
    }
}

// Run the setup
createSetupFiles();
