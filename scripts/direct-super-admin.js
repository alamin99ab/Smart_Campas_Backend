#!/usr/bin/env node

/**
 * 🎯 DIRECT SUPER ADMIN CREATION
 * 
 * Alternative method using direct MongoDB connection options
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// MongoDB connection with direct options
const MONGO_URI = 'mongodb+srv://Alamin:alamin45ab@cluster0.qht4rx6.mongodb.net/smartcampus?retryWrites=true&w=majority';

const connectionOptions = {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    connectTimeoutMS: 10000,
    maxPoolSize: 10,
    minPoolSize: 1,
    maxIdleTimeMS: 30000,
};

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
        console.log('🔄 Attempting to connect to MongoDB...');
        
        // Try different connection methods
        let connected = false;
        
        try {
            await mongoose.connect(MONGO_URI, connectionOptions);
            connected = true;
        } catch (error1) {
            console.log('⚠️  Primary connection failed, trying alternative...');
            try {
                // Alternative connection string
                const altUri = 'mongodb+srv://Alamin:alamin45ab@cluster0.qht4rx6.mongodb.net/smartcampus';
                await mongoose.connect(altUri, {
                    ...connectionOptions,
                    retryWrites: false,
                    w: 'majority'
                });
                connected = true;
            } catch (error2) {
                console.log('⚠️  Alternative connection failed, trying direct connection...');
                try {
                    // Direct connection without options
                    await mongoose.connect(MONGO_URI);
                    connected = true;
                } catch (error3) {
                    throw new Error('All connection methods failed');
                }
            }
        }

        if (connected) {
            console.log('✅ Connected to MongoDB successfully!');
        }

        // Check database connection
        const db = mongoose.connection.db;
        console.log(`📊 Connected to database: ${db.databaseName}`);

        // Check if super admin exists
        console.log('🔍 Checking for existing super admin...');
        const existingSuperAdmin = await User.findOne({ role: 'super_admin' });

        if (existingSuperAdmin) {
            console.log('📋 Found existing super admin:');
            console.log(`   Email: ${existingSuperAdmin.email}`);
            console.log(`   Name: ${existingSuperAdmin.name}`);
            console.log(`   ID: ${existingSuperAdmin._id}`);
            
            // Update to ensure proper credentials
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
        }

        // Verify creation
        console.log('\n🧪 Verifying super admin...');
        const verifyAdmin = await User.findOne({ 
            email: SUPER_ADMIN_CREDENTIALS.email,
            role: 'super_admin'
        }).select('+password');

        if (verifyAdmin) {
            const isValid = await verifyAdmin.comparePassword(SUPER_ADMIN_CREDENTIALS.password);
            console.log(`✅ Verification ${isValid ? 'PASSED' : 'FAILED'}`);
        }

        // Display final credentials
        console.log('\n🎉 SUPER ADMIN SETUP COMPLETE!');
        console.log('================================');
        console.log(`📧 Email: ${SUPER_ADMIN_CREDENTIALS.email}`);
        console.log(`🔑 Password: ${SUPER_ADMIN_CREDENTIALS.password}`);
        console.log(`👤 Name: ${SUPER_ADMIN_CREDENTIALS.name}`);
        console.log(`🎭 Role: ${SUPER_ADMIN_CREDENTIALS.role}`);
        console.log('================================');
        console.log('\n🌐 LOGIN INFORMATION:');
        console.log(`URL: https://smart-campas-backend.onrender.com`);
        console.log(`API: https://smart-campas-backend.onrender.com/api/auth/login`);
        console.log('\n⚠️  SECURITY REMINDER:');
        console.log('- Change password after first login');
        console.log('- Enable two-factor authentication');
        console.log('- Never share these credentials');
        
        await mongoose.disconnect();
        console.log('\n🔌 Database connection closed');
        
    } catch (error) {
        console.error('❌ Error creating super admin:', error.message);
        console.log('\n🔧 TROUBLESHOOTING:');
        console.log('1. Check your internet connection');
        console.log('2. Verify MongoDB Atlas is accessible');
        console.log('3. Check if MongoDB credentials are correct');
        console.log('4. Ensure IP is whitelisted in MongoDB Atlas');
        process.exit(1);
    }
}

// Run the script
createSuperAdmin();
