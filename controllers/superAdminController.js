/**
 * 🏢 SUPER ADMIN CONTROLLER
 * Industry-level Super Admin management for Smart Campus System
 */

const School = require('../models/School');
const User = require('../models/User');
const Class = require('../models/Class');
const Subject = require('../models/Subject');
const Routine = require('../models/Routine');
const AuditLog = require('../models/AuditLog');

/**
 * @desc    Create new school
 * @route   POST /api/super-admin/schools
 * @access  Super Admin only
 */
exports.createSchool = async (req, res) => {
    try {
        const { 
            schoolName, 
            schoolCode, 
            address, 
            phone, 
            email,
            principalName,
            principalEmail,
            principalPhone,
            principalPassword
        } = req.body;

        // Check if school code already exists
        const existingSchool = await School.findOne({ schoolCode });
        if (existingSchool) {
            return res.status(400).json({
                success: false,
                message: 'School code already exists'
            });
        }

        // Create school
        const school = new School({
            schoolName,
            schoolCode,
            address,
            phone,
            email,
            status: 'Active',
            subscriptionType: 'Premium',
            maxStudents: 2000,
            isActive: true
        });

        await school.save();

        // Create principal account
        const bcrypt = require('bcryptjs');
        const salt = await bcrypt.genSalt(12);
        const hashedPassword = await bcrypt.hash(principalPassword, salt);

        const principal = new User({
            name: principalName,
            email: principalEmail,
            password: hashedPassword,
            role: 'principal',
            phone: principalPhone,
            schoolCode: schoolCode,
            isActive: true,
            isEmailVerified: true,
            permissions: [
                'manage_students',
                'manage_teachers',
                'manage_classes',
                'manage_subjects',
                'manage_routine',
                'view_reports',
                'manage_attendance',
                'manage_results'
            ]
        });

        await principal.save();

        // Update school with principal
        school.principalId = principal._id;
        await school.save();

        // Log audit
        await AuditLog.create({
            userId: req.user.id,
            action: 'CREATE_SCHOOL',
            details: `Created school: ${schoolName} (${schoolCode})`,
            schoolCode: schoolCode
        });

        res.status(201).json({
            success: true,
            message: 'School and principal created successfully',
            data: {
                school,
                principal: {
                    id: principal._id,
                    name: principal.name,
                    email: principal.email,
                    role: principal.role
                }
            }
        });

    } catch (error) {
        console.error('Error creating school:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating school',
            error: error.message
        });
    }
};

/**
 * @desc    Get all schools
 * @route   GET /api/super-admin/schools
 * @access  Super Admin only
 */
exports.getAllSchools = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, status } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = {};
        if (search) {
            query.$or = [
                { schoolName: { $regex: search, $options: 'i' } },
                { schoolCode: { $regex: search, $options: 'i' } }
            ];
        }
        if (status) {
            query.status = status;
        }

        const schools = await School.find(query)
            .populate('principalId', 'name email phone')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await School.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                schools,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Error getting schools:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving schools',
            error: error.message
        });
    }
};

/**
 * @desc    Update school
 * @route   PUT /api/super-admin/schools/:id
 * @access  Super Admin only
 */
exports.updateSchool = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const school = await School.findByIdAndUpdate(
            id,
            { ...updates, lastModifiedBy: req.user.id },
            { new: true, runValidators: true }
        );

        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        // Log audit
        await AuditLog.create({
            userId: req.user.id,
            action: 'UPDATE_SCHOOL',
            details: `Updated school: ${school.schoolName} (${school.schoolCode})`,
            schoolCode: school.schoolCode
        });

        res.status(200).json({
            success: true,
            message: 'School updated successfully',
            data: school
        });

    } catch (error) {
        console.error('Error updating school:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating school',
            error: error.message
        });
    }
};

/**
 * @desc    Delete school
 * @route   DELETE /api/super-admin/schools/:id
 * @access  Super Admin only
 */
exports.deleteSchool = async (req, res) => {
    try {
        const { id } = req.params;

        const school = await School.findById(id);
        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        // Check if school has active students
        const activeStudents = await User.countDocuments({
            schoolCode: school.schoolCode,
            role: 'student',
            isActive: true
        });

        if (activeStudents > 0) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete school with active students'
            });
        }

        await School.findByIdAndDelete(id);

        // Log audit
        await AuditLog.create({
            userId: req.user.id,
            action: 'DELETE_SCHOOL',
            details: `Deleted school: ${school.schoolName} (${school.schoolCode})`,
            schoolCode: school.schoolCode
        });

        res.status(200).json({
            success: true,
            message: 'School deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting school:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting school',
            error: error.message
        });
    }
};

/**
 * @desc    Get system analytics
 * @route   GET /api/super-admin/analytics
 * @access  Super Admin only
 */
exports.getSystemAnalytics = async (req, res) => {
    try {
        const totalSchools = await School.countDocuments();
        const activeSchools = await School.countDocuments({ isActive: true });
        const totalPrincipals = await User.countDocuments({ role: 'principal' });
        const totalTeachers = await User.countDocuments({ role: 'teacher' });
        const totalStudents = await User.countDocuments({ role: 'student' });
        const activeStudents = await User.countDocuments({ 
            role: 'student', 
            isActive: true 
        });

        // Get recent activity
        const recentActivity = await AuditLog.find()
            .populate('userId', 'name role')
            .sort({ createdAt: -1 })
            .limit(10);

        // Get school distribution by type
        const schoolsByType = await School.aggregate([
            { $group: { _id: '$subscriptionType', count: { $sum: 1 } } }
        ]);

        // Get student growth (last 6 months)
        const studentGrowth = await User.aggregate([
            {
                $match: {
                    role: 'student',
                    createdAt: { $gte: new Date(Date.now() - 6 * 30 * 24 * 60 * 60 * 1000) }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
                    count: { $sum: 1 }
                },
                sort: { _id: 1 }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    totalSchools,
                    activeSchools,
                    totalPrincipals,
                    totalTeachers,
                    totalStudents,
                    activeStudents
                },
                recentActivity,
                schoolsByType,
                studentGrowth
            }
        });

    } catch (error) {
        console.error('Error getting analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving analytics',
            error: error.message
        });
    }
};

/**
 * @desc    Get all users across all schools
 * @route   GET /api/super-admin/users
 * @access  Super Admin only
 */
exports.getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, role, search, schoolCode } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = {};
        if (role) query.role = role;
        if (schoolCode) query.schoolCode = schoolCode;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));

        const total = await User.countDocuments(query);

        res.status(200).json({
            success: true,
            data: {
                users,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });

    } catch (error) {
        console.error('Error getting users:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving users',
            error: error.message
        });
    }
};
