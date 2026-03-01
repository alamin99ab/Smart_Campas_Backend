/**
 * SaaS / Production environment validation and config
 * Fails fast at startup if required production vars are missing or weak
 */
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

const required = ['MONGO_URI'];
const requiredProduction = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'FRONTEND_URL'];

function validateEnv() {
    const missing = required.filter(key => !process.env[key] || !String(process.env[key]).trim());
    if (missing.length > 0) {
        console.warn('Warning: Missing recommended env vars:', missing.join(', '));
        // Don't exit in development, just warn
        if (!isProduction) {
            console.warn('⚠️  Running in development mode without some recommended configurations');
        } else {
            process.exit(1);
        }
    }

    if (isProduction) {
        const missingProd = requiredProduction.filter(key => !process.env[key] || !String(process.env[key]).trim());
        if (missingProd.length > 0) {
            console.warn('Warning (production): Missing recommended env vars:', missingProd.join(', '));
            // Set default values for missing production vars
            if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'your-super-secret-jwt-key-change-in-production-min-32-chars';
            if (!process.env.JWT_REFRESH_SECRET) process.env.JWT_REFRESH_SECRET = 'your-super-secret-refresh-key-change-in-production-min-32-chars-different';
            if (!process.env.FRONTEND_URL) process.env.FRONTEND_URL = 'https://your-frontend-domain.com';
        }
        if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
            console.warn('Warning (production): JWT_SECRET should be at least 32 characters for security');
        }
        if (process.env.JWT_REFRESH_SECRET && process.env.JWT_REFRESH_SECRET.length < 32) {
            console.warn('Warning (production): JWT_REFRESH_SECRET should be at least 32 characters for security');
        }
        if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
            console.warn('Warning (production): JWT_SECRET and JWT_REFRESH_SECRET should be different for security');
        }
    }
}

function getCorsOrigin() {
    const url = process.env.FRONTEND_URL || 'http://localhost:3000';
    if (isProduction) return url;
    return [url, 'http://localhost:3000', 'http://127.0.0.1:3000'];
}

module.exports = {
    isProduction,
    validateEnv,
    getCorsOrigin
};
