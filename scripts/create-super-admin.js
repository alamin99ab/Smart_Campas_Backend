#!/usr/bin/env node

/**
 * 📝 CREATE SUPER ADMIN SCRIPT
 * 
 * This script creates a super admin user in the database.
 * Run this script to set up the initial super admin credentials.
 * 
 * Usage:
 * node scripts/create-super-admin.js
 * 
 * Environment Variables Required:
 * - MONGO_URI: MongoDB connection string
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Super admin credentials
const SUPER_ADMIN_CREDENTIALS = {
    name: 'Super Admin',
    email: 'superadmin@smartcampus.com',
    password: 'SuperAdmin123!',
    role: 'super_admin'
};

async function createSuperAdmin() {
    try {
        // Connect to MongoDB
        console.log('🔄 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://username:password@cluster.mongodb.net/smartcampus?retryWrites=true&w=majority');
        console.log('✅ Connected to MongoDB');

        // Check if super admin already exists
        console.log('🔍 Checking if super admin already exists...');
        const existingSuperAdmin = await User.findOne({ role: 'super_admin' });

        if (existingSuperAdmin) {
            console.log('⚠️  Super admin already exists:');
            console.log(`   Email: ${existingSuperAdmin.email}`);
            console.log(`   Name: ${existingSuperAdmin.name}`);
            console.log(`   Created: ${existingSuperAdmin.createdAt}`);
            
            // Ask if user wants to update password
            const readline = require('readline');
            const rl = readline.createInterface({
                input: process.stdin,
                output: process.stdout
            });

            rl.question('Do you want to update the password? (y/n): ', async (answer) => {
                if (answer.toLowerCase() === 'y') {
                    const newPassword = await new Promise((resolve) => {
                        rl.question('Enter new password: ', resolve);
                    });

                    const salt = await bcrypt.genSalt(12);
                    const hashedPassword = await bcrypt.hash(newPassword, salt);
                    
                    await User.updateOne(
                        { _id: existingSuperAdmin._id },
                        { password: hashedPassword, passwordChangedAt: new Date() }
                    );
                    
                    console.log('✅ Super admin password updated successfully!');
                }
                
                rl.close();
                await mongoose.disconnect();
                process.exit(0);
            });

            return;
        }

        // Create new super admin
        console.log('👤 Creating super admin user...');
        
        const superAdmin = new User(SUPER_ADMIN_CREDENTIALS);
        await superAdmin.save();

        console.log('✅ Super admin created successfully!');
        console.log('\n📋 SUPER ADMIN CREDENTIALS:');
        console.log('================================');
        console.log(`📧 Email: ${SUPER_ADMIN_CREDENTIALS.email}`);
        console.log(`🔑 Password: ${SUPER_ADMIN_CREDENTIALS.password}`);
        console.log(`👤 Name: ${SUPER_ADMIN_CREDENTIALS.name}`);
        console.log(`🎭 Role: ${SUPER_ADMIN_CREDENTIALS.role}`);
        console.log('================================');
        console.log('\n🔐 LOGIN CREDENTIALS:');
        console.log(`URL: https://smart-campas-backend.onrender.com`);
        console.log(`Login: ${SUPER_ADMIN_CREDENTIALS.email}`);
        console.log(`Password: ${SUPER_ADMIN_CREDENTIALS.password}`);
        console.log('\n⚠️  IMPORTANT: Change the password after first login!');
        
        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
        
    } catch (error) {
        console.error('❌ Error creating super admin:', error.message);
        process.exit(1);
    }
}

// Run the script
if (require.main === module) {
    createSuperAdmin();
}

module.exports = createSuperAdmin;
