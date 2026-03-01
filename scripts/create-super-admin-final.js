#!/usr/bin/env node

/**
 * 🚀 FINAL SUPER ADMIN CREATION WITH YOUR MONGODB
 * Using your exact connection string
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Your exact MongoDB connection string
const MONGO_URI = 'mongodb+srv://Alamin:alamin45ab@cluster0.qht4rx6.mongodb.net/smartcampus?retryWrites=true&w=majority';

// Super admin credentials
const SUPER_ADMIN_CREDENTIALS = {
    name: 'Super Admin',
    email: 'superadmin@smartcampus.com',
    password: 'SuperAdmin123!',
    role: 'super_admin',
    isApproved: true,
    emailVerified: true,
    isActive: true
};

async function createSuperAdmin() {
    try {
        console.log('🔄 Connecting to your MongoDB database...');
        console.log(`📍 Database: smartcampus`);
        
        // Connect with minimal options to avoid deprecated warnings
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 15000,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 15000,
        });
        
        console.log('✅ Connected to MongoDB successfully!');
        console.log(`🗄️  Database: ${mongoose.connection.name}`);

        // Check if super admin already exists
        console.log('🔍 Checking for existing super admin...');
        const existingSuperAdmin = await User.findOne({ role: 'super_admin' });

        if (existingSuperAdmin) {
            console.log('📋 Found existing super admin:');
            console.log(`   Email: ${existingSuperAdmin.email}`);
            console.log(`   Name: ${existingSuperAdmin.name}`);
            console.log(`   ID: ${existingSuperAdmin._id}`);
            console.log(`   Created: ${existingSuperAdmin.createdAt}`);
            
            // Update to ensure correct credentials
            console.log('🔄 Updating super admin credentials...');
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash(SUPER_ADMIN_CREDENTIALS.password, salt);
            
            await User.updateOne(
                { _id: existingSuperAdmin._id },
                { 
                    password: hashedPassword,
                    passwordChangedAt: new Date(),
                    isActive: true,
                    isApproved: true,
                    emailVerified: true,
                    name: SUPER_ADMIN_CREDENTIALS.name
                }
            );
            
            console.log('✅ Super admin updated successfully!');
        } else {
            // Create new super admin
            console.log('👤 Creating new super admin...');
            
            const superAdmin = new User(SUPER_ADMIN_CREDENTIALS);
            await superAdmin.save();

            console.log('✅ Super admin created successfully!');
            console.log(`   ID: ${superAdmin._id}`);
            console.log(`   Created: ${superAdmin.createdAt}`);
        }

        // Verify the super admin was created/updated
        console.log('\n🧪 Verifying super admin...');
        const verifyAdmin = await User.findOne({ 
            email: SUPER_ADMIN_CREDENTIALS.email,
            role: 'super_admin'
        }).select('+password');

        if (verifyAdmin) {
            const isValid = await verifyAdmin.comparePassword(SUPER_ADMIN_CREDENTIALS.password);
            console.log(`✅ Password verification: ${isValid ? 'PASSED' : 'FAILED'}`);
            
            if (isValid) {
                console.log('\n🎉 SUPER ADMIN SETUP COMPLETE!');
                console.log('================================');
                console.log(`📧 Email: ${SUPER_ADMIN_CREDENTIALS.email}`);
                console.log(`🔑 Password: ${SUPER_ADMIN_CREDENTIALS.password}`);
                console.log(`👤 Name: ${SUPER_ADMIN_CREDENTIALS.name}`);
                console.log(`🎭 Role: ${SUPER_ADMIN_CREDENTIALS.role}`);
                console.log(`🆔 User ID: ${verifyAdmin._id}`);
                console.log('================================');
                console.log('\n🌐 LOGIN INFORMATION:');
                console.log(`🔗 API Base: https://smart-campas-backend.onrender.com`);
                console.log(`📡 Login API: https://smart-campas-backend.onrender.com/api/auth/login`);
                console.log(`🏥 Health Check: https://smart-campas-backend.onrender.com/api/health`);
                console.log('\n⚠️  SECURITY REMINDERS:');
                console.log('- Change password after first login');
                console.log('- Enable two-factor authentication');
                console.log('- Never share these credentials');
                console.log('- Use HTTPS in production');
                
                // Test login endpoint format
                console.log('\n📝 TEST LOGIN COMMAND:');
                console.log('curl -X POST https://smart-campas-backend.onrender.com/api/auth/login \\');
                console.log('  -H "Content-Type: application/json" \\');
                console.log('  -d \'{"email":"superadmin@smartcampus.com","password":"SuperAdmin123!"}\'');
            }
        } else {
            console.log('❌ Verification failed - super admin not found');
        }

        // Show all users in database for verification
        console.log('\n📊 Database Summary:');
        const totalUsers = await User.countDocuments();
        const adminUsers = await User.countDocuments({ role: 'super_admin' });
        console.log(`👥 Total Users: ${totalUsers}`);
        console.log(`👑 Super Admins: ${adminUsers}`);
        
        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        console.log('🚀 Super admin is ready for use!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        
        if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
            console.log('\n🔧 CONNECTION TROUBLESHOOTING:');
            console.log('1. Check internet connection');
            console.log('2. Verify MongoDB Atlas is accessible');
            console.log('3. Check IP whitelist in MongoDB Atlas');
            console.log('4. Verify username and password');
            console.log('5. Try accessing MongoDB Atlas directly');
        }
        
        process.exit(1);
    }
}

// Run the script
console.log('🚀 Starting Super Admin Creation Process...');
console.log('📡 Using MongoDB Atlas connection');
createSuperAdmin();
