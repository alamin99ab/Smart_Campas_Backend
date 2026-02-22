/**
 * 🏢 SUPER ADMIN SETUP SCRIPT
 * Creates predefined Super Admin account for industry-level Smart Campus System
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const superAdminData = {
    name: 'System Super Admin',
    email: 'superadmin@smartcampus.com',
    password: 'SuperAdmin@2026',
    role: 'super_admin',
    phone: '+8801700000000',
    schoolCode: 'SYSTEM', // Special code for Super Admin
    isActive: true,
    isEmailVerified: true,
    permissions: [
        'manage_schools',
        'manage_principals',
        'system_administration',
        'view_analytics',
        'manage_system_settings'
    ]
};

async function setupSuperAdmin() {
    try {
        console.log('🔧 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Check if Super Admin already exists
        const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
        if (existingSuperAdmin) {
            console.log('⚠️ Super Admin already exists');
            console.log(`📧 Email: ${existingSuperAdmin.email}`);
            console.log('🔑 Password: [Already Set]');
            await mongoose.disconnect();
            return;
        }

        // Hash password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(superAdminData.password, salt);

        // Create Super Admin
        const superAdmin = new User({
            ...superAdminData,
            password: hashedPassword
        });

        await superAdmin.save();
        
        console.log('✅ Super Admin created successfully!');
        console.log('📧 Email:', superAdminData.email);
        console.log('🔑 Password:', superAdminData.password);
        console.log('🎯 Role:', superAdminData.role);
        console.log('🔐 Permissions:', superAdminData.permissions.join(', '));
        
        console.log('\n🌟 INDUSTRY-LEVEL SMART CAMPUS SYSTEM READY! 🌟');
        console.log('📋 Login Credentials:');
        console.log('   URL: http://localhost:5000');
        console.log('   Email:', superAdminData.email);
        console.log('   Password:', superAdminData.password);
        
    } catch (error) {
        console.error('❌ Error setting up Super Admin:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Run setup
setupSuperAdmin();
