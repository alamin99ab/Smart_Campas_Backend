// controllers/adminController.js
const School = require('../models/School');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const bcrypt = require('bcryptjs');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

// @desc    Create School & Principal
// @route   POST /api/admin/school
// @access  Private (Super Admin only)
exports.createSchool = async (req, res) => {
    const { schoolName, schoolCode, principalEmail, principalPassword, amountPaid, address, phone, subscriptionPlan } = req.body;
    
    try {
        // Validation
        if (!schoolName || !schoolCode || !principalEmail || !principalPassword) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check existing
        const existingSchool = await School.findOne({ schoolCode });
        if (existingSchool) {
            return res.status(400).json({ message: 'School code already exists' });
        }

        const existingUser = await User.findOne({ email: principalEmail });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already exists' });
        }

        // Transaction
        const session = await School.startSession();
        session.startTransaction();

        try {
            // Create school
            const school = await School.create([{
                schoolName,
                schoolCode,
                address,
                phone,
                amountPaid: amountPaid || 0,
                subscription: {
                    plan: subscriptionPlan || 'trial',
                    status: 'active',
                    startDate: new Date(),
                    endDate: subscriptionPlan === 'trial' 
                        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                        : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
                }
            }], { session });

            // Hash password
            const hashedPassword = await bcrypt.hash(principalPassword, 12);

            // Create principal
            await User.create([{
                name: `${schoolName} Principal`,
                email: principalEmail,
                password: hashedPassword,
                role: 'principal',
                schoolCode,
                schoolName,
                phone,
                isApproved: true,
                emailVerified: true,
                permissions: ['manage_all', 'approve_teachers', 'view_reports']
            }], { session });

            await session.commitTransaction();

            // Audit log
            await AuditLog.create({
                user: req.user._id,
                action: 'SCHOOL_CREATED',
                details: { schoolCode, schoolName },
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });

            res.status(201).json({ 
                message: 'School and Principal created successfully',
                school: school[0]
            });

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }

    } catch (error) {
        console.error('Create school error:', error);
        res.status(500).json({ message: 'Failed to create school' });
    }
};

// @desc    Update School
// @route   PUT /api/admin/school/:id
// @access  Private (Super Admin only)
exports.updateSchool = async (req, res) => {
    const { schoolName, address, phone, subscriptionPlan, isActive } = req.body;
    
    try {
        const school = await School.findById(req.params.id);
        
        if (!school) {
            return res.status(404).json({ message: 'School not found' });
        }

        // Update fields
        if (schoolName) school.schoolName = schoolName;
        if (address) school.address = address;
        if (phone) school.phone = phone;
        if (isActive !== undefined) school.isActive = isActive;
        
        if (subscriptionPlan) {
            school.subscription.plan = subscriptionPlan;
            if (subscriptionPlan === 'trial') {
                school.subscription.endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            } else {
                school.subscription.endDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
            }
        }

        await school.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'SCHOOL_UPDATED',
            details: { schoolId: school._id, schoolCode: school.schoolCode },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ message: 'School updated successfully', school });

    } catch (error) {
        console.error('Update school error:', error);
        res.status(500).json({ message: 'Failed to update school' });
    }
};

// @desc    Delete School
// @route   DELETE /api/admin/school/:id
// @access  Private (Super Admin only)
exports.deleteSchool = async (req, res) => {
    try {
        const school = await School.findById(req.params.id);
        
        if (!school) {
            return res.status(404).json({ message: 'School not found' });
        }

        // Soft delete (or hard delete - be careful!)
        school.isActive = false;
        await school.save();

        // Also deactivate all users from this school
        await User.updateMany(
            { schoolCode: school.schoolCode },
            { isActive: false, isApproved: false }
        );

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'SCHOOL_DELETED',
            details: { schoolCode: school.schoolCode, schoolName: school.schoolName },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ message: 'School deleted successfully' });

    } catch (error) {
        console.error('Delete school error:', error);
        res.status(500).json({ message: 'Failed to delete school' });
    }
};

// @desc    Upload School Logo
// @route   POST /api/admin/school/:id/logo
// @access  Private (Super Admin/Principal)
exports.uploadSchoolLogo = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Upload to cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'schools',
            public_id: `school_${req.params.id}`,
            overwrite: true
        });

        // Update school
        const school = await School.findById(req.params.id);
        school.logo = {
            url: result.secure_url,
            publicId: result.public_id
        };
        await school.save();

        res.json({ 
            message: 'Logo uploaded successfully',
            logo: school.logo
        });

    } catch (error) {
        console.error('Upload logo error:', error);
        res.status(500).json({ message: 'Failed to upload logo' });
    }
};

