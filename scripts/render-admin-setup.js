/**
 * 🚀 RENDER AUTO-ADMIN SETUP - API Endpoint
 * 
 * This creates an API endpoint that automatically creates Super Admin
 * when visited. Perfect for Render deployments.
 * 
 * Usage: Add this to your main app routes
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const SUPER_ADMIN = {
    name: 'Alamin Admin',
    email: 'alamin@admin.com',
    password: 'A12@r12@++',
    phone: '01778060662',
    role: 'super_admin'
};

// Auto-create Super Admin endpoint
const autoCreateSuperAdmin = async (req, res) => {
    try {
        console.log('🚀 Auto-creating Super Admin from endpoint...');
        
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
                login_url: `${req.protocol}://${req.get('host')}/api/auth/login`
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

        console.log('✅ Super Admin created successfully via endpoint');

        res.json({
            success: true,
            message: 'Super Admin created successfully',
            admin: {
                email: SUPER_ADMIN.email,
                name: SUPER_ADMIN.name,
                role: SUPER_ADMIN.role,
                password: SUPER_ADMIN.password // Show password for initial setup
            },
            login_url: `${req.protocol}://${req.get('host')}/api/auth/login`,
            instructions: {
                step1: 'Use the credentials above to login',
                step2: 'Change password after first login',
                step3: 'Start creating schools and users'
            }
        });

    } catch (error) {
        console.error('❌ Auto-admin creation failed:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to create Super Admin',
            error: error.message
        });
    }
};

// HTML page for easy access
const autoCreateAdminPage = (req, res) => {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Smart Campus - Auto Setup</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; background: #f5f5f5; }
        .container { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #007bff; text-align: center; }
        .btn { 
            background: #007bff; 
            color: white; 
            padding: 15px 30px; 
            border: none; 
            border-radius: 5px; 
            cursor: pointer; 
            font-size: 16px; 
            width: 100%;
            margin: 10px 0;
        }
        .btn:hover { background: #0056b3; }
        .btn.success { background: #28a745; }
        .btn.success:hover { background: #1e7e34; }
        .result { margin: 20px 0; padding: 15px; border-radius: 5px; }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
        .center { text-align: center; }
        .spinner { border: 3px solid #f3f3f3; border-top: 3px solid #007bff; border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; display: inline-block; margin-right: 10px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Smart Campus SaaS</h1>
        <h2>Auto Super Admin Setup</h2>
        
        <div class="info">
            <p><strong>📋 This will automatically create the Super Admin account:</strong></p>
            <pre>
Email: alamin@admin.com
Password: A12@r12@++
Phone: 01778060662
Role: super_admin
            </pre>
        </div>
        
        <button class="btn" onclick="setupAdmin()">
            <span id="btnText">🔥 Create Super Admin Now</span>
        </button>
        
        <div id="result"></div>
        
        <div class="center">
            <small>
                After setup, login at: <a href="/api/auth/login" target="_blank">/api/auth/login</a>
            </small>
        </div>
    </div>

    <script>
        async function setupAdmin() {
            const btn = document.querySelector('.btn');
            const btnText = document.getElementById('btnText');
            const result = document.getElementById('result');
            
            btn.disabled = true;
            btnText.innerHTML = '<span class="spinner"></span>Creating Super Admin...';
            result.innerHTML = '';
            
            try {
                const response = await fetch('/api/auto-setup-admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    result.innerHTML = \`
                        <div class="success">
                            <h3>✅ Success! Super Admin Ready</h3>
                            <p><strong>Email:</strong> \${data.admin.email}</p>
                            <p><strong>Password:</strong> \${data.admin.password}</p>
                            <p><strong>Name:</strong> \${data.admin.name}</p>
                            <hr>
                            <h4>🔗 Login URL:</h4>
                            <p><a href="\${data.login_url}" target="_blank">\${data.login_url}</a></p>
                            <h4>📋 Next Steps:</h4>
                            <ol>
                                <li>Click the login URL above</li>
                                <li>Use the credentials to login</li>
                                <li>Change password after first login</li>
                                <li>Start creating schools</li>
                            </ol>
                        </div>
                    \`;
                    btnText.innerHTML = '✅ Setup Complete!';
                    btn.className = 'btn success';
                } else {
                    result.innerHTML = \`
                        <div class="error">
                            <h3>❌ Setup Failed</h3>
                            <p>\${data.message}</p>
                            \${data.error ? \`<p><strong>Error:</strong> \${data.error}</p>\` : ''}
                        </div>
                    \`;
                    btnText.innerHTML = '🔄 Try Again';
                    btn.disabled = false;
                }
            } catch (error) {
                result.innerHTML = \`
                    <div class="error">
                        <h3>❌ Network Error</h3>
                        <p>\${error.message}</p>
                    </div>
                \`;
                btnText.innerHTML = '🔄 Try Again';
                btn.disabled = false;
            }
        }
        
        // Auto-run if hash is #auto
        if (window.location.hash === '#auto') {
            setTimeout(setupAdmin, 1000);
        }
    </script>
</body>
</html>`;
    
    res.send(html);
};

module.exports = {
    autoCreateSuperAdmin,
    autoCreateAdminPage
};
