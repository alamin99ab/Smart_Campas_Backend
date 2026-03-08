#!/usr/bin/env node

/**
 * 🚀 Deployment Initialization - Auto Create Super Admin
 * 
 * This script automatically creates a Super Admin during deployment.
 * Designed to run once when the application starts on Render/Heroku.
 * 
 * Features:
 * - Runs silently in production
 * - Creates admin only if not exists
 * - Logs minimal output for deployment logs
 * - Self-contained - no prompts
 * 
 * Usage: Called automatically during application startup
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

// Production Super Admin Configuration
const DEPLOY_ADMIN = {
    name: 'Alamin Admin',
    email: 'alamin@admin.com',
    password: 'A12@r12@++',
    phone: '01778060662',
    role: 'super_admin'
};

// Silent mode for production (minimal logging)
const isProduction = process.env.NODE_ENV === 'production';
const isSilent = isProduction || process.argv.includes('--silent');

function log(message, type = 'info') {
    if (isSilent) return;
    
    const timestamp = new Date().toISOString();
    const prefix = type === 'error' ? '❌' : type === 'success' ? '✅' : 'ℹ️';
    console.log(`[${timestamp}] ${prefix} ${message}`);
}

async function ensureSuperAdmin() {
    try {
        log('🚀 Deployment: Initializing Super Admin...', 'info');
        
        // Connect to database
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 10000,
        });
        
        log('Database connected', 'success');

        // Check if super admin exists
        const existingAdmin = await User.findOne({ role: 'super_admin' });
        
        if (existingAdmin) {
            log('Super Admin already exists - skipping creation', 'info');
            await mongoose.connection.close();
            return { success: true, action: 'exists', admin: existingAdmin.email };
        }

        // Create super admin
        log('Creating Super Admin...', 'info');
        
        const hashedPassword = await bcrypt.hash(DEPLOY_ADMIN.password, 12);
        
        const superAdmin = new User({
            name: DEPLOY_ADMIN.name,
            email: DEPLOY_ADMIN.email,
            password: hashedPassword,
            role: DEPLOY_ADMIN.role,
            phone: DEPLOY_ADMIN.phone,
            isApproved: true,
            emailVerified: true,
            isActive: true,
            // Super admin has no schoolId, schoolCode, or schoolName
            schoolId: undefined,
            schoolCode: undefined,
            schoolName: undefined
        });

        await superAdmin.save();
        
        log('Super Admin created successfully!', 'success');
        log(`Email: ${DEPLOY_ADMIN.email}`, 'info');
        log('Ready for deployment!', 'success');
        
        await mongoose.connection.close();
        
        return { 
            success: true, 
            action: 'created', 
            admin: DEPLOY_ADMIN.email,
            credentials: {
                email: DEPLOY_ADMIN.email,
                password: DEPLOY_ADMIN.password
            }
        };

    } catch (error) {
        log(`Failed to create Super Admin: ${error.message}`, 'error');
        
        // Don't exit with error in production - let app continue
        if (!isProduction) {
            process.exit(1);
        }
        
        return { success: false, error: error.message };
    }
}

// Export for use in main application
module.exports = { ensureSuperAdmin };

// Run directly if called as script
if (require.main === module) {
    ensureSuperAdmin()
        .then(result => {
            if (result.success) {
                log(`Deployment init complete: ${result.action}`, 'success');
                process.exit(0);
            } else {
                log(`Deployment init failed: ${result.error}`, 'error');
                process.exit(1);
            }
        })
        .catch(error => {
            log(`Deployment init error: ${error.message}`, 'error');
            process.exit(1);
        });
}
