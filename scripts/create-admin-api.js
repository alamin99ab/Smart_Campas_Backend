#!/usr/bin/env node

/**
 * 🌐 CREATE ADMIN API - Simple Express Server
 * 
 * Run this server and visit the URL to create Super Admin
 * 
 * Usage: 
 * 1. node scripts/create-admin-api.js
 * 2. Open http://localhost:3000/create-admin
 */

const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Super Admin Configuration
const SUPER_ADMIN = {
    name: 'Alamin Admin',
    email: 'alamin@admin.com',
    password: 'A12@r12@++',
    phone: '01778060662',
    role: 'super_admin'
};

// Serve HTML page
app.get('/create-admin', async (req, res) => {
    try {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Smart Campus - Create Super Admin</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .container { background: #f5f5f5; padding: 30px; border-radius: 10px; }
        .btn { background: #007bff; color: white; padding: 15px 30px; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; }
        .btn:hover { background: #0056b3; }
        .result { margin-top: 20px; padding: 15px; border-radius: 5px; }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .info { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 3px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Smart Campus SaaS - Create Super Admin</h1>
        <p>Click the button below to create the Super Admin user in your database.</p>
        
        <button class="btn" onclick="createAdmin()">🔥 Create Super Admin Now</button>
        
        <div id="result"></div>
        
        <div class="info">
            <h3>📋 Default Credentials:</h3>
            <pre>
Email: alamin@admin.com
Password: A12@r12@++
Phone: 01778060662
Role: super_admin
            </pre>
        </div>
    </div>

    <script>
        async function createAdmin() {
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = '<div class="info">🔄 Creating Super Admin... Please wait...</div>';
            
            try {
                const response = await fetch('/api/create-super-admin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    resultDiv.innerHTML = \`
                        <div class="success">
                            <h3>✅ Success! Super Admin Created</h3>
                            <p><strong>Email:</strong> \${data.credentials.email}</p>
                            <p><strong>Password:</strong> \${data.credentials.password}</p>
                            <p><strong>Login URL:</strong> <a href="/api/auth/login" target="_blank">http://localhost:5024/api/auth/login</a></p>
                        </div>
                    \`;
                } else {
                    resultDiv.innerHTML = \`
                        <div class="error">
                            <h3>❌ Error</h3>
                            <p>\${data.message}</p>
                        </div>
                    \`;
                }
            } catch (error) {
                resultDiv.innerHTML = \`
                    <div class="error">
                        <h3>❌ Network Error</h3>
                        <p>\${error.message}</p>
                    </div>
                \`;
            }
        }
    </script>
</body>
</html>`;
        
        res.send(html);
    }
});

// API endpoint to create admin
app.post('/api/create-super-admin', async (req, res) => {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 10000,
        });

        // Delete existing admin
        await User.deleteMany({ role: 'super_admin' });

        // Create new admin
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
        
        res.json({
            success: true,
            message: 'Super Admin created successfully',
            credentials: {
                email: SUPER_ADMIN.email,
                password: SUPER_ADMIN.password
            }
        });

    } catch (error) {
        res.json({
            success: false,
            message: error.message
        });
    } finally {
        await mongoose.connection.close();
    }
});

// Start server
app.listen(PORT, () => {
    console.log('🌐 Create Admin API Server Running');
    console.log(`📱 Open: http://localhost:${PORT}/create-admin`);
    console.log('🔥 Click the button to create Super Admin');
});
