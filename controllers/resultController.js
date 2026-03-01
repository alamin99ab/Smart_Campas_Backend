// controllers/resultController.js
const Result = require('../models/Result');
const Student = require('../models/Student');
const School = require('../models/School');
const AuditLog = require('../models/AuditLog');
const PDFDocument = require('pdfkit');
const Excel = require('exceljs');
const { sendEmail } = require('../utils/emailService');
const { sendSMS } = require('../utils/smsService');

// Helper: Calculate Grade
const calculateGrade = (marks, gradingSystem = 'standard') => {
    if (gradingSystem === 'standard') {
        if (marks >= 80) return 'A+';
        if (marks >= 70) return 'A';
        if (marks >= 60) return 'A-';
        if (marks >= 50) return 'B';
        if (marks >= 40) return 'C';
        if (marks >= 33) return 'D';
        return 'F';
    }
    // Add other grading systems if needed
    return 'N/A';
};

// Helper: Calculate GPA
const calculateGPA = (subjects) => {
    const gradePoints = {
        'A+': 5.0, 'A': 4.0, 'A-': 3.5, 'B': 3.0, 'C': 2.0, 'D': 1.0, 'F': 0.0
    };
    let totalPoints = 0;
    let count = 0;
    subjects.forEach(sub => {
        if (sub.grade && gradePoints[sub.grade] !== undefined) {
            totalPoints += gradePoints[sub.grade];
            count++;
        }
    });
    return count > 0 ? (totalPoints / count).toFixed(2) : 0;
};

// @desc    Upload/Publish Result (Teachers/Principal only)
// @route   POST /api/results
// @access  Private
exports.uploadResult = async (req, res) => {
    const { studentId, examName, subjects, examDate, gradingSystem, remarks } = req.body;

    try {
        // Validation
        if (!studentId || !examName || !subjects || !Array.isArray(subjects) || subjects.length === 0) {
            return res.status(400).json({ message: 'Student ID, exam name, and subjects array are required' });
        }

        // Check if student exists and belongs to this school
        const student = await Student.findOne({ 
            _id: studentId, 
            schoolCode: req.user.schoolCode 
        });
        if (!student) {
            return res.status(404).json({ message: 'Student not found in your school' });
        }

        // Validate each subject
        for (let sub of subjects) {
            if (!sub.subjectName || sub.marks === undefined) {
                return res.status(400).json({ message: 'Each subject must have subjectName and marks' });
            }
            if (sub.marks < 0 || sub.marks > 100) {
                return res.status(400).json({ message: 'Marks must be between 0 and 100' });
            }
        }

        // Check for existing result (same student & exam)
        const existing = await Result.findOne({
            studentId,
            examName: { $regex: new RegExp(`^${examName}$`, 'i') },
            schoolCode: req.user.schoolCode
        });
        if (existing) {
            return res.status(400).json({ message: 'Result already exists for this student and exam. Use update instead.' });
        }

        // Process subjects with grade
        const updatedSubjects = subjects.map(sub => ({
            ...sub,
            grade: calculateGrade(sub.marks, gradingSystem)
        }));

        const totalMarks = updatedSubjects.reduce((acc, curr) => acc + curr.marks, 0);
        const gpa = calculateGPA(updatedSubjects);

        // Create result
        const result = await Result.create({
            studentId,
            schoolCode: req.user.schoolCode,
            studentClass: student.studentClass,
            section: student.section,
            roll: student.roll,
            examName,
            examDate: examDate || Date.now(),
            subjects: updatedSubjects,
            totalMarks,
            gpa,
            remarks,
            publishedBy: req.user._id,
            isPublished: true
        });

        // Optionally send notification to student/parent
        if (process.env.SEND_RESULT_NOTIFICATION === 'true') {
            sendResultNotification(student, result);
        }

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'RESULT_PUBLISHED',
            details: { studentId, examName, totalMarks, gpa },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.status(201).json({ 
            message: 'Result published successfully', 
            result: await result.populate('studentId', 'name fatherName motherName')
        });

    } catch (error) {
        console.error('Upload result error:', error);
        if (error.code === 11000) {
            return res.status(400).json({ message: 'Duplicate entry: Result already exists' });
        }
        res.status(500).json({ message: 'Failed to publish result' });
    }
};

