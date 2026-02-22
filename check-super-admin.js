const mongoose = require('mongoose');
const User = require('./models/User');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/smart-campus', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});

async function checkSuperAdmin() {
    try {
        console.log('Checking for Super Admin users...');
        
        // Check if any super_admin users exist
        const superAdmins = await User.find({ role: 'super_admin' });
        console.log(`Found ${superAdmins.length} Super Admin users:`);
        
        if (superAdmins.length > 0) {
            superAdmins.forEach((admin, index) => {
                console.log(`\n${index + 1}. ${admin.name} (${admin.email})`);
                console.log(`   Role: ${admin.role}`);
                console.log(`   School Code: ${admin.schoolCode || 'None'}`);
                console.log(`   Created: ${admin.createdAt}`);
            });
        } else {
            console.log('No Super Admin users found.');
            console.log('Creating default Super Admin user...');
            
            // Create default super admin
            const defaultSuperAdmin = await User.create({
                name: 'Super Admin',
                email: 'admin@smartcampus.com',
                password: 'admin123', // Will be hashed by pre-save middleware
                role: 'super_admin',
                schoolCode: 'GLOBAL',
                isApproved: true,
                emailVerified: true,
                isActive: true
            });
            
            console.log('\n✅ Default Super Admin created:');
            console.log(`   Email: admin@smartcampus.com`);
            console.log(`   Password: admin123`);
            console.log(`   Role: super_admin`);
        }
        
        // Check all users by role
        console.log('\n=== USER COUNT BY ROLE ===');
        const roles = ['super_admin', 'admin', 'principal', 'teacher', 'student', 'parent'];
        for (const role of roles) {
            const count = await User.countDocuments({ role });
            console.log(`${role}: ${count} users`);
        }
        
    } catch (error) {
        console.error('Error checking Super Admin:', error);
    } finally {
        await mongoose.disconnect();
    }
}

checkSuperAdmin();
