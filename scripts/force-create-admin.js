#!/usr/bin/env node

/**
 * 🔥 FORCE CREATE SUPER ADMIN - GUARANTEED TO WORK
 * 
 * This script will create a Super Admin user in the database.
 * It's designed to be foolproof and work in any environment.
 * 
 * Usage: node scripts/force-create-admin.js
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

console.log('🔥 FORCE CREATE SUPER ADMIN SCRIPT');
console.log('==================================');
console.log('');

async function forceCreateAdmin() {
    try {
        // Step 1: Connect to Database
        console.log('📡 Step 1: Connecting to database...');
        console.log(`   URI: ${process.env.MONGO_URI ? '✅ Found' : '❌ Missing'}`);
        
        if (!process.env.MONGO_URI) {
            console.log('❌ ERROR: MONGO_URI not found in .env file');
            console.log('');
            console.log('💡 SOLUTION:');
            console.log('1. Create .env file in root directory');
            console.log('2. Add: MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname');
            console.log('3. Run this script again');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
        });
        console.log('✅ Database connected successfully');

        // Step 2: Check Existing Admin
        console.log('');
        console.log('🔍 Step 2: Checking for existing Super Admin...');
        const existingAdmin = await User.findOne({ role: 'super_admin' });
        
        if (existingAdmin) {
            console.log(`⚠️  Found existing Super Admin: ${existingAdmin.email}`);
            console.log('🗑️  Deleting existing admin...');
            await User.deleteOne({ _id: existingAdmin._id });
            console.log('✅ Existing admin deleted');
        } else {
            console.log('✅ No existing Super Admin found');
        }

        // Step 3: Create New Admin
        console.log('');
        console.log('👤 Step 3: Creating new Super Admin...');
        console.log(`   Name: ${SUPER_ADMIN.name}`);
        console.log(`   Email: ${SUPER_ADMIN.email}`);
        console.log(`   Phone: ${SUPER_ADMIN.phone}`);
        console.log(`   Role: ${SUPER_ADMIN.role}`);

        // Hash password
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(SUPER_ADMIN.password, saltRounds);
        console.log('✅ Password hashed successfully');

        // Create user
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
        console.log('✅ Super Admin created successfully');

        // Step 4: Verification
        console.log('');
        console.log('✅ Step 4: Verification...');
        const verifyAdmin = await User.findOne({ email: SUPER_ADMIN.email });
        
        if (verifyAdmin) {
            console.log('✅ Super Admin verified in database');
            console.log(`   ID: ${verifyAdmin._id}`);
            console.log(`   Email: ${verifyAdmin.email}`);
            console.log(`   Role: ${verifyAdmin.role}`);
            console.log(`   Active: ${verifyAdmin.isActive}`);
            console.log(`   Approved: ${verifyAdmin.isApproved}`);
        } else {
            console.log('❌ Verification failed - admin not found');
            throw new Error('Admin creation verification failed');
        }

        // Step 5: Display Credentials
        console.log('');
        console.log('🎉 SUCCESS! Super Admin Created');
        console.log('===============================');
        console.log('');
        console.log('📋 LOGIN CREDENTIALS:');
        console.log(`   📧 Email: ${SUPER_ADMIN.email}`);
        console.log(`   🔑 Password: ${SUPER_ADMIN.password}`);
        console.log(`   📱 Phone: ${SUPER_ADMIN.phone}`);
        console.log('');
        console.log('🌐 LOGIN URL:');
        console.log('   Local: http://localhost:5024/api/auth/login');
        console.log('   Production: https://your-app.onrender.com/api/auth/login');
        console.log('');
        console.log('🔐 SECURITY NOTES:');
        console.log('   • Change password after first login');
        console.log('   • Enable 2FA if available');
        console.log('   • Keep credentials secure');
        console.log('');
        console.log('✅ Script completed successfully!');

    } catch (error) {
        console.log('');
        console.log('❌ ERROR OCCURRED:');
        console.log(`   Message: ${error.message}`);
        console.log(`   Code: ${error.code || 'N/A'}`);
        
        if (error.name === 'MongoNetworkError') {
            console.log('');
            console.log('💡 NETWORK ERROR SOLUTION:');
            console.log('1. Check internet connection');
            console.log('2. Verify MONGO_URI is correct');
            console.log('3. Check MongoDB Atlas IP whitelist');
        } else if (error.name === 'MongoServerError') {
            console.log('');
            console.log('💡 DATABASE ERROR SOLUTION:');
            console.log('1. Check database credentials');
            console.log('2. Verify database exists');
            console.log('3. Check user permissions');
        }
        
        process.exit(1);
    } finally {
        // Close database connection
        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            console.log('');
            console.log('🔌 Database connection closed');
        }
    }
}

// Run the script
if (require.main === module) {
    forceCreateAdmin();
}

module.exports = { forceCreateAdmin };
