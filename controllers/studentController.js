// controllers/studentController.js
const Student = require('../models/Student');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const Excel = require('exceljs');
const PDFDocument = require('pdfkit');
const cloudinary = require('../config/cloudinary');
const multer = require('multer');
const path = require('path');

// Multer setup for photo upload
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images are allowed (jpeg, jpg, png)'));
        }
    }
});

// Helper: Validate class and section
const validateClassSection = (studentClass, section) => {
    // You can define allowed classes and sections in config
    const allowedClasses = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    const allowedSections = ['A', 'B', 'C'];
    if (!allowedClasses.includes(studentClass)) {
        return 'Invalid class';
    }
    if (section && !allowedSections.includes(section)) {
        return 'Invalid section';
    }
    return null;
};

// @desc    Add new student
// @route   POST /api/students
// @access  Private (Teacher/Principal/Admin)
exports.addStudent = async (req, res) => {
    const { 
        name, 
        roll, 
        studentClass, 
        section,
        fatherName,
        motherName,
        dateOfBirth,
        gender,
        address,
        phone,
        guardianName,
        guardianPhone,
        email,
        emergencyContact
    } = req.body;

    try {
        // Validation
        if (!name || !roll || !studentClass) {
            return res.status(400).json({ message: 'Name, roll and class are required' });
        }

        // Check class validity
        const classError = validateClassSection(studentClass, section);
        if (classError) {
            return res.status(400).json({ message: classError });
        }

        // Check if student with same roll and class exists in this school
        const existing = await Student.findOne({
            schoolCode: req.user.schoolCode,
            studentClass,
            roll: Number(roll)
        });
        if (existing) {
            return res.status(400).json({ message: 'Student with this roll already exists in this class' });
        }

        // Create student
        const student = await Student.create({
            name,
            roll: Number(roll),
            studentClass,
            section: section || null,
            fatherName,
            motherName,
            dateOfBirth,
            gender,
            address,
            phone,
            guardian: {
                name: guardianName,
                phone: guardianPhone,
                email
            },
            emergencyContact,
            schoolCode: req.user.schoolCode,
            addedBy: req.user._id
        });

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'STUDENT_ADDED',
            details: { studentId: student._id, name: student.name, roll: student.roll, class: student.studentClass },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(201).json({ 
            message: 'Student added successfully', 
            student 
        });

    } catch (error) {
        console.error('Add student error:', error);
        res.status(500).json({ message: 'Failed to add student' });
    }
};

// @desc    Get all students (with filters & pagination)
// @route   GET /api/students
// @access  Private
exports.getStudents = async (req, res) => {
    try {
        const { 
            class: className, 
            section, 
            search, 
            page = 1, 
            limit = 20 
        } = req.query;

        let query = { schoolCode: req.user.schoolCode };

        if (className) query.studentClass = className;
        if (section) query.section = section;
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { roll: isNaN(search) ? undefined : Number(search) },
                { fatherName: { $regex: search, $options: 'i' } }
            ].filter(Boolean);
        }

        const skip = (page - 1) * limit;

        const students = await Student.find(query)
            .populate('addedBy', 'name')
            .sort({ studentClass: 1, section: 1, roll: 1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await Student.countDocuments(query);

        res.json({
            students,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });

    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ message: 'Failed to fetch students' });
    }
};

// @desc    Get single student by ID
// @route   GET /api/students/:id
// @access  Private
exports.getStudentById = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id)
            .populate('addedBy', 'name email')
            .populate('updatedBy', 'name email');

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Check school access
        if (student.schoolCode !== req.user.schoolCode && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(student);

    } catch (error) {
        console.error('Get student error:', error);
        res.status(500).json({ message: 'Failed to fetch student' });
    }
};

// @desc    Update student
// @route   PUT /api/students/:id
// @access  Private (Teacher/Principal/Admin)
exports.updateStudent = async (req, res) => {
    try {
        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Check school access
        if (student.schoolCode !== req.user.schoolCode && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const { 
            name, roll, studentClass, section, fatherName, motherName,
            dateOfBirth, gender, address, phone, guardianName, guardianPhone,
            email, emergencyContact
        } = req.body;

        // If roll/class is being changed, check for duplicates
        if ((roll && roll !== student.roll) || (studentClass && studentClass !== student.studentClass)) {
            const existing = await Student.findOne({
                schoolCode: student.schoolCode,
                studentClass: studentClass || student.studentClass,
                roll: Number(roll || student.roll),
                _id: { $ne: student._id }
            });
            if (existing) {
                return res.status(400).json({ message: 'Student with this roll already exists in this class' });
            }
        }

        // Update fields
        if (name) student.name = name;
        if (roll) student.roll = Number(roll);
        if (studentClass) student.studentClass = studentClass;
        if (section !== undefined) student.section = section;
        if (fatherName) student.fatherName = fatherName;
        if (motherName) student.motherName = motherName;
        if (dateOfBirth) student.dateOfBirth = dateOfBirth;
        if (gender) student.gender = gender;
        if (address) student.address = address;
        if (phone) student.phone = phone;
        if (guardianName || guardianPhone || email) {
            student.guardian = {
                name: guardianName || student.guardian?.name,
                phone: guardianPhone || student.guardian?.phone,
                email: email || student.guardian?.email
            };
        }
        if (emergencyContact) student.emergencyContact = emergencyContact;

        student.updatedBy = req.user._id;
        student.updatedAt = Date.now();

        await student.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'STUDENT_UPDATED',
            details: { studentId: student._id, name: student.name },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ 
            message: 'Student updated successfully', 
            student 
        });

    } catch (error) {
        console.error('Update student error:', error);
        res.status(500).json({ message: 'Failed to update student' });
    }
};

