#!/usr/bin/env node

/**
 * ⚡ Quick Super Admin Creation Script
 * 
 * Simple script to quickly create a super admin user
 * 
 * Usage: node scripts/quick-admin.js
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

async function createSuperAdmin() {
    try {
        console.log('🚀 Creating Super Admin...');
        
        // Connect to database
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Database connected');
        
        // Check if already exists
        const existing = await User.findOne({ role: 'super_admin' });
        if (existing) {
            console.log('⚠️  Super admin already exists:', existing.email);
            return;
        }
        
        // Create super admin
        const hashedPassword = await bcrypt.hash('A12@r12@++', 12);
        
        const superAdmin = new User({
            name: 'Alamin Admin',
            email: 'alamin@admin.com',
            password: hashedPassword,
            role: 'super_admin',
            phone: '01778060662',
            isApproved: true,
            emailVerified: true,
            isActive: true
        });
        
        await superAdmin.save();
        
        console.log('✅ Super admin created successfully!');
        console.log('📧 Email: alamin@admin.com');
        console.log('🔑 Password: A12@r12@++');
        console.log('📱 Phone: 01778060662');
        console.log('🌐 Login: http://localhost:5024/api/auth/login');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
    }
}

createSuperAdmin();