// @desc    Update existing result
// @route   PUT /api/results/:id
// @access  Private (Teacher/Principal)
exports.updateResult = async (req, res) => {
    try {
        const { id } = req.params;
        const { subjects, examName, examDate, remarks, gradingSystem } = req.body;

        const result = await Result.findById(id);
        if (!result) {
            return res.status(404).json({ message: 'Result not found' });
        }

        // Check school ownership
        if (result.schoolCode !== req.user.schoolCode && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }
        if (result.isLocked) {
            return res.status(403).json({ message: 'Result is locked. Principal must unlock to edit.' });
        }

        // Update fields
        if (subjects) {
            if (!Array.isArray(subjects) || subjects.length === 0) {
                return res.status(400).json({ message: 'Subjects must be a non-empty array' });
            }
            const updatedSubjects = subjects.map(sub => ({
                ...sub,
                grade: calculateGrade(sub.marks, gradingSystem || result.gradingSystem)
            }));
            result.subjects = updatedSubjects;
            result.totalMarks = updatedSubjects.reduce((acc, curr) => acc + curr.marks, 0);
            result.gpa = calculateGPA(updatedSubjects);
        }
        if (examName) result.examName = examName;
        if (examDate) result.examDate = examDate;
        if (remarks !== undefined) result.remarks = remarks;
        if (gradingSystem) result.gradingSystem = gradingSystem;

        result.updatedBy = req.user._id;
        result.updatedAt = Date.now();

        await result.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'RESULT_UPDATED',
            details: { resultId: id, examName: result.examName },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ 
            message: 'Result updated successfully', 
            result: await result.populate('studentId', 'name')
        });

    } catch (error) {
        console.error('Update result error:', error);
        res.status(500).json({ message: 'Failed to update result' });
    }
};

// @desc    Search result (public for students/parents)
// @route   POST /api/results/search
// @access  Public
exports.searchResult = async (req, res) => {
    try {
        const { schoolCode, studentClass, roll, examName } = req.body;

        if (!schoolCode || !studentClass || !roll || !examName) {
            return res.status(400).json({ message: 'School code, class, roll, and exam name are required' });
        }

        // Case-insensitive search
        const result = await Result.findOne({
            schoolCode,
            studentClass,
            roll: Number(roll),
            examName: { $regex: new RegExp(`^${examName}$`, 'i') },
            isPublished: true
        }).populate('studentId', 'name section fatherName motherName');

        if (!result) {
            return res.status(404).json({ message: 'No result found. Check your information.' });
        }

        // Log search (optional)
        await AuditLog.create({
            user: null,
            action: 'RESULT_SEARCHED',
            details: { schoolCode, studentClass, roll, examName },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        }).catch(err => console.error('Audit log error:', err));

        res.json(result);

    } catch (error) {
        console.error('Search result error:', error);
        res.status(500).json({ message: 'Failed to search result' });
    }
};

// @desc    Get all results for a school (with filters)
// @route   GET /api/results
// @access  Private
exports.getResults = async (req, res) => {
    try {
        const { 
            class: className, 
            section, 
            examName, 
            studentId, 
            fromDate, 
            toDate, 
            page = 1, 
            limit = 20 
        } = req.query;

        let query = { schoolCode: req.user.schoolCode };

        if (className) query.studentClass = className;
        if (section) query.section = section;
        if (examName) query.examName = { $regex: examName, $options: 'i' };
        if (studentId) query.studentId = studentId;
        if (fromDate || toDate) {
            query.examDate = {};
            if (fromDate) query.examDate.$gte = new Date(fromDate);
            if (toDate) query.examDate.$lte = new Date(toDate);
        }

        const skip = (page - 1) * limit;

        const results = await Result.find(query)
            .populate('studentId', 'name roll section')
            .populate('publishedBy', 'name')
            .sort({ examDate: -1, 'studentId.roll': 1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const total = await Result.countDocuments(query);

        res.json({
            results,
            total,
            totalPages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });

    } catch (error) {
        console.error('Get results error:', error);
        res.status(500).json({ message: 'Failed to fetch results' });
    }
};

// @desc    Get single result by ID
// @route   GET /api/results/:id
// @access  Private (or public if shared link)
exports.getResultById = async (req, res) => {
    try {
        const result = await Result.findById(req.params.id)
            .populate('studentId', 'name roll section fatherName motherName')
            .populate('publishedBy', 'name')
            .populate('updatedBy', 'name');

        if (!result) {
            return res.status(404).json({ message: 'Result not found' });
        }

        // Check school access for non-public requests
        if (result.schoolCode !== req.user?.schoolCode && req.user?.role !== 'admin' && !req.query.public) {
            return res.status(403).json({ message: 'Access denied' });
        }

        res.json(result);

    } catch (error) {
        console.error('Get result by ID error:', error);
        res.status(500).json({ message: 'Failed to fetch result' });
    }
};

// @desc    Delete result (soft delete)
// @route   DELETE /api/results/:id
// @access  Private (Principal/Admin)
exports.deleteResult = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Principal or admin only.' });
        }

        const result = await Result.findById(req.params.id);
        if (!result) {
            return res.status(404).json({ message: 'Result not found' });
        }

        if (result.schoolCode !== req.user.schoolCode && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Soft delete (set isPublished false) or hard delete
        result.isPublished = false;
        await result.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'RESULT_DELETED',
            details: { resultId: result._id, examName: result.examName },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ message: 'Result deleted (hidden from public)' });

    } catch (error) {
        console.error('Delete result error:', error);
        res.status(500).json({ message: 'Failed to delete result' });
    }
};

