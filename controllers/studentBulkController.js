/**
 * 🎓 STUDENT BULK IMPORT CONTROLLER
 * Bulk student upload with validation
 */

const Student = require('../models/Student');
const User = require('../models/User');
const School = require('../models/School');
const Class = require('../models/Class');
const { createNotification } = require('../utils/createNotification');
const csvParser = require('csv-parse/lib/sync');
const xlstojson = require('xls-to-json');

// @desc    Upload and parse student file
// @route   POST /api/students/parse-file
// @access  Private (Principal)
exports.parseStudentFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        const schoolCode = req.user.schoolCode;
        const { format = 'csv' } = req.body;

        let students = [];
        const errors = [];
        const validRows = [];

        // Parse file based on format
        if (format === 'csv' || req.file.originalname.endsWith('.csv')) {
            students = csvParser(req.file.buffer.toString('utf-8'), {
                columns: true,
                skip_empty_lines: true,
                trim: true
            });
        } else if (format === 'json' || req.file.originalname.endsWith('.json')) {
            students = JSON.parse(req.file.buffer.toString('utf-8'));
        } else if (format === 'xlsx' || req.file.originalname.endsWith('.xlsx') || req.file.originalname.endsWith('.xls')) {
            students = xlstojson({}).on('data', (data) => students.push(data)).end(req.file.buffer);
        }

        if (!Array.isArray(students) || students.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No valid data found in file'
            });
        }

        // Validate each row
        const rowNumbers = [];
        for (let i = 0; i < students.length; i++) {
            const student = students[i];
            const rowNum = i + 2; // +2 for header row and 0-index

            const rowErrors = [];

            // Required fields
            if (!student.name || student.name.trim() === '') {
                rowErrors.push('Name is required');
            }
            if (!student.roll || isNaN(parseInt(student.roll))) {
                rowErrors.push('Valid roll number is required');
            }
            if (!student.class && !student.studentClass) {
                rowErrors.push('Class is required');
            }

            // Optional fields - validate if provided
            if (student.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(student.email)) {
                rowErrors.push('Invalid email format');
            }
            if (student.phone && !/^\+?[\d\s-]{10,}$/.test(student.phone)) {
                rowErrors.push('Invalid phone format');
            }
            if (student.gender && !['male', 'female', 'other', 'Male', 'Female', 'Other'].includes(student.gender)) {
                rowErrors.push('Invalid gender (must be Male, Female, or Other)');
            }

            if (rowErrors.length > 0) {
                errors.push({
                    row: rowNum,
                    data: student,
                    errors: rowErrors
                });
            } else {
                // Check for duplicates
                const className = student.class || student.studentClass;
                const section = student.section || 'A';
                const roll = parseInt(student.roll);

                const existingStudent = await Student.findOne({
                    schoolCode,
                    studentClass: className,
                    section,
                    roll,
                    isActive: true
                });

                if (existingStudent) {
                    errors.push({
                        row: rowNum,
                        data: student,
                        errors: [`Duplicate: Student with roll ${roll} already exists in Class ${className}-${section}`]
                    });
                } else {
                    validRows.push({
                        row: rowNum,
                        ...student,
                        className,
                        section,
                        roll
                    });
                }
            }
        }

        res.json({
            success: true,
            message: `Parsed ${students.length} rows: ${validRows.length} valid, ${errors.length} with errors`,
            data: {
                total: students.length,
                valid: validRows.length,
                errors: errors.length,
                validRows: validRows.slice(0, 10), // Preview first 10
                errorRows: errors.slice(0, 10) // Show first 10 errors
            }
        });
    } catch (error) {
        console.error('Parse student file error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to parse file',
            error: error.message
        });
    }
};

