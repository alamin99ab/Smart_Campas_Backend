/**
 * Environment Variable Validation Utility
 * Ensures all required environment variables are set before starting the server
 */

const validateEnv = () => {
    const errors = [];
    const warnings = [];
    const useMemoryDb = process.env.USE_MEMORY_DB === 'true';
    const useMockDb = process.env.USE_MOCK_DB === 'true';

    // Required variables for basic operation
    const required = {
        'JWT_SECRET': 'JWT secret is required for authentication',
        'SUPER_ADMIN_EMAIL': 'Super admin email is required',
        'SUPER_ADMIN_PASSWORD': 'Super admin password is required'
    };

    if (!useMemoryDb && !useMockDb) {
        required.MONGO_URI = 'MongoDB connection string is required';
    }

    // Check required variables
    for (const [key, message] of Object.entries(required)) {
        if (!process.env[key] || process.env[key].trim() === '') {
            errors.push(`❌ ${key}: ${message}`);
        }
    }

    // Validate JWT_SECRET length in production
    if (process.env.NODE_ENV === 'production') {
        if (useMemoryDb || useMockDb) {
            errors.push('❌ USE_MEMORY_DB and USE_MOCK_DB are not allowed in production');
        }
        if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
            errors.push('❌ JWT_SECRET must be at least 32 characters in production');
        }
        if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length < 32) {
            errors.push('❌ JWT_REFRESH_SECRET must be at least 32 characters in production');
        }
    }

    // Validate MongoDB URI format
    if (process.env.MONGO_URI) {
        if (!process.env.MONGO_URI.startsWith('mongodb://') && !process.env.MONGO_URI.startsWith('mongodb+srv://')) {
            errors.push('❌ MONGO_URI must start with mongodb:// or mongodb+srv://');
        }
    }

    // Validate email format
    if (process.env.SUPER_ADMIN_EMAIL) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(process.env.SUPER_ADMIN_EMAIL)) {
            errors.push('❌ SUPER_ADMIN_EMAIL must be a valid email address');
        }
    }

    // Check optional but recommended variables
    const recommended = {
        'JWT_REFRESH_SECRET': 'JWT refresh secret for token refresh functionality',
        'SUPER_ADMIN_NAME': 'Super admin name for better identification',
        'FRONTEND_URL': 'Frontend URL for CORS configuration',
        'ALLOWED_ORIGINS': 'Allowed origins for CORS'
    };

    for (const [key, message] of Object.entries(recommended)) {
        if (!process.env[key] || process.env[key].trim() === '') {
            warnings.push(`⚠️  ${key}: ${message} (optional but recommended)`);
        }
    }

    if (useMemoryDb) {
        warnings.push('⚠️  USE_MEMORY_DB is enabled: an ephemeral in-memory MongoDB instance will be used for local development');
    }

    if (useMockDb) {
        warnings.push('⚠️  USE_MOCK_DB is enabled: database-backed features may be unavailable');
    }

    // Print results
    if (errors.length > 0) {
        console.error('\n' + '='.repeat(80));
        console.error('❌ ENVIRONMENT VARIABLE VALIDATION FAILED');
        console.error('='.repeat(80));
        console.error('\nThe following required environment variables are missing or invalid:\n');
        errors.forEach(error => console.error(error));
        console.error('\n' + '='.repeat(80));
        console.error('Please set these variables in your .env file or Render environment settings');
        console.error('Refer to .env.example for the complete list of variables');
        console.error('='.repeat(80) + '\n');
        return false;
    }

    if (warnings.length > 0) {
        console.warn('\n' + '='.repeat(80));
        console.warn('⚠️  ENVIRONMENT VARIABLE WARNINGS');
        console.warn('='.repeat(80));
        warnings.forEach(warning => console.warn(warning));
        console.warn('='.repeat(80) + '\n');
    }

    // Success message
    console.log('\n' + '='.repeat(80));
    console.log('✅ ENVIRONMENT VARIABLE VALIDATION PASSED');
    console.log('='.repeat(80));
    console.log('✓ All required environment variables are set');
    console.log(useMemoryDb || useMockDb ? '✓ Development database mode is configured' : '✓ MongoDB URI format is valid');
    console.log('✓ JWT secrets are configured');
    console.log('✓ Super admin credentials are set');
    console.log('='.repeat(80) + '\n');

    return true;
};

module.exports = { validateEnv };
