const Teacher = require('../models/Teacher');
const User = require('../models/User');
const multer = require('multer');

// @desc    Get all teachers
// @route   GET /api/teachers
// @access  Private
exports.getTeachers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, class: className, subject } = req.query;
        const filter = { schoolCode: req.user.schoolCode };
        
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { subjects: { $in: [new RegExp(search, 'i')] } }
            ];
        }
        
        if (subject) {
            filter.subjects = { $in: [subject] };
        }
        
        const teachers = await Teacher.find(filter)
            .populate('userId', 'name email')
            .limit(limit * 1)
            .skip((page - 1) * limit)
            .sort({ createdAt: -1 });
            
        const total = await Teacher.countDocuments(filter);
        
        res.json({
            success: true,
            data: {
                teachers,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total,
                    pages: Math.ceil(total / limit)
                }
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get teacher by ID
// @route   GET /api/teachers/:id
// @access  Private
exports.getTeacherById = async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id)
            .populate('userId', 'name email phone');
            
        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher not found' });
        }
        
        // Check if user has access to this teacher's data
        if (teacher.schoolCode !== req.user.schoolCode && req.user.role !== 'super_admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        
        res.json({ success: true, data: teacher });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Create teacher
// @route   POST /api/teachers
// @access  Private (Principal, Admin)
exports.createTeacher = async (req, res) => {
    try {
        const {
            name,
            email,
            password,
            phone,
            qualification,
            experience,
            subjects,
            address,
            dateOfBirth,
            gender,
            emergencyContact
        } = req.body;
        
        // Check if email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }
        
        // Create user account
        const user = await User.create({
            name,
            email,
            password,
            role: 'teacher',
            schoolCode: req.user.schoolCode,
            phone,
            isApproved: true,
            emailVerified: true
        });
        
        // Create teacher profile
        const teacher = await Teacher.create({
            userId: user._id,
            schoolCode: req.user.schoolCode,
            qualification,
            experience,
            subjects: subjects || [],
            address,
            dateOfBirth,
            gender,
            emergencyContact
        });
        
        const populatedTeacher = await Teacher.findById(teacher._id)
            .populate('userId', 'name email phone');
        
        res.status(201).json({ 
            success: true, 
            data: populatedTeacher,
            message: 'Teacher created successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Update teacher
// @route   PUT /api/teachers/:id
// @access  Private
exports.updateTeacher = async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id);
        
        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher not found' });
        }
        
        // Check permissions
        if (req.user.role !== 'super_admin' && 
            (req.user.role !== 'principal' || teacher.schoolCode !== req.user.schoolCode) &&
            (req.user.role !== 'teacher' || teacher.userId.toString() !== req.user.id)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        
        const {
            qualification,
            experience,
            subjects,
            address,
            dateOfBirth,
            gender,
            emergencyContact,
            name,
            phone
        } = req.body;
        
        // Update teacher profile
        if (qualification) teacher.qualification = qualification;
        if (experience) teacher.experience = experience;
        if (subjects) teacher.subjects = subjects;
        if (address) teacher.address = address;
        if (dateOfBirth) teacher.dateOfBirth = dateOfBirth;
        if (gender) teacher.gender = gender;
        if (emergencyContact) teacher.emergencyContact = emergencyContact;
        
        await teacher.save();
        
        // Update user info if provided
        if (name || phone) {
            const userUpdate = {};
            if (name) userUpdate.name = name;
            if (phone) userUpdate.phone = phone;
            
            await User.findByIdAndUpdate(teacher.userId, userUpdate);
        }
        
        const updatedTeacher = await Teacher.findById(teacher._id)
            .populate('userId', 'name email phone');
        
        res.json({ 
            success: true, 
            data: updatedTeacher,
            message: 'Teacher updated successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Delete teacher
// @route   DELETE /api/teachers/:id
// @access  Private (Principal only)
exports.deleteTeacher = async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id);
        
        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher not found' });
        }
        
        // Check permissions
        if (req.user.role !== 'super_admin' && 
            (req.user.role !== 'principal' || teacher.schoolCode !== req.user.schoolCode)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        
        // Delete teacher profile
        await Teacher.findByIdAndDelete(teacher._id);
        
        // Delete user account
        await User.findByIdAndDelete(teacher.userId);
        
        res.json({ 
            success: true, 
            message: 'Teacher deleted successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Assign subjects to teacher
// @route   POST /api/teachers/:id/subjects
// @access  Private (Principal, Admin)
exports.assignSubjects = async (req, res) => {
    try {
        const { subjects } = req.body;
        
        const teacher = await Teacher.findById(req.params.id);
        
        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher not found' });
        }
        
        // Check permissions
        if (req.user.role !== 'super_admin' && 
            (req.user.role !== 'principal' || teacher.schoolCode !== req.user.schoolCode)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        
        teacher.subjects = subjects;
        await teacher.save();
        
        const updatedTeacher = await Teacher.findById(teacher._id)
            .populate('userId', 'name email');
        
        res.json({ 
            success: true, 
            data: updatedTeacher,
            message: 'Subjects assigned successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Get teacher schedule
// @route   GET /api/teachers/:id/schedule
// @access  Private
exports.getTeacherSchedule = async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id);
        
        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher not found' });
        }
        
        // Check permissions
        if (req.user.role !== 'super_admin' && 
            (req.user.role !== 'principal' || teacher.schoolCode !== req.user.schoolCode) &&
            (req.user.role !== 'teacher' || teacher.userId.toString() !== req.user.id)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        
        // Get teacher's schedule from routine
        const Routine = require('../models/Routine');
        const schedule = await Routine.find({
            schoolCode: teacher.schoolCode,
            'periods.teacher': teacher.userId.toString()
        }).select('day periods');
        
        res.json({ success: true, data: schedule });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// @desc    Upload teacher photo
// @route   POST /api/teachers/:id/photo
// @access  Private
exports.uploadPhoto = async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.params.id);
        
        if (!teacher) {
            return res.status(404).json({ success: false, message: 'Teacher not found' });
        }
        
        // Check permissions
        if (req.user.role !== 'super_admin' && 
            (req.user.role !== 'principal' || teacher.schoolCode !== req.user.schoolCode) &&
            (req.user.role !== 'teacher' || teacher.userId.toString() !== req.user.id)) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }
        
        // Update teacher profile with photo URL
        teacher.profileImage = req.file.path;
        await teacher.save();
        
        res.json({ 
            success: true, 
            data: { profileImage: teacher.profileImage },
            message: 'Photo uploaded successfully'
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
