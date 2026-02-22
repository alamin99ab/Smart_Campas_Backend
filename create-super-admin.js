// Simple script to create Super Admin user via API
const axios = require('axios');

async function createSuperAdmin() {
    try {
        console.log('Creating Super Admin user via API...');
        
        const userData = {
            name: 'Super Admin',
            email: 'admin@smartcampus.com',
            password: 'admin123',
            role: 'super_admin',
            schoolCode: 'GLOBAL'
        };
        
        const response = await axios.post('http://localhost:5000/api/auth/register', userData);
        
        if (response.data.success) {
            console.log('✅ Super Admin created successfully!');
            console.log('Email: admin@smartcampus.com');
            console.log('Password: admin123');
            console.log('Role: super_admin');
        } else {
            console.log('❌ Failed to create Super Admin:', response.data.message);
        }
        
    } catch (error) {
        console.error('Error creating Super Admin:', error.response?.data || error.message);
    }
}

createSuperAdmin();
