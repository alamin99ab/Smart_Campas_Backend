#!/usr/bin/env node

/**
 * 🚀 CREATE SUPER ADMIN - IMMEDIATE SETUP
 * 
 * This script creates the super admin with your actual MongoDB connection.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Your actual MongoDB connection
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
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Check if super admin already exists
        console.log('🔍 Checking existing super admin...');
        const existingSuperAdmin = await User.findOne({ role: 'super_admin' });

        if (existingSuperAdmin) {
            console.log('⚠️  Super admin already exists:');
            console.log(`   Email: ${existingSuperAdmin.email}`);
            console.log(`   Name: ${existingSuperAdmin.name}`);
            console.log(`   ID: ${existingSuperAdmin._id}`);
            console.log(`   Created: ${existingSuperAdmin.createdAt}`);
            
            // Update password to ensure we have access
            console.log('🔄 Updating super admin password...');
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash(SUPER_ADMIN_CREDENTIALS.password, salt);
            
            await User.updateOne(
                { _id: existingSuperAdmin._id },
                { 
                    password: hashedPassword,
                    passwordChangedAt: new Date(),
                    isActive: true,
                    isApproved: true,
                    emailVerified: true
                }
            );
            
            console.log('✅ Super admin password updated!');
        } else {
            // Create new super admin
            console.log('👤 Creating new super admin...');
            
            const superAdmin = new User(SUPER_ADMIN_CREDENTIALS);
            await superAdmin.save();

            console.log('✅ Super admin created successfully!');
        }

        // Display credentials
        console.log('\n📋 SUPER ADMIN CREDENTIALS:');
        console.log('================================');
        console.log(`📧 Email: ${SUPER_ADMIN_CREDENTIALS.email}`);
        console.log(`🔑 Password: ${SUPER_ADMIN_CREDENTIALS.password}`);
        console.log(`👤 Name: ${SUPER_ADMIN_CREDENTIALS.name}`);
        console.log(`🎭 Role: ${SUPER_ADMIN_CREDENTIALS.role}`);
        console.log('================================');
        console.log('\n🌐 LOGIN URL: https://smart-campas-backend.onrender.com');
        console.log('🔐 Use these credentials to login as Super Admin');
        console.log('\n⚠️  IMPORTANT: Change password after first login!');
        
        // Test the credentials
        console.log('\n🧪 Testing login credentials...');
        const testUser = await User.findOne({ email: SUPER_ADMIN_CREDENTIALS.email }).select('+password');
        const isPasswordValid = await testUser.comparePassword(SUPER_ADMIN_CREDENTIALS.password);
        
        if (isPasswordValid) {
            console.log('✅ Login credentials verified successfully!');
        } else {
            console.log('❌ Password verification failed!');
        }
        
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run the script
createSuperAdmin();
