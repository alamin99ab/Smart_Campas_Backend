#!/usr/bin/env node

/**
 * 🌱 SEED SUPER ADMIN - DATABASE SEEDING
 * 
 * Alternative method to create super admin using seeding approach.
 * This is useful for initial database setup.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const superAdminData = {
    name: 'Super Admin',
    email: 'superadmin@smartcampus.com',
    password: 'SuperAdmin123!',
    role: 'super_admin',
    isApproved: true,
    emailVerified: true,
    isActive: true
};

async function seedSuperAdmin() {
    try {
        // Connect to database
        const mongoUri = process.env.MONGO_URI || 'mongodb+srv://username:password@cluster.mongodb.net/smartcampus?retryWrites=true&w=majority';
        await mongoose.connect(mongoUri);
        console.log('🔄 Connected to MongoDB');

        // Delete existing super admin (if any)
        await User.deleteMany({ role: 'super_admin' });
        console.log('🗑️  Cleared existing super admin accounts');

        // Hash password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(superAdminData.password, salt);

        // Create super admin
        const superAdmin = new User({
            ...superAdminData,
            password: hashedPassword
        });

        await superAdmin.save();
        console.log('✅ Super admin seeded successfully!');

        // Display credentials
        console.log('\n📋 SUPER ADMIN CREDENTIALS:');
        console.log('================================');
        console.log(`📧 Email: ${superAdminData.email}`);
        console.log(`🔑 Password: ${superAdminData.password}`);
        console.log(`👤 Name: ${superAdminData.name}`);
        console.log('================================');

        await mongoose.disconnect();
        console.log('🔌 Database connection closed');

    } catch (error) {
        console.error('❌ Error seeding super admin:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    seedSuperAdmin();
}

module.exports = seedSuperAdmin;
