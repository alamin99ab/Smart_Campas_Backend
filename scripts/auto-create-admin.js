#!/usr/bin/env node

/**
 * 🚀 Auto Create Super Admin - Instant Setup Script
 * 
 * This script automatically creates a Super Admin user when run.
 * No prompts, no questions - just instant creation.
 * 
 * Usage: node scripts/auto-create-admin.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

// Super Admin Configuration
const SUPER_ADMIN = {
    name: 'Alamin Admin',
    email: 'alamin@admin.com',
    password: 'A12@r12@++',
    phone: '01778060662',
    role: 'super_admin'
};

async function autoCreateSuperAdmin() {
    console.log('🚀 Auto Creating Super Admin...');
    console.log('================================\n');

    try {
        // Connect to database
        console.log('📡 Connecting to database...');
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('✅ Database connected\n');

        // Check if super admin already exists
        console.log('🔍 Checking existing super admin...');
        const existingAdmin = await User.findOne({ role: 'super_admin' });
        
        if (existingAdmin) {
            console.log(`⚠️  Super Admin already exists: ${existingAdmin.email}`);
            
            // Delete existing and create new (auto-force)
            console.log('🔄 Removing existing admin...');
            await User.deleteOne({ _id: existingAdmin._id });
            console.log('✅ Existing admin removed\n');
        }

        // Hash password
        console.log('🔐 Securing password...');
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(SUPER_ADMIN.password, saltRounds);

        // Create super admin
        console.log('👤 Creating Super Admin account...');
        const superAdmin = new User({
            name: SUPER_ADMIN.name,
            email: SUPER_ADMIN.email,
            password: hashedPassword,
            role: SUPER_ADMIN.role,
            phone: SUPER_ADMIN.phone,
            isApproved: true,
            emailVerified: true,
            isActive: true,
            // Super admin has no schoolId, schoolCode, or schoolName
            schoolId: undefined,
            schoolCode: undefined,
            schoolName: undefined
        });

        await superAdmin.save();
        console.log('✅ Super Admin created successfully!\n');

        // Display credentials
        console.log('📋 Account Details:');
        console.log('==================');
        console.log(`👤 Name: ${superAdmin.name}`);
        console.log(`📧 Email: ${superAdmin.email}`);
        console.log(`📱 Phone: ${superAdmin.phone}`);
        console.log(`🔑 Role: ${superAdmin.role}`);
        console.log(`✅ Status: Active & Approved`);
        console.log('');

        console.log('🔑 Login Credentials:');
        console.log('====================');
        console.log(`📧 Email: ${SUPER_ADMIN.email}`);
        console.log(`🔒 Password: ${SUPER_ADMIN.password}`);
        console.log('');

        console.log('🌐 Access Information:');
        console.log('====================');
        console.log('🔗 Login URL: http://localhost:5024/api/auth/login');
        console.log('📱 Mobile API: http://localhost:5024/api/mobile/login');
        console.log('');

        console.log('🎯 Super Admin Features:');
        console.log('======================');
        console.log('✅ Platform-wide access');
        console.log('✅ School management');
        console.log('✅ User administration');
        console.log('✅ System configuration');
        console.log('✅ Analytics & reports');
        console.log('✅ Subscription management');
        console.log('');

        console.log('⚠️  SECURITY REMINDER:');
        console.log('====================');
        console.log('🔐 Change password after first login!');
        console.log('🛡️ Enable 2FA for enhanced security');
        console.log('📝 Keep credentials secure');
        console.log('');

        console.log('🎉 Auto Setup Complete!');
        console.log('=======================');
        console.log('✅ Super Admin is ready to use');
        console.log('🚀 Start managing your Smart Campus platform');

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        
        if (error.code === 11000) {
            console.log('💡 Solution: Email already exists in database');
            console.log('🔧 Try: node scripts/auto-create-admin.js --force');
        } else if (error.name === 'MongoNetworkError') {
            console.log('💡 Solution: Check database connection');
            console.log('🔧 Verify MONGO_URI in .env file');
        } else {
            console.log('💡 Check: Database connection and permissions');
        }
        
        process.exit(1);
    } finally {
        // Close database connection
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('\n🔌 Database connection closed');
        }
    }
}

// Handle command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log('🚀 Auto Create Super Admin Script');
    console.log('==================================');
    console.log('');
    console.log('📝 Description:');
    console.log('   Automatically creates a Super Admin user instantly');
    console.log('');
    console.log('🔧 Usage:');
    console.log('   node scripts/auto-create-admin.js');
    console.log('');
    console.log('⚡ Features:');
    console.log('   • Auto-connect to database');
    console.log('   • Auto-remove existing admin');
    console.log('   • Auto-create new admin');
    console.log('   • Auto-display credentials');
    console.log('   • No prompts or questions');
    console.log('');
    console.log('🔐 Default Credentials:');
    console.log(`   • Email: ${SUPER_ADMIN.email}`);
    console.log(`   • Password: ${SUPER_ADMIN.password}`);
    console.log(`   • Phone: ${SUPER_ADMIN.phone}`);
    console.log('');
    process.exit(0);
}

// Force mode handling
if (args.includes('--force') || args.includes('-f')) {
    console.log('🔥 FORCE MODE ENABLED');
    console.log('=====================\n');
}

// Auto-run the script
if (require.main === module) {
    autoCreateSuperAdmin();
}

module.exports = { autoCreateSuperAdmin };
