#!/usr/bin/env node

/**
 * 🚀 Smart Campus SaaS - Add Super Admin Script
 * 
 * This script creates a super admin user in the database.
 * Super admin has platform-wide access and no schoolId.
 * 
 * Usage: node scripts/add-super-admin.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

// Custom super admin credentials
const DEFAULT_SUPER_ADMIN = {
    name: 'Alamin Admin',
    email: 'alamin@admin.com',
    password: 'A12@r12@++',
    phone: '01778060662',
    role: 'super_admin'
};

// Color codes for console output
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function connectDatabase() {
    try {
        log('🔌 Connecting to database...', 'cyan');
        
        const mongoUri = process.env.MONGO_URI;
        if (!mongoUri) {
            throw new Error('MONGO_URI not found in environment variables');
        }

        await mongoose.connect(mongoUri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        
        log('✅ Database connected successfully', 'green');
    } catch (error) {
        log(`❌ Database connection failed: ${error.message}`, 'red');
        process.exit(1);
    }
}

async function createSuperAdmin(userData) {
    try {
        // Check if super admin already exists
        log('🔍 Checking if super admin already exists...', 'yellow');
        
        const existingAdmin = await User.findOne({ 
            role: 'super_admin' 
        });

        if (existingAdmin) {
            log(`⚠️  Super admin already exists: ${existingAdmin.email}`, 'yellow');
            
            // Ask if user wants to update
            if (process.argv.includes('--force') || process.argv.includes('-f')) {
                log('🔄 Force update requested. Updating existing super admin...', 'yellow');
                await User.deleteOne({ _id: existingAdmin._id });
            } else {
                log('💡 Use --force flag to update existing super admin', 'cyan');
                log('📝 Example: node scripts/add-super-admin.js --force', 'cyan');
                return false;
            }
        }

        // Hash password
        log('🔐 Hashing password...', 'yellow');
        const saltRounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
        const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

        // Create super admin user
        log('👤 Creating super admin user...', 'yellow');
        
        const superAdmin = new User({
            name: userData.name,
            email: userData.email,
            password: hashedPassword,
            role: userData.role,
            phone: userData.phone,
            isApproved: true,
            emailVerified: true,
            isActive: true,
            // Super admin has no schoolId, schoolCode, or schoolName
            schoolId: undefined,
            schoolCode: undefined,
            schoolName: undefined
        });

        await superAdmin.save();

        log('✅ Super admin created successfully!', 'green');
        log('', 'reset');
        log('📋 Super Admin Details:', 'bright');
        log(`   Name: ${superAdmin.name}`, 'reset');
        log(`   Email: ${superAdmin.email}`, 'reset');
        log(`   Role: ${superAdmin.role}`, 'reset');
        log(`   Phone: ${superAdmin.phone}`, 'reset');
        log(`   Approved: ${superAdmin.isApproved}`, 'reset');
        log(`   Email Verified: ${superAdmin.emailVerified}`, 'reset');
        log(`   Active: ${superAdmin.isActive}`, 'reset');
        log('', 'reset');
        log('🔑 Login Credentials:', 'bright');
        log(`   Email: ${superAdmin.email}`, 'reset');
        log(`   Password: ${userData.password}`, 'reset');
        log('', 'reset');
        log('⚠️  IMPORTANT: Change the default password after first login!', 'yellow');
        log('🌐 You can now login at: http://localhost:5024/api/auth/login', 'cyan');

        return true;

    } catch (error) {
        if (error.code === 11000) {
            log(`❌ Email already exists: ${userData.email}`, 'red');
        } else {
            log(`❌ Error creating super admin: ${error.message}`, 'red');
        }
        return false;
    }
}

async function createMultipleSuperAdmins() {
    const adminList = [
        {
            name: 'Alamin Admin',
            email: 'alamin@admin.com',
            password: 'A12@r12@++',
            phone: '01778060662'
        },
        {
            name: 'Backup Admin',
            email: 'backup@smartcampus.com',
            password: 'Admin@123456',
            phone: '+1234567891'
        }
    ];

    log('👥 Creating multiple super admins...', 'cyan');
    
    for (const adminData of adminList) {
        const success = await createSuperAdmin({
            ...adminData,
            role: 'super_admin'
        });
        
        if (success) {
            log(`✅ Created: ${adminData.email}`, 'green');
        } else {
            log(`❌ Failed to create: ${adminData.email}`, 'red');
        }
        log('', 'reset');
    }
}

function showUsage() {
    log('🚀 Smart Campus SaaS - Add Super Admin Script', 'bright');
    log('', 'reset');
    log('Usage:', 'bright');
    log('  node scripts/add-super-admin.js [options]', 'reset');
    log('', 'reset');
    log('Options:', 'bright');
    log('  --help, -h      Show this help message', 'reset');
    log('  --force, -f     Force update existing super admin', 'reset');
    log('  --multiple, -m  Create multiple super admin accounts', 'reset');
    log('', 'reset');
    log('Examples:', 'bright');
    log('  node scripts/add-super-admin.js                    # Create default super admin', 'reset');
    log('  node scripts/add-super-admin.js --force           # Force update existing', 'reset');
    log('  node scripts/add-super-admin.js --multiple        # Create multiple admins', 'reset');
    log('', 'reset');
    log('Default Credentials:', 'bright');
    log('  Email: alamin@admin.com', 'reset');
    log('  Password: A12@r12@++', 'reset');
    log('  Phone: 01778060662', 'reset');
    log('', 'reset');
    log('⚠️  Remember to change the default password after first login!', 'yellow');
}

async function main() {
    log('🚀 Smart Campus SaaS - Add Super Admin Script', 'bright');
    log('================================================', 'reset');
    log('', 'reset');

    // Check for help flag
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        showUsage();
        return;
    }

    try {
        // Connect to database
        await connectDatabase();

        // Check if multiple flag is set
        if (process.argv.includes('--multiple') || process.argv.includes('-m')) {
            await createMultipleSuperAdmins();
        } else {
            // Create single super admin
            const success = await createSuperAdmin(DEFAULT_SUPER_ADMIN);
            
            if (!success) {
                log('\n❌ Failed to create super admin', 'red');
                process.exit(1);
            }
        }

        log('\n🎉 Script completed successfully!', 'green');
        
    } catch (error) {
        log(`\n💥 Script failed: ${error.message}`, 'red');
        process.exit(1);
    } finally {
        // Close database connection
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            log('🔌 Database connection closed', 'cyan');
        }
    }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    log(`❌ Unhandled Rejection at: ${promise}`, 'red');
    log(`❌ Reason: ${reason}`, 'red');
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    log(`❌ Uncaught Exception: ${error.message}`, 'red');
    process.exit(1);
});

// Run the script
if (require.main === module) {
    main();
}

module.exports = { createSuperAdmin, connectDatabase };
