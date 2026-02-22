// config/cloudinary.js
const cloudinary = require('cloudinary').v2;

// ক্লাউডিনারি কনফিগারেশন (যদি env ভেরিয়েবল থাকে)
if (process.env.CLOUDINARY_CLOUD_NAME && 
    process.env.CLOUDINARY_API_KEY && 
    process.env.CLOUDINARY_API_SECRET) {
    
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
    });
    console.log('✅ Cloudinary configured');
} else {
    console.warn('⚠️ Cloudinary credentials missing. Image upload will be simulated.');
}

module.exports = cloudinary;