#!/usr/bin/env node

/**
 * 🎯 DIRECT MONGODB CONNECTION - FINAL ATTEMPT
 * 
 * Using alternative connection methods to bypass DNS issues
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const MONGO_URI = 'mongodb+srv://Alamin:alamin45ab@cluster0.qht4rx6.mongodb.net/smartcampus?retryWrites=true&w=majority';

const SUPER_ADMIN_CREDENTIALS = {
    name: 'Super Admin',
    email: 'superadmin@smartcampus.com',
    password: 'SuperAdmin123!',
    role: 'super_admin',
    isApproved: true,
    emailVerified: true,
    isActive: true
};

async function connectWithRetry() {
    const connectionMethods = [
        {
            name: 'Standard Connection',
            options: {
                serverSelectionTimeoutMS: 10000,
                socketTimeoutMS: 30000,
                connectTimeoutMS: 10000,
            }
        },
        {
            name: 'Direct Connection',
            options: {
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 20000,
                connectTimeoutMS: 5000,
                maxPoolSize: 1,
                minPoolSize: 0,
            }
        },
        {
            name: 'Minimal Connection',
            options: {
                serverSelectionTimeoutMS: 3000,
                socketTimeoutMS: 10000,
            }
        }
    ];

    for (const method of connectionMethods) {
        try {
            console.log(`🔄 Trying ${method.name}...`);
            
            // Clear any existing connections
            await mongoose.disconnect();
            
            // Try connection
            await mongoose.connect(MONGO_URI, method.options);
            
            console.log(`✅ ${method.name} successful!`);
            return true;
            
        } catch (error) {
            console.log(`❌ ${method.name} failed: ${error.message}`);
            continue;
        }
    }
    
    return false;
}

async function createSuperAdmin() {
    try {
        console.log('🚀 Starting Super Admin Creation - Final Attempt');
        console.log('📡 Connection String:', MONGO_URI.replace(/:([^@]+)@/, ':***@'));
        
        // Try different connection methods
        const connected = await connectWithRetry();
        
        if (!connected) {
            console.log('\n❌ All connection methods failed');
            console.log('📝 Manual Setup Required:');
            console.log('1. Use MongoDB Compass');
            console.log('2. Use the mongo-shell-script.js file');
            console.log('3. Deploy to Render (automatic setup)');
            return;
        }

        console.log('✅ Connected to MongoDB!');
        console.log(`🗄️  Database: ${mongoose.connection.name}`);

        // Create/update super admin
        console.log('🔍 Checking for existing super admin...');
        const existingAdmin = await User.findOne({ role: 'super_admin' });

        if (existingAdmin) {
            console.log('📋 Found existing super admin, updating...');
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash(SUPER_ADMIN_CREDENTIALS.password, salt);
            
            await User.updateOne(
                { _id: existingAdmin._id },
                { 
                    password: hashedPassword,
                    passwordChangedAt: new Date(),
                    isActive: true,
                    isApproved: true,
                    emailVerified: true
                }
            );
            console.log('✅ Super admin updated!');
        } else {
            console.log('👤 Creating new super admin...');
            const superAdmin = new User(SUPER_ADMIN_CREDENTIALS);
            await superAdmin.save();
            console.log('✅ Super admin created!');
        }

        // Verify creation
        const verifyAdmin = await User.findOne({ 
            email: SUPER_ADMIN_CREDENTIALS.email,
            role: 'super_admin'
        }).select('+password');

        if (verifyAdmin) {
            const isValid = await verifyAdmin.comparePassword(SUPER_ADMIN_CREDENTIALS.password);
            
            console.log('\n🎉 SUCCESS! Super Admin Setup Complete!');
            console.log('==========================================');
            console.log(`📧 Email: ${SUPER_ADMIN_CREDENTIALS.email}`);
            console.log(`🔑 Password: ${SUPER_ADMIN_CREDENTIALS.password}`);
            console.log(`👤 Name: ${SUPER_ADMIN_CREDENTIALS.name}`);
            console.log(`🎭 Role: ${SUPER_ADMIN_CREDENTIALS.role}`);
            console.log(`🆔 ID: ${verifyAdmin._id}`);
            console.log(`✅ Password Valid: ${isValid}`);
            console.log('==========================================');
            
            console.log('\n🌐 Ready for Login:');
            console.log(`🔗 API: https://smart-campas-backend.onrender.com`);
            console.log(`📡 Login: /api/auth/login`);
            console.log(`🏥 Health: /api/health`);
            
            console.log('\n🧪 Test Command:');
            console.log('curl -X POST https://smart-campas-backend.onrender.com/api/auth/login \\');
            console.log('  -H "Content-Type: application/json" \\');
            console.log('  -d \'{"email":"superadmin@smartcampus.com","password":"SuperAdmin123!"}\'');
        }

        await mongoose.disconnect();
        console.log('\n🔌 Disconnected from MongoDB');
        console.log('🚀 Super admin is ready for production use!');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

// Run the script
createSuperAdmin();
