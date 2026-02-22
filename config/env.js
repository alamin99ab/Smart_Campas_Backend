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
        console.error('Fatal: Missing required env vars:', missing.join(', '));
        process.exit(1);
    }

    if (isProduction) {
        const missingProd = requiredProduction.filter(key => !process.env[key] || !String(process.env[key]).trim());
        if (missingProd.length > 0) {
            console.error('Fatal (production): Missing required env vars:', missingProd.join(', '));
            process.exit(1);
        }
        if (process.env.JWT_SECRET.length < 32) {
            console.error('Fatal (production): JWT_SECRET must be at least 32 characters');
            process.exit(1);
        }
        if (process.env.JWT_REFRESH_SECRET.length < 32) {
            console.error('Fatal (production): JWT_REFRESH_SECRET must be at least 32 characters');
            process.exit(1);
        }
        if (process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET) {
            console.error('Fatal (production): JWT_SECRET and JWT_REFRESH_SECRET must be different');
            process.exit(1);
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
