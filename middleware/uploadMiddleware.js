// middleware/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if not exists
const uploadDir = 'uploads/notices';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Only images, documents and PDFs are allowed'));
    }
};

// Configure upload
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: fileFilter
});

// Wrapper to handle multer without files
const uploadHandler = (fields) => {
    return (req, res, next) => {
        const uploader = Array.isArray(fields) 
            ? upload.array(fields[0], fields[1] || 5)
            : upload.single(fields);
        
        uploader(req, res, function(err) {
            if (err) {
                console.error('Upload error:', err);
                return next(err);
            }
            // Always continue to next middleware
            next();
        });
    };
};

module.exports = { upload, uploadHandler };