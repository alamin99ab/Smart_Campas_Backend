const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');

// Direct database connection
mongoose.connect('mongodb://localhost:27017/smart-campus').then(() => {
    console.log('✅ Connected to MongoDB');
    createSuperAdmin();
}).catch(err => {
    console.error('❌ MongoDB connection error:', err);
});

async function createSuperAdmin() {
    try {
        // Check if Super Admin already exists
        const existingSuperAdmin = await User.findOne({ 
            email: 'admin@smartcampus.com',
            role: 'super_admin' 
        });
        
        if (existingSuperAdmin) {
            console.log('✅ Super Admin already exists:');
            console.log('   Email: admin@smartcampus.com');
            console.log('   Password: admin123');
            console.log('   Role: super_admin');
            return;
        }
        
        // Hash password manually
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash('admin123', salt);
        
        // Create Super Admin user
        const superAdmin = await User.create({
            name: 'Super Admin',
            email: 'admin@smartcampus.com',
            password: hashedPassword,
            role: 'super_admin',
            schoolCode: 'GLOBAL',
            isApproved: true,
            emailVerified: true,
            isActive: true,
            permissions: [
                'manage_all_schools',
                'view_global_analytics',
                'manage_subscriptions',
                'system_administration'
            ]
        });
        
        console.log('🎉 Super Admin created successfully!');
        console.log('═════════════════════════════════════');
        console.log('📧 LOGIN CREDENTIALS:');
        console.log('   Email:    admin@smartcampus.com');
        console.log('   Password: admin123');
        console.log('   Role:     super_admin');
        console.log('═════════════════════════════════════');
        
    } catch (error) {
        console.error('❌ Error creating Super Admin:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📊 Database connection closed');
    }
}
