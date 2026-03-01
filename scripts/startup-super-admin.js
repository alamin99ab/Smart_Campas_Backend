#!/usr/bin/env node

/**
 * 🚀 STARTUP SUPER ADMIN CREATOR
 * 
 * This script will be integrated into the main server to create super admin
 * when the server starts if no super admin exists.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const SUPER_ADMIN_CREDENTIALS = {
    name: 'Super Admin',
    email: 'superadmin@smartcampus.com',
    password: 'SuperAdmin123!',
    role: 'super_admin',
    isApproved: true,
    emailVerified: true,
    isActive: true
};

/**
 * Create super admin if none exists
 * This function can be called during server startup
 */
async function ensureSuperAdminExists() {
    try {
        // Only run if MongoDB is connected
        if (mongoose.connection.readyState !== 1) {
            console.log('⚠️  MongoDB not connected, skipping super admin creation');
            return;
        }

        console.log('🔍 Checking for super admin...');
        
        // Check if super admin exists
        const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
        
        if (existingSuperAdmin) {
            console.log('✅ Super admin already exists:', existingSuperAdmin.email);
            
            // Ensure password is correct
            const testPassword = await bcrypt.compare(SUPER_ADMIN_CREDENTIALS.password, existingSuperAdmin.password);
            if (!testPassword) {
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
            }
        } else {
            console.log('👤 Creating super admin...');
            
            const superAdmin = new User(SUPER_ADMIN_CREDENTIALS);
            await superAdmin.save();
            
            console.log('✅ Super admin created successfully!');
            console.log('📋 Credentials:');
            console.log(`   Email: ${SUPER_ADMIN_CREDENTIALS.email}`);
            console.log(`   Password: ${SUPER_ADMIN_CREDENTIALS.password}`);
        }
        
        console.log('🎉 Super admin setup complete!');
        
    } catch (error) {
        console.error('❌ Error creating super admin:', error.message);
    }
}

/**
 * Manual super admin creation (for direct execution)
 */
async function createSuperAdminManually() {
    try {
        // Try to connect with multiple methods
        const MONGO_URI = 'mongodb+srv://Alamin:alamin45ab@cluster0.qht4rx6.mongodb.net/smartcampus?retryWrites=true&w=majority';
        
        console.log('🔄 Connecting to MongoDB...');
        
        // Try connection with minimal options
        await mongoose.connect(MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            bufferCommands: false,
            bufferMaxEntries: 0
        });
        
        console.log('✅ Connected to MongoDB');
        
        // Create super admin
        await ensureSuperAdminExists();
        
        // Verify creation
        const admin = await User.findOne({ role: 'super_admin' });
        if (admin) {
            console.log('\n🎉 SUCCESS! Super admin is ready:');
            console.log('================================');
            console.log(`📧 Email: ${admin.email}`);
            console.log(`🔑 Password: ${SUPER_ADMIN_CREDENTIALS.password}`);
            console.log(`👤 Name: ${admin.name}`);
            console.log(`🆔 ID: ${admin._id}`);
            console.log('================================');
            console.log('\n🌐 Login at: https://smart-campas-backend.onrender.com');
        }
        
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        console.log('\n📝 MANUAL SETUP INSTRUCTIONS:');
        console.log('1. Start your server: npm start');
        console.log('2. Super admin will be created automatically');
        console.log('3. Use credentials: superadmin@smartcampus.com / SuperAdmin123!');
    }
}

// Export for use in main server
module.exports = { ensureSuperAdminExists };

// Run manually if called directly
if (require.main === module) {
    createSuperAdminManually();
}
