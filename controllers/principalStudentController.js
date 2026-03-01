/**
 * Principal – Student Management (Add, Bulk Import, Promote, Transfer)
 */
const Student = require('../models/Student');
const User = require('../models/User');
const School = require('../models/School');
const AuditLog = require('../models/AuditLog');
const Excel = require('exceljs');

exports.addStudent = async (req, res) => {
    try {
        const { name, roll, studentClass, section, fatherName, motherName, dateOfBirth, gender, guardian, address } = req.body;
        if (!name || !roll || !studentClass) {
            return res.status(400).json({ success: false, message: 'Name, roll, and class are required' });
        }
        const schoolCode = req.user.schoolCode;

        const existing = await Student.findOne({ schoolCode, studentClass, section: section || null, roll });
        if (existing) return res.status(400).json({ success: false, message: 'Student with same class/section/roll already exists' });

        const student = await Student.create({
            name,
            roll: Number(roll),
            studentClass,
            section: section || '',
            fatherName,
            motherName,
            dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
            gender,
            guardian: guardian || {},
            address,
            schoolCode,
            addedBy: req.user._id
        });

        await AuditLog.create({
            user: req.user._id,
            action: 'STUDENT_ADDED',
            details: { studentId: student._id, name, studentClass },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(201).json({ success: true, data: student });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.bulkImportStudents = async (req, res) => {
    try {
        if (!req.file && !req.files?.file) {
            return res.status(400).json({ success: false, message: 'Excel file required (field: file)' });
        }
        const file = req.file || (Array.isArray(req.files?.file) ? req.files.file[0] : req.files?.file);
        if (!file) return res.status(400).json({ success: false, message: 'Invalid file' });

        const schoolCode = req.user.schoolCode;
        const workbook = new Excel.Workbook();
        const fs = require('fs');
        if (file.buffer) {
            await workbook.xlsx.load(file.buffer);
        } else if (file.path && fs.existsSync(file.path)) {
            await workbook.xlsx.readFile(file.path);
        } else {
            return res.status(400).json({ success: false, message: 'Could not read file' });
        }

        const sheet = workbook.worksheets[0];
        if (!sheet) return res.status(400).json({ success: false, message: 'Empty workbook' });

        const rows = [];
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // skip header
            const cells = row.values;
            rows.push({
                name: (cells[1] || '').toString().trim(),
                roll: parseInt(cells[2], 10) || 0,
                studentClass: (cells[3] || '').toString().trim(),
                section: (cells[4] || '').toString().trim(),
                fatherName: (cells[5] || '').toString().trim(),
                motherName: (cells[6] || '').toString().trim(),
                gender: (cells[7] || '').toString().trim()
            });
        });

        const created = [];
        const errors = [];
        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            if (!r.name || !r.studentClass) {
                errors.push({ row: i + 2, message: 'Name and class required' });
                continue;
            }
            try {
                const exists = await Student.findOne({ schoolCode, studentClass: r.studentClass, section: r.section || '', roll: r.roll });
                if (exists) {
                    errors.push({ row: i + 2, message: 'Duplicate roll in class/section' });
                    continue;
                }
                const student = await Student.create({
                    name: r.name,
                    roll: r.roll,
                    studentClass: r.studentClass,
                    section: r.section || '',
                    fatherName: r.fatherName,
                    motherName: r.motherName,
                    gender: r.gender || undefined,
                    schoolCode,
                    addedBy: req.user._id
                });
                created.push(student);
            } catch (e) {
                errors.push({ row: i + 2, message: e.message || 'Create failed' });
            }
        }

        await AuditLog.create({
            user: req.user._id,
            action: 'STUDENTS_BULK_IMPORTED',
            details: { total: rows.length, created: created.length, errors: errors.length },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({
            success: true,
            data: { created: created.length, total: rows.length, errors: errors.length, details: errors }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.promoteStudents = async (req, res) => {
    try {
        const { fromClass, fromSection, toClass, toSection, studentIds, academicYear } = req.body;
        const schoolCode = req.user.schoolCode;

        const ids = studentIds && studentIds.length ? studentIds : null;
        const query = { schoolCode, studentClass: fromClass, isActive: true };
        if (fromSection) query.section = fromSection;
        if (ids) query._id = { $in: ids };

        const students = await Student.find(query);
        if (!students.length) return res.status(404).json({ success: false, message: 'No students found to promote' });

        const toCl = toClass || fromClass;
        const toSec = toSection !== undefined ? toSection : fromSection;

        for (const s of students) {
            s.studentClass = toCl;
            s.section = toSec;
            if (academicYear) s.academicYear = academicYear;
            s.updatedBy = req.user._id;
            await s.save();
        }

        await AuditLog.create({
            user: req.user._id,
            action: 'STUDENTS_PROMOTED',
            details: { fromClass, toClass: toCl, count: students.length },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ success: true, message: `${students.length} student(s) promoted to ${toCl}${toSec ? '-' + toSec : ''}`, data: { count: students.length } });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.transferStudent = async (req, res) => {
    try {
        const { studentId, toSection, toClass, toSchoolCode, reason } = req.body;
        if (!studentId) return res.status(400).json({ success: false, message: 'studentId required' });
        const schoolCode = req.user.schoolCode;

        const student = await Student.findOne({ _id: studentId, schoolCode });
        if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

        if (toSchoolCode && toSchoolCode !== schoolCode) {
            return res.status(400).json({ success: false, message: 'Inter-school transfer not implemented. Use section/class transfer.' });
        }

        if (toClass) student.studentClass = toClass;
        if (toSection !== undefined) student.section = toSection;
        student.updatedBy = req.user._id;
        await student.save();

        await AuditLog.create({
            user: req.user._id,
            action: 'STUDENT_TRANSFERRED',
            details: { studentId: student._id, toClass: student.studentClass, toSection: student.section, reason },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ success: true, message: 'Student transferred', data: student });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
