/**
 * Cloudinary Configuration
 * Handles image uploads to Cloudinary CDN
 * Uses mock implementation when cloudinary is not configured
 */

// Mock cloudinary for development when not configured
const mockCloudinary = {
    uploader: {
        upload: async (filePath, options) => {
            console.log('⚠️  Cloudinary not configured, using mock upload');
            return {
                public_id: 'mock/' + Date.now(),
                secure_url: 'https://via.placeholder.com/300x200?text=Uploaded+Image',
                url: 'http://placeholder.com/image.jpg'
            };
        },
        destroy: async (publicId) => {
            console.log('⚠️  Cloudinary not configured, mock destroy');
            return { result: 'ok' };
        }
    },
    api: {
        resource: async (publicId) => {
            return { public_id: publicId };
        }
    }
};

// Try to load real cloudinary if configured
let cloudinary = null;
try {
    if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY) {
        cloudinary = require('cloudinary').v2;
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
            secure: true
        });
        console.log('✅ Cloudinary configured');
    }
} catch (error) {
    console.log('⚠️  Cloudinary not available, using mock');
}

// Export cloudinary or mock
module.exports = cloudinary || mockCloudinary;