// @desc    Delete student (soft delete)
// @route   DELETE /api/students/:id
// @access  Private (Principal/Admin)
exports.deleteStudent = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Principal or admin only.' });
        }

        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        if (student.schoolCode !== req.user.schoolCode && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Soft delete: set isActive false or remove?
        // Option 1: Hard delete (permanent)
        // await student.deleteOne();

        // Option 2: Soft delete (mark as inactive)
        student.isActive = false;
        await student.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'STUDENT_DELETED',
            details: { studentId: student._id, name: student.name },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ message: 'Student deleted successfully' });

    } catch (error) {
        console.error('Delete student error:', error);
        res.status(500).json({ message: 'Failed to delete student' });
    }
};

// @desc    Upload student photo
// @route   POST /api/students/:id/photo
// @access  Private (Teacher/Principal/Admin)
exports.uploadPhoto = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const student = await Student.findById(req.params.id);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Check school access
        if (student.schoolCode !== req.user.schoolCode && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Delete old photo from cloudinary if exists
        if (student.photo?.publicId) {
            await cloudinary.uploader.destroy(student.photo.publicId);
        }

        // Upload new photo
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'students',
            public_id: `student_${student._id}_${Date.now()}`,
            width: 300,
            height: 300,
            crop: 'limit'
        });

        student.photo = {
            url: result.secure_url,
            publicId: result.public_id
        };
        await student.save();

        res.json({ 
            message: 'Photo uploaded successfully', 
            photo: student.photo 
        });

    } catch (error) {
        console.error('Upload photo error:', error);
        res.status(500).json({ message: 'Failed to upload photo' });
    }
};

// @desc    Get students by class (for attendance etc.)
// @route   GET /api/students/by-class
// @access  Private
exports.getStudentsByClass = async (req, res) => {
    try {
        const { class: className, section } = req.query;
        if (!className) {
            return res.status(400).json({ message: 'Class is required' });
        }

        const students = await Student.find({
            schoolCode: req.user.schoolCode,
            studentClass: className,
            ...(section && { section }),
            isActive: true
        })
        .select('name roll section fatherName motherName photo')
        .sort({ roll: 1 })
        .lean();

        res.json(students);

    } catch (error) {
        console.error('Get students by class error:', error);
        res.status(500).json({ message: 'Failed to fetch students' });
    }
};

// @desc    Export students to Excel
// @route   GET /api/students/export
// @access  Private (Principal/Admin)
exports.exportStudents = async (req, res) => {
    try {
        const { class: className, section } = req.query;

        let query = { schoolCode: req.user.schoolCode, isActive: true };
        if (className) query.studentClass = className;
        if (section) query.section = section;

        const students = await Student.find(query)
            .sort({ studentClass: 1, section: 1, roll: 1 })
            .lean();

        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet('Students');

        worksheet.columns = [
            { header: 'Name', key: 'name', width: 25 },
            { header: 'Roll', key: 'roll', width: 10 },
            { header: 'Class', key: 'studentClass', width: 10 },
            { header: 'Section', key: 'section', width: 10 },
            { header: "Father's Name", key: 'fatherName', width: 20 },
            { header: "Mother's Name", key: 'motherName', width: 20 },
            { header: 'Date of Birth', key: 'dateOfBirth', width: 15 },
            { header: 'Gender', key: 'gender', width: 10 },
            { header: 'Phone', key: 'phone', width: 15 },
            { header: 'Guardian Name', key: 'guardianName', width: 20 },
            { header: 'Guardian Phone', key: 'guardianPhone', width: 15 },
            { header: 'Email', key: 'email', width: 25 }
        ];

        students.forEach(s => {
            worksheet.addRow({
                name: s.name,
                roll: s.roll,
                studentClass: s.studentClass,
                section: s.section || '',
                fatherName: s.fatherName || '',
                motherName: s.motherName || '',
                dateOfBirth: s.dateOfBirth ? new Date(s.dateOfBirth).toLocaleDateString() : '',
                gender: s.gender || '',
                phone: s.phone || '',
                guardianName: s.guardian?.name || '',
                guardianPhone: s.guardian?.phone || '',
                email: s.guardian?.email || ''
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=students_${className || 'all'}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Export students error:', error);
        res.status(500).json({ message: 'Failed to export students' });
    }
};

// Export multer middleware
exports.upload = upload.single('photo');