/**
 * 🚀 SIMPLE ADMIN SETUP FOR RENDER
 * 
 * Add this to your main index.js file after the routes section
 */

// Simple Admin Setup - Add this after line 90 in index.js
app.get('/setup', async (req, res) => {
    try {
        const bcrypt = require('bcryptjs');
        const User = require('./models/User');
        
        const SUPER_ADMIN = {
            name: 'Alamin Admin',
            email: 'alamin@admin.com',
            password: 'A12@r12@++',
            phone: '01778060662',
            role: 'super_admin'
        };

        // Check if Super Admin already exists
        const existingAdmin = await User.findOne({ role: 'super_admin' });
        
        if (existingAdmin) {
            return res.json({
                success: true,
                message: 'Super Admin already exists',
                admin: {
                    email: existingAdmin.email,
                    name: existingAdmin.name,
                    role: existingAdmin.role
                },
                login_url: `${req.protocol}://${req.get('host')}/api/auth/login`,
                credentials: {
                    email: SUPER_ADMIN.email,
                    password: SUPER_ADMIN.password
                }
            });
        }

        // Create new Super Admin
        const hashedPassword = await bcrypt.hash(SUPER_ADMIN.password, 12);
        
        const superAdmin = new User({
            name: SUPER_ADMIN.name,
            email: SUPER_ADMIN.email,
            password: hashedPassword,
            role: SUPER_ADMIN.role,
            phone: SUPER_ADMIN.phone,
            isApproved: true,
            emailVerified: true,
            isActive: true
        });

        await superAdmin.save();

        console.log('✅ Super Admin created successfully via /setup endpoint');

        res.json({
            success: true,
            message: 'Super Admin created successfully',
            admin: {
                email: SUPER_ADMIN.email,
                name: SUPER_ADMIN.name,
                role: SUPER_ADMIN.role,
                password: SUPER_ADMIN.password
            },
            login_url: `${req.protocol}://${req.get('host')}/api/auth/login`,
            instructions: {
                step1: 'Use the credentials above to login',
                step2: 'Change password after first login',
                step3: 'Start creating schools and users'
            }
        });

    } catch (error) {
        console.error('❌ Admin setup failed:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to create Super Admin',
            error: error.message
        });
    }
});

console.log('✅ Simple Admin Setup route loaded - /setup');
