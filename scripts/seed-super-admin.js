/**
 * 🔐 SUPER ADMIN SEEDER
 * Securely creates/updates Super Admin user
 * 
 * Usage: node scripts/seed-super-admin.js
 * 
 * Prerequisites:
 * 1. MongoDB must be running
 * 2. Update .env with your configuration
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// MongoDB User Model
const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    isBlocked: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: true },
    loginAttempts: { type: Number, default: 0 },
    permissions: [String],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// Validate environment variables
function validateEnv() {
    const required = ['MONGO_URI', 'SUPER_ADMIN_EMAIL', 'SUPER_ADMIN_PASSWORD'];
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
        console.error(`\n❌ Error: Missing required environment variables:`);
        missing.forEach(key => console.error(`   - ${key}`));
        console.log(`\n📝 Please update your .env file with these values.\n`);
        process.exit(1);
    }

    // Validate password strength
    const password = process.env.SUPER_ADMIN_PASSWORD;
    if (password.length < 8) {
        console.error(`\n❌ Error: Password must be at least 8 characters.\n`);
        process.exit(1);
    }
}

// Seed Super Admin
async function seedSuperAdmin() {
    try {
        console.log('\n🔐 Super Admin Seeder\n');
        console.log('=' .repeat(50));

        // Validate environment
        validateEnv();

        const email = process.env.SUPER_ADMIN_EMAIL;
        const password = process.env.SUPER_ADMIN_PASSWORD;
        const name = process.env.SUPER_ADMIN_NAME || 'Super Administrator';

        console.log(`📧 Email: ${email}`);
        console.log(`👤 Name: ${name}`);

        // Connect to MongoDB
        console.log('\n📦 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 10000,
            socketTimeoutMS: 45000
        });
        console.log('✅ Connected to MongoDB');

        // Check if Super Admin exists
        const existingAdmin = await User.findOne({ role: 'super_admin' });
        
        if (existingAdmin) {
            console.log('\n⚠️  Super Admin already exists!');
            
            // Update existing admin credentials
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash(password, salt);
            
            existingAdmin.name = name;
            existingAdmin.email = email;
            existingAdmin.password = hashedPassword;
            existingAdmin.isActive = true;
            existingAdmin.isBlocked = false;
            existingAdmin.emailVerified = true;
            existingAdmin.permissions = ['all'];
            
            await existingAdmin.save();
            
            console.log('✅ Super Admin credentials updated successfully!');
            console.log(`\n🔑 New Login Credentials:`);
            console.log(`   Email: ${email}`);
            console.log(`   Password: [As set in .env]\n`);
            
        } else {
            // Create new Super Admin
            console.log('\n👑 Creating new Super Admin...');
            
            const salt = await bcrypt.genSalt(12);
            const hashedPassword = await bcrypt.hash(password, salt);
            
            const superAdmin = new User({
                name,
                email,
                password: hashedPassword,
                role: 'super_admin',
                isActive: true,
                isBlocked: false,
                emailVerified: true,
                loginAttempts: 0,
                permissions: ['all', 'manage_schools', 'manage_users', 'view_analytics', 'system_settings']
            });
            
            await superAdmin.save();
            
            console.log('✅ Super Admin created successfully!');
            console.log(`\n🔑 Login Credentials:`);
            console.log(`   Email: ${email}`);
            console.log(`   Password: [As set in .env]\n`);
        }

        console.log('=' .repeat(50));
        console.log('🎉 Seeding complete!\n');

        // Disconnect from MongoDB
        await mongoose.disconnect();
        console.log('📦 Disconnected from MongoDB\n');
        
        process.exit(0);
        
    } catch (error) {
        console.error('\n❌ Seeding failed:', error.message);
        
        // Attempt to disconnect on error
        try {
            await mongoose.disconnect();
        } catch (e) {
            // Ignore disconnect error
        }
        
        process.exit(1);
    }
}

// Run seeder
seedSuperAdmin();
