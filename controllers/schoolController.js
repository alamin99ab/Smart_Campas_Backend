// controllers/schoolController.js
const School = require('../models/School');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const path = require('path');

// Configure multer for temporary file upload
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images are allowed (jpeg, jpg, png, gif)'));
        }
    }
});

// @desc    Get school profile (for logged-in user's school)
// @route   GET /api/school/profile
// @access  Private
exports.getSchoolProfile = async (req, res) => {
    try {
        const school = await School.findOne({ schoolCode: req.user.schoolCode })
            .populate('principal', 'name email phone')
            .lean();

        if (!school) {
            return res.status(404).json({ message: 'School not found' });
        }

        // Get counts
        const [teacherCount, studentCount, pendingTeacherCount] = await Promise.all([
            User.countDocuments({ schoolCode: req.user.schoolCode, role: 'teacher', isApproved: true }),
            User.countDocuments({ schoolCode: req.user.schoolCode, role: 'student' }),
            User.countDocuments({ schoolCode: req.user.schoolCode, role: 'teacher', isApproved: false })
        ]);

        res.json({
            ...school,
            stats: {
                teachers: teacherCount,
                students: studentCount,
                pendingTeachers: pendingTeacherCount
            }
        });

    } catch (error) {
        console.error('Get school profile error:', error);
        res.status(500).json({ message: 'Failed to fetch school profile' });
    }
};

// @desc    Update school settings (Principal/Admin only)
// @route   PUT /api/school/settings
// @access  Private
exports.updateSchoolSettings = async (req, res) => {
    const { schoolName, primaryColor, secondaryColor, address, phone, email, website, description } = req.body;

    try {
        // Check if user has permission (principal of that school or admin)
        if (req.user.role !== 'admin' && req.user.role !== 'principal') {
            return res.status(403).json({ message: 'Access denied. Principal or admin only.' });
        }

        const school = await School.findOne({ schoolCode: req.user.schoolCode });
        if (!school) {
            return res.status(404).json({ message: 'School not found' });
        }

        // Update fields if provided
        if (schoolName) school.schoolName = schoolName;
        if (primaryColor) school.primaryColor = primaryColor;
        if (secondaryColor) school.secondaryColor = secondaryColor;
        if (address) school.address = address;
        if (phone) school.phone = phone;
        if (email) school.email = email;
        if (website) school.website = website;
        if (description) school.description = description;

        await school.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'SCHOOL_SETTINGS_UPDATED',
            details: { schoolCode: school.schoolCode, updatedFields: Object.keys(req.body) },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ 
            message: 'School settings updated successfully', 
            school 
        });

    } catch (error) {
        console.error('Update school settings error:', error);
        res.status(500).json({ message: 'Failed to update school settings' });
    }
};

// @desc    Upload school logo (Principal/Admin only)
// @route   POST /api/school/logo
// @access  Private
exports.uploadLogo = async (req, res) => {
    try {
        // Check permission
        if (req.user.role !== 'admin' && req.user.role !== 'principal') {
            return res.status(403).json({ message: 'Access denied. Principal or admin only.' });
        }

        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const school = await School.findOne({ schoolCode: req.user.schoolCode });
        if (!school) {
            return res.status(404).json({ message: 'School not found' });
        }

        // If there's an existing logo, delete from cloudinary (optional)
        if (school.logo?.publicId) {
            await cloudinary.uploader.destroy(school.logo.publicId);
        }

        // Upload new logo to cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'schools',
            public_id: `logo_${school.schoolCode}_${Date.now()}`,
            width: 200,
            height: 200,
            crop: 'limit'
        });

        school.logo = {
            url: result.secure_url,
            publicId: result.public_id
        };
        await school.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'SCHOOL_LOGO_UPDATED',
            details: { schoolCode: school.schoolCode },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ 
            message: 'Logo uploaded successfully', 
            logo: school.logo 
        });

    } catch (error) {
        console.error('Upload logo error:', error);
        res.status(500).json({ message: 'Failed to upload logo' });
    }
};

// @desc    Update subscription (Admin only)
// @route   PUT /api/school/subscription/:schoolCode
// @access  Private (Admin only)
exports.updateSubscription = async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { schoolCode } = req.params;
    const { plan, status, startDate, endDate } = req.body;

    try {
        const school = await School.findOne({ schoolCode });
        if (!school) {
            return res.status(404).json({ message: 'School not found' });
        }

        school.subscription = {
            plan: plan || school.subscription?.plan || 'trial',
            status: status || school.subscription?.status || 'active',
            startDate: startDate ? new Date(startDate) : school.subscription?.startDate || new Date(),
            endDate: endDate ? new Date(endDate) : school.subscription?.endDate
        };
        await school.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'SUBSCRIPTION_UPDATED',
            details: { schoolCode, plan, status },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ message: 'Subscription updated', subscription: school.subscription });

    } catch (error) {
        console.error('Update subscription error:', error);
        res.status(500).json({ message: 'Failed to update subscription' });
    }
};

// @desc    Toggle school active status (Admin only)
// @route   PUT /api/school/toggle-status/:schoolCode
// @access  Private (Admin only)
exports.toggleSchoolStatus = async (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { schoolCode } = req.params;
    const { isActive } = req.body; // expecting boolean

    try {
        const school = await School.findOne({ schoolCode });
        if (!school) {
            return res.status(404).json({ message: 'School not found' });
        }

        school.isActive = isActive !== undefined ? isActive : !school.isActive;
        await school.save();

        // Also deactivate/activate all users of this school (optional)
        await User.updateMany(
            { schoolCode },
            { isActive: school.isActive }
        );

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: school.isActive ? 'SCHOOL_ACTIVATED' : 'SCHOOL_DEACTIVATED',
            details: { schoolCode },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ 
            message: `School ${school.isActive ? 'activated' : 'deactivated'} successfully`,
            isActive: school.isActive 
        });

    } catch (error) {
        console.error('Toggle school status error:', error);
        res.status(500).json({ message: 'Failed to update school status' });
    }
};

// @desc    Get school statistics (dashboard)
// @route   GET /api/school/stats
// @access  Private (Principal/Admin)
exports.getSchoolStats = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;

        const [
            totalTeachers,
            totalStudents,
            pendingTeachers,
            totalClasses,
            totalNotices,
            recentResults
        ] = await Promise.all([
            User.countDocuments({ schoolCode, role: 'teacher', isApproved: true }),
            User.countDocuments({ schoolCode, role: 'student' }),
            User.countDocuments({ schoolCode, role: 'teacher', isApproved: false }),
            // Assuming you have a Class model; if not, you can calculate from students distinct classes
            Student.distinct('studentClass', { schoolCode }).then(classes => classes.length),
            Notice.countDocuments({ schoolCode, isActive: true }),
            Result.find({ schoolCode })
                .sort({ createdAt: -1 })
                .limit(5)
                .populate('studentId', 'name')
                .lean()
        ]);

        res.json({
            teachers: totalTeachers,
            students: totalStudents,
            pendingTeachers,
            totalClasses,
            totalNotices,
            recentResults
        });

    } catch (error) {
        console.error('Get school stats error:', error);
        res.status(500).json({ message: 'Failed to fetch school statistics' });
    }
};

// Export multer upload middleware for routes
exports.upload = upload.single('logo');