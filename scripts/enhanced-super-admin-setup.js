/**
 * 🔐 ENHANCED SUPER ADMIN SETUP SCRIPT
 * Creates and manages Super Admin account with enhanced security
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const User = require('../models/User');
const SystemSettings = require('../models/SystemSettings');
require('dotenv').config();

// Enhanced super admin configuration
const superAdminConfig = {
    credentials: {
        name: 'System Super Admin',
        email: 'superadmin@smartcampus.com',
        password: 'SuperAdmin@2026',
        role: 'super_admin',
        phone: '+8801700000000',
        schoolCode: 'SYSTEM'
    },
    security: {
        maxLoginAttempts: 5,
        sessionTimeout: 7, // days
        requireEmailVerification: false,
        enable2FA: false, // Can be enabled later
        deviceManagement: true
    },
    permissions: [
        'manage_schools',
        'manage_principals', 
        'system_administration',
        'view_analytics',
        'manage_system_settings',
        'manage_users',
        'audit_logs',
        'system_monitoring'
    ]
};

/**
 * Generate secure random password
 */
function generateSecurePassword(length = 16) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}

/**
 * Setup system settings
 */
async function setupSystemSettings() {
    try {
        console.log('🔧 Setting up system settings...');
        
        await SystemSettings.setValue('system_settings', {
            maintenanceMode: false,
            registrationEnabled: true,
            emailVerificationRequired: false,
            maxLoginAttempts: superAdminConfig.security.maxLoginAttempts,
            sessionTimeout: superAdminConfig.security.sessionTimeout,
            systemNotifications: {
                emailAlerts: true,
                securityAlerts: true,
                systemUpdates: true
            }
        });

        await SystemSettings.setValue('security_settings', {
            passwordMinLength: 8,
            passwordRequireUppercase: true,
            passwordRequireNumbers: true,
            passwordRequireSpecialChars: true,
            sessionTimeoutMinutes: 60,
            maxConcurrentSessions: 5
        });

        console.log('✅ System settings configured');
    } catch (error) {
        console.error('❌ Error setting up system settings:', error);
        throw error;
    }
}

/**
 * Create or update super admin
 */
async function setupSuperAdmin() {
    try {
        console.log('🔧 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');

        // Setup system settings first
        await setupSystemSettings();

        // Check if Super Admin already exists
        const existingSuperAdmin = await User.findOne({ role: 'super_admin' });
        
        if (existingSuperAdmin) {
            console.log('⚠️ Super Admin already exists');
            console.log(`📧 Email: ${existingSuperAdmin.email}`);
            console.log(`🔑 Password: [Already Set]`);
            console.log(`🔐 2FA Enabled: ${existingSuperAdmin.twoFactorEnabled ? 'Yes' : 'No'}`);
            
            // Update permissions if needed
            const currentPermissions = existingSuperAdmin.permissions || [];
            const missingPermissions = superAdminConfig.permissions.filter(p => !currentPermissions.includes(p));
            
            if (missingPermissions.length > 0) {
                existingSuperAdmin.permissions = [...currentPermissions, ...missingPermissions];
                await existingSuperAdmin.save();
                console.log(`✅ Added missing permissions: ${missingPermissions.join(', ')}`);
            }
            
            return existingSuperAdmin;
        }

        // Hash password
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(superAdminConfig.credentials.password, salt);

        // Create Super Admin
        const superAdmin = new User({
            ...superAdminConfig.credentials,
            password: hashedPassword,
            isActive: true,
            isEmailVerified: true,
            permissions: superAdminConfig.permissions,
            devices: [],
            sessions: []
        });

        await superAdmin.save();
        
        console.log('✅ Super Admin created successfully!');
        console.log('\n🌟 ENHANCED SMART CAMPUS SYSTEM READY! 🌟');
        console.log('📋 Login Credentials:');
        console.log('   URL: http://localhost:5000');
        console.log('   Email:', superAdminConfig.credentials.email);
        console.log('   Password:', superAdminConfig.credentials.password);
        console.log('   Role:', superAdminConfig.credentials.role);
        console.log('   Permissions:', superAdminConfig.permissions.join(', '));
        
        console.log('\n🔐 Security Features:');
        console.log('   ✅ Enhanced password hashing (12 rounds salt)');
        console.log('   ✅ Device management enabled');
        console.log('   ✅ Session management');
        console.log('   ✅ Audit logging enabled');
        console.log('   ✅ Rate limiting enabled');
        console.log('   ✅ Account lockout after 5 failed attempts');
        
        console.log('\n📊 Available Features:');
        console.log('   🏫 School Management');
        console.log('   👥 User Management');
        console.log('   📈 System Analytics');
        console.log('   ⚙️ System Settings');
        console.log('   🔍 Audit Logs');
        console.log('   📱 Device Management');
        
        console.log('\n🚀 Next Steps:');
        console.log('   1. Login with the credentials above');
        console.log('   2. Navigate to /api/super-admin/dashboard');
        console.log('   3. Configure system settings as needed');
        console.log('   4. Enable 2FA for enhanced security');
        console.log('   5. Create schools and principals');
        
        return superAdmin;
        
    } catch (error) {
        console.error('❌ Error setting up Super Admin:', error);
        throw error;
    } finally {
        await mongoose.disconnect();
    }
}