// @desc    Lock result (Principal only – no further edits)
// @route   PUT /api/results/:id/lock
// @access  Private (Principal)
exports.lockResult = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Principal only.' });
        }
        const result = await Result.findOne({ _id: req.params.id, schoolCode: req.user.schoolCode });
        if (!result) return res.status(404).json({ message: 'Result not found' });
        result.isLocked = true;
        result.lockedBy = req.user._id;
        result.lockedAt = new Date();
        await result.save();
        await AuditLog.create({
            user: req.user._id,
            action: 'RESULT_LOCKED',
            details: { resultId: result._id, examName: result.examName },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
        res.json({ success: true, message: 'Result locked. No further edits allowed.', data: result });
    } catch (error) {
        res.status(500).json({ message: 'Failed to lock result' });
    }
};

// @desc    Unlock result (Principal only)
// @route   PUT /api/results/:id/unlock
// @access  Private (Principal)
exports.unlockResult = async (req, res) => {
    try {
        if (req.user.role !== 'principal' && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Principal only.' });
        }
        const result = await Result.findOne({ _id: req.params.id, schoolCode: req.user.schoolCode });
        if (!result) return res.status(404).json({ message: 'Result not found' });
        result.isLocked = false;
        result.lockedBy = undefined;
        result.lockedAt = undefined;
        await result.save();
        await AuditLog.create({
            user: req.user._id,
            action: 'RESULT_UNLOCKED',
            details: { resultId: result._id, examName: result.examName },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });
        res.json({ success: true, message: 'Result unlocked.', data: result });
    } catch (error) {
        res.status(500).json({ message: 'Failed to unlock result' });
    }
};