// @desc    Import students from validated data
// @route   POST /api/students/import
// @access  Private (Principal)
exports.importStudents = async (req, res) => {
    try {
        const { students } = req.body;
        const schoolCode = req.user.schoolCode;

        if (!students || !Array.isArray(students) || students.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No students to import'
            });
        }

        // Get school to verify subscription
        const school = await School.findOne({ schoolCode });
        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        // Check subscription for bulk import feature
        const subscription = school.subscription;
        if (!subscription || subscription.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'Active subscription required for bulk import'
            });
        }

        // Check feature flag
        if (subscription.plan === 'trial' || subscription.plan === 'basic') {
            return res.status(403).json({
                success: false,
                message: 'Bulk import is not available in your current plan'
            });
        }

        const imported = [];
        const skipped = [];
        const errors = [];

        for (const studentData of students) {
            try {
                const className = studentData.className || studentData.studentClass || studentData.class;
                const section = studentData.section || 'A';
                const roll = parseInt(studentData.roll);

                // Final duplicate check
                const existing = await Student.findOne({
                    schoolCode,
                    studentClass: className,
                    section,
                    roll,
                    isActive: true
                });

                if (existing) {
                    skipped.push({
                        name: studentData.name,
                        reason: 'Duplicate'
                    });
                    continue;
                }

                // Create student
                const student = new Student({
                    name: studentData.name.trim(),
                    roll,
                    studentClass: className,
                    section,
                    fatherName: studentData.fatherName || studentData.father_name || '',
                    motherName: studentData.motherName || studentData.mother_name || '',
                    dateOfBirth: studentData.dateOfBirth || studentData.dob ? new Date(studentData.dateOfBirth || studentData.dob) : null,
                    gender: studentData.gender ? studentData.gender.charAt(0).toUpperCase() + studentData.gender.slice(1).toLowerCase() : 'Male',
                    address: studentData.address || '',
                    phone: studentData.phone || '',
                    guardian: {
                        name: studentData.guardianName || studentData.guardian_name || studentData.fatherName || '',
                        phone: studentData.guardianPhone || studentData.guardian_phone || studentData.fatherPhone || studentData.father_phone || '',
                        email: studentData.guardianEmail || studentData.guardian_email || ''
                    },
                    schoolCode,
                    addedBy: req.user._id,
                    isActive: true
                });

                await student.save();
                imported.push({
                    name: student.name,
                    roll: student.roll,
                    class: student.studentClass,
                    section: student.section
                });

                // Create login account for student if email provided
                if (studentData.email || studentData.guardianEmail || studentData.guardian_email) {
                    const email = studentData.email || studentData.guardianEmail || studentData.guardian_email;
                    const existingUser = await User.findOne({ email });
                    
                    if (!existingUser) {
                        const user = new User({
                            name: student.name,
                            email,
                            role: 'student',
                            schoolCode,
                            phone: student.guardian?.phone || student.phone,
                            isApproved: true,
                            emailVerified: true
                        });
                        await user.save();
                    }
                }
            } catch (err) {
                errors.push({
                    name: studentData.name,
                    error: err.message
                });
            }
        }

        // Update school stats
        school.stats = school.stats || { totalStudents: 0 };
        school.stats.totalStudents += imported.length;
        await school.save();

        res.json({
            success: true,
            message: `Import completed: ${imported.length} imported, ${skipped.length} skipped, ${errors.length} errors`,
            data: {
                imported: imported.length,
                skipped: skipped.length,
                errors: errors.length,
                details: {
                    imported: imported,
                    skipped: skipped,
                    errors: errors
                }
            }
        });
    } catch (error) {
        console.error('Import students error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to import students',
            error: error.message
        });
    }
};

// @desc    Download student import template
// @route   GET /api/students/template
// @access  Private (Principal)
exports.getTemplate = async (req, res) => {
    try {
        const { format = 'csv' } = req.query;

        const templateData = [
            {
                name: 'John Doe',
                roll: '1',
                class: '6',
                section: 'A',
                fatherName: 'Robert Doe',
                motherName: 'Mary Doe',
                dateOfBirth: '2010-01-15',
                gender: 'Male',
                phone: '+1234567890',
                address: '123 Main Street, City',
                guardianName: 'Robert Doe',
                guardianPhone: '+1234567890',
                guardianEmail: 'parent@example.com'
            },
            {
                name: 'Jane Smith',
                roll: '2',
                class: '6',
                section: 'A',
                fatherName: 'William Smith',
                motherName: 'Sarah Smith',
                dateOfBirth: '2010-03-20',
                gender: 'Female',
                phone: '+1234567891',
                address: '456 Oak Avenue, City',
                guardianName: 'William Smith',
                guardianPhone: '+1234567891',
                guardianEmail: 'parent2@example.com'
            }
        ];

        if (format === 'json') {
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', 'attachment; filename=student_template.json');
            return res.json(templateData);
        }

        // CSV format
        const headers = ['name', 'roll', 'class', 'section', 'fatherName', 'motherName', 'dateOfBirth', 'gender', 'phone', 'address', 'guardianName', 'guardianPhone', 'guardianEmail'];
        
        let csv = headers.join(',') + '\n';
        for (const row of templateData) {
            csv += headers.map(h => {
                const value = row[h] || '';
                return `"${String(value).replace(/"/g, '""')}"`;
            }).join(',') + '\n';
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=student_template.csv');
        res.send(csv);
    } catch (error) {
        console.error('Get template error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate template',
            error: error.message
        });
    }
};

// @desc    Validate student data before import
// @route   POST /api/students/validate
// @access  Private (Principal)
exports.validateStudents = async (req, res) => {
    try {
        const { students } = req.body;
        const schoolCode = req.user.schoolCode;

        if (!students || !Array.isArray(students)) {
            return res.status(400).json({
                success: false,
                message: 'Students array is required'
            });
        }

        const validated = [];
        const errors = [];

        for (let i = 0; i < students.length; i++) {
            const student = students[i];
            const rowErrors = [];

            // Required validation
            if (!student.name) rowErrors.push('Name is required');
            if (!student.roll) rowErrors.push('Roll is required');
            if (!student.class && !student.studentClass) rowErrors.push('Class is required');

            // Class existence check
            const className = student.class || student.studentClass;
            if (className) {
                const classExists = await Class.findOne({
                    schoolCode,
                    className,
                    section: student.section || 'A'
                });
                if (!classExists) {
                    rowErrors.push(`Class ${className} does not exist`);
                }
            }

            // Duplicate check
            const existingStudent = await Student.findOne({
                schoolCode,
                studentClass: className,
                section: student.section || 'A',
                roll: parseInt(student.roll),
                isActive: true
            });

            if (existingStudent) {
                rowErrors.push('Duplicate student with same class, section and roll');
            }

            if (rowErrors.length > 0) {
                errors.push({ row: i + 1, student, errors: rowErrors });
            } else {
                validated.push({ row: i + 1, student, valid: true });
            }
        }

        res.json({
            success: true,
            data: {
                total: students.length,
                valid: validated.length,
                invalid: errors.length,
                validated,
                errors
            }
        });
    } catch (error) {
        console.error('Validate students error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate students',
            error: error.message
        });
    }
};