/**
 * Reset super admin password
 */
async function resetSuperAdminPassword(newPassword = null) {
    try {
        console.log('🔄 Resetting Super Admin password...');
        await mongoose.connect(process.env.MONGO_URI);
        
        const superAdmin = await User.findOne({ role: 'super_admin' });
        if (!superAdmin) {
            console.log('❌ No Super Admin found');
            return;
        }
        
        const password = newPassword || generateSecurePassword();
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(password, salt);
        
        superAdmin.password = hashedPassword;
        superAdmin.loginAttempts = 0;
        superAdmin.isBlocked = false;
        superAdmin.sessions = [];
        superAdmin.refreshToken = null;
        
        await superAdmin.save();
        
        console.log('✅ Password reset successful!');
        console.log('📧 Email:', superAdmin.email);
        console.log('🔑 New Password:', password);
        
    } catch (error) {
        console.error('❌ Error resetting password:', error);
    } finally {
        await mongoose.disconnect();
    }
}

/**
 * Check super admin status
 */
async function checkSuperAdminStatus() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        
        const superAdmin = await User.findOne({ role: 'super_admin' });
        if (!superAdmin) {
            console.log('❌ No Super Admin found');
            return;
        }
        
        console.log('📊 Super Admin Status:');
        console.log('   Name:', superAdmin.name);
        console.log('   Email:', superAdmin.email);
        console.log('   Role:', superAdmin.role);
        console.log('   Active:', superAdmin.isActive);
        console.log('   Email Verified:', superAdmin.emailVerified);
        console.log('   Blocked:', superAdmin.isBlocked);
        console.log('   Login Attempts:', superAdmin.loginAttempts || 0);
        console.log('   2FA Enabled:', superAdmin.twoFactorEnabled);
        console.log('   Active Sessions:', (superAdmin.sessions || []).length);
        console.log('   Registered Devices:', (superAdmin.devices || []).length);
        console.log('   Last Login:', superAdmin.lastLogin || 'Never');
        console.log('   Last Login IP:', superAdmin.lastLoginIP || 'N/A');
        console.log('   Permissions:', (superAdmin.permissions || []).join(', '));
        
    } catch (error) {
        console.error('❌ Error checking status:', error);
    } finally {
        await mongoose.disconnect();
    }
}

// Command line interface
const command = process.argv[2];

switch (command) {
    case 'setup':
        setupSuperAdmin();
        break;
    case 'reset-password':
        const newPassword = process.argv[3];
        resetSuperAdminPassword(newPassword);
        break;
    case 'status':
        checkSuperAdminStatus();
        break;
    default:
        console.log('🔧 Enhanced Super Admin Setup Script');
        console.log('');
        console.log('Usage:');
        console.log('  node enhanced-super-admin-setup.js setup          - Create super admin');
        console.log('  node enhanced-super-admin-setup.js reset-password   - Reset password');
        console.log('  node enhanced-super-admin-setup.js status          - Check status');
        console.log('');
        console.log('Example:');
        console.log('  node enhanced-super-admin-setup.js setup');
        console.log('  node enhanced-super-admin-setup.js reset-password "NewPass123!"');
        break;
}

module.exports = {
    setupSuperAdmin,
    resetSuperAdminPassword,
    checkSuperAdminStatus
};