// @desc    Download result as PDF
// @route   GET /api/results/:id/pdf
// @access  Public (with token) or Private
exports.downloadResultPDF = async (req, res) => {
    try {
        const result = await Result.findById(req.params.id)
            .populate('studentId', 'name fatherName motherName section');
        if (!result) {
            return res.status(404).send('Result not found');
        }

        // Get school info
        const school = await School.findOne({ schoolCode: result.schoolCode });
        const schoolInfo = {
            name: school?.schoolName || "SMART CAMPUS",
            address: school?.address || "Dhaka, Bangladesh",
            primaryColor: school?.primaryColor || "#1a5f7a",
            logo: school?.logo?.url || null
        };

        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        res.setHeader('Content-disposition', `attachment; filename="Result_${result.roll}_${result.examName}.pdf"`);
        res.setHeader('Content-type', 'application/pdf');
        doc.pipe(res);

        // Header
        if (schoolInfo.logo) {
            doc.image(schoolInfo.logo, 50, 30, { width: 70 });
        }
        doc.fillColor(schoolInfo.primaryColor)
           .fontSize(22)
           .font('Helvetica-Bold')
           .text(schoolInfo.name, schoolInfo.logo ? 130 : 50, schoolInfo.logo ? 40 : 50, { align: 'center', width: 450 });
        doc.fontSize(10)
           .fillColor('#666666')
           .text(schoolInfo.address, 0, 80, { align: 'center', width: 600 });

        // Title
        doc.moveDown(4)
           .fillColor('#000000')
           .fontSize(18)
           .font('Helvetica-Bold')
           .text('ACADEMIC MARKSHEET', { align: 'center' });

        // Student Info
        doc.moveDown()
           .fontSize(12)
           .font('Helvetica')
           .text(`Student Name: ${result.studentId.name}`, 50)
           .text(`Father's Name: ${result.studentId.fatherName || 'N/A'}`, 300, doc.y - 15)
           .moveDown(0.5)
           .text(`Roll: ${result.roll} | Class: ${result.studentClass}${result.section ? ' - ' + result.section : ''}`, 50)
           .text(`Exam: ${result.examName}`, 300, doc.y - 15)
           .moveDown(0.5)
           .text(`Date: ${new Date(result.examDate).toLocaleDateString()}`, 50);

        // Table Header
        doc.moveDown(1.5)
           .font('Helvetica-Bold')
           .text('Subject', 70, doc.y)
           .text('Marks', 250, doc.y, { continued: true })
           .text('Grade', 400, doc.y);

        doc.moveDown(0.5)
           .strokeColor('#000000')
           .lineWidth(1)
           .moveTo(50, doc.y)
           .lineTo(550, doc.y)
           .stroke();

        // Table Rows
        doc.font('Helvetica');
        result.subjects.forEach(sub => {
            doc.moveDown(0.8)
               .text(sub.subjectName, 70, doc.y)
               .text(sub.marks.toString(), 250, doc.y, { continued: true })
               .text(sub.grade, 400, doc.y);
        });

        // Total & GPA
        doc.moveDown(2)
           .font('Helvetica-Bold')
           .text(`Total Marks: ${result.totalMarks}`, 70, doc.y)
           .text(`GPA: ${result.gpa || 'N/A'}`, 300, doc.y);

        // Remarks
        if (result.remarks) {
            doc.moveDown()
               .font('Helvetica')
               .text(`Remarks: ${result.remarks}`, 70, doc.y);
        }

        // Signature
        doc.moveDown(4)
           .text('____________________', 400, doc.y + 20)
           .text('Controller of Examinations', 400, doc.y + 35);

        // Footer
        doc.fontSize(8)
           .fillColor('#999999')
           .text('This is a system generated marksheet.', 50, 750, { align: 'center', width: 500 });

        doc.end();

    } catch (error) {
        console.error('PDF generation error:', error);
        if (!res.headersSent) {
            res.status(500).json({ message: 'Failed to generate PDF' });
        }
    }
};

// @desc    Export results to Excel
// @route   GET /api/results/export
// @access  Private (Principal/Admin)
exports.exportResultsToExcel = async (req, res) => {
    try {
        const { class: className, section, examName } = req.query;

        let query = { schoolCode: req.user.schoolCode, isPublished: true };
        if (className) query.studentClass = className;
        if (section) query.section = section;
        if (examName) query.examName = { $regex: examName, $options: 'i' };

        const results = await Result.find(query)
            .populate('studentId', 'name roll section fatherName motherName')
            .sort({ studentClass: 1, section: 1, roll: 1 })
            .lean();

        if (results.length === 0) {
            return res.status(404).json({ message: 'No results found for export' });
        }

        // Create workbook
        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet('Results');

        // Headers
        const headers = ['Student Name', 'Class', 'Section', 'Roll', 'Exam Name', 'Total Marks', 'GPA', ...results[0].subjects.map(s => s.subjectName)];
        worksheet.addRow(headers);

        // Data rows
        results.forEach(result => {
            const row = [
                result.studentId.name,
                result.studentClass,
                result.section || '',
                result.roll,
                result.examName,
                result.totalMarks,
                result.gpa,
                ...result.subjects.map(s => s.marks)
            ];
            worksheet.addRow(row);
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=results_${examName || 'all'}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Export results error:', error);
        res.status(500).json({ message: 'Failed to export results' });
    }
};

// Helper: Send result notification
const sendResultNotification = async (student, result) => {
    try {
        // Send SMS to guardian
        if (student.guardian?.phone) {
            await sendSMS({
                to: student.guardian.phone,
                message: `Result published for ${student.name} (${result.examName}). Total: ${result.totalMarks}, GPA: ${result.gpa}. Check portal.`
            });
        }
        // Send Email
        if (student.guardian?.email) {
            await sendEmail({
                to: student.guardian.email,
                subject: `Result Published: ${result.examName}`,
                template: 'result-notification',
                data: {
                    studentName: student.name,
                    examName: result.examName,
                    totalMarks: result.totalMarks,
                    gpa: result.gpa
                }
            });
        }
    } catch (error) {
        console.error('Result notification error:', error);
    }
};