// @desc    Get All Schools
// @route   GET /api/admin/schools
// @access  Private (Super Admin only)
exports.getAllSchools = async (req, res) => {
    const { page = 1, limit = 10, search, status } = req.query;
    
    try {
        const query = {};
        
        if (search) {
            query.$or = [
                { schoolName: { $regex: search, $options: 'i' } },
                { schoolCode: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (status === 'active') query.isActive = true;
        if (status === 'inactive') query.isActive = false;

        const schools = await School.find(query)
            .populate({
                path: 'principal',
                select: 'name email phone'
            })
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await School.countDocuments(query);

        res.json({
            schools,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });

    } catch (error) {
        console.error('Get schools error:', error);
        res.status(500).json({ message: 'Failed to fetch schools' });
    }
};

// @desc    Get Single School
// @route   GET /api/admin/school/:id
// @access  Private (Super Admin/Principal)
exports.getSchool = async (req, res) => {
    try {
        const school = await School.findById(req.params.id)
            .populate({
                path: 'principal',
                select: 'name email phone'
            });

        if (!school) {
            return res.status(404).json({ message: 'School not found' });
        }

        // Get statistics
        const stats = await Promise.all([
            User.countDocuments({ schoolCode: school.schoolCode, role: 'teacher' }),
            User.countDocuments({ schoolCode: school.schoolCode, role: 'student' }),
            User.countDocuments({ schoolCode: school.schoolCode, role: 'teacher', isApproved: false })
        ]);

        res.json({
            school,
            stats: {
                totalTeachers: stats[0],
                totalStudents: stats[1],
                pendingTeachers: stats[2]
            }
        });

    } catch (error) {
        console.error('Get school error:', error);
        res.status(500).json({ message: 'Failed to fetch school' });
    }
};

// @desc    Get Dashboard Stats
// @route   GET /api/admin/stats
// @access  Private (Super Admin only)
exports.getStats = async (req, res) => {
    try {
        const [totalSchools, activeSchools, totalUsers, monthlyData] = await Promise.all([
            School.countDocuments(),
            School.countDocuments({ isActive: true }),
            User.countDocuments(),
            School.aggregate([
                {
                    $group: {
                        _id: { 
                            year: { $year: '$createdAt' },
                            month: { $month: '$createdAt' }
                        },
                        count: { $sum: 1 },
                        totalAmount: { $sum: '$amountPaid' }
                    }
                },
                { $sort: { '_id.year': -1, '_id.month': -1 } },
                { $limit: 12 }
            ])
        ]);

        // Subscription stats
        const subscriptionStats = await School.aggregate([
            {
                $group: {
                    _id: '$subscription.plan',
                    count: { $sum: 1 }
                }
            }
        ]);

        res.json({
            totalSchools,
            activeSchools,
            totalUsers,
            monthlyData,
            subscriptionStats
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ message: 'Failed to fetch statistics' });
    }
};

// @desc    Export Schools to Excel
// @route   GET /api/admin/schools/export
// @access  Private (Super Admin only)
exports.exportSchools = async (req, res) => {
    try {
        const schools = await School.find()
            .populate('principal', 'name email phone')
            .lean();

        // Create Excel file
        const Excel = require('exceljs');
        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet('Schools');

        // Add headers
        worksheet.columns = [
            { header: 'School Name', key: 'schoolName', width: 30 },
            { header: 'School Code', key: 'schoolCode', width: 15 },
            { header: 'Principal', key: 'principalName', width: 20 },
            { header: 'Principal Email', key: 'principalEmail', width: 25 },
            { header: 'Phone', key: 'phone', width: 15 },
            { header: 'Subscription Plan', key: 'plan', width: 15 },
            { header: 'Status', key: 'status', width: 10 },
            { header: 'Created At', key: 'createdAt', width: 20 }
        ];

        // Add rows
        schools.forEach(school => {
            worksheet.addRow({
                schoolName: school.schoolName,
                schoolCode: school.schoolCode,
                principalName: school.principal?.name || 'N/A',
                principalEmail: school.principal?.email || 'N/A',
                phone: school.phone || 'N/A',
                plan: school.subscription?.plan || 'N/A',
                status: school.isActive ? 'Active' : 'Inactive',
                createdAt: school.createdAt.toLocaleDateString()
            });
        });

        // Set response headers
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=schools.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Export schools error:', error);
        res.status(500).json({ message: 'Failed to export schools' });
    }
};