// Mock MongoDB for testing without database
const mongoose = require('mongoose');

// Create mock connection
mongoose.connect = () => Promise.resolve();
mongoose.connection = {
    readyState: 1, // connected
    name: 'smart-campus-test',
    host: 'localhost'
};

// Mock User model for testing
const mockUser = {
    findOne: async (query) => {
        if (query.role === 'super_admin') {
            return null; // No super admin exists initially
        }
        if (query.email === 'admin@example.com') {
            return null;
        }
        return null;
    },
    create: async (data) => {
        return {
            _id: '507f1f77bcf86cd799439011',
            ...data,
            save: async () => ({ ...data })
        };
    }
};

// Override the User model
const originalRequire = require;
require = function(id) {
    if (id.includes('./models/User')) {
        return mockUser;
    }
    return originalRequire.apply(this, arguments);
};

console.log('Mock database setup complete');
console.log('Server can now run without MongoDB connection');
