// controllers/admitController.js
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const Student = require('../models/Student');
const School = require('../models/School');
const Exam = require('../models/Exam');
const AuditLog = require('../models/AuditLog');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');

// @desc    Download Single Admit Card
// @route   GET /api/admit/:studentId
// @access  Private
exports.downloadAdmitCard = async (req, res) => {
    try {
        const { studentId } = req.params;
        const { examId } = req.query;

        if (!studentId) {
            return res.status(400).json({ message: 'Student ID is required' });
        }

        // Get student with populated data
        const student = await Student.findById(studentId)
            .populate('schoolCode', 'schoolName logo address phone email')
            .populate('classTeacher', 'name');
        
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Get school info
        const school = student.schoolCode || await School.findOne({ schoolCode: student.schoolCode });
        
        // Get exam info
        let exam = null;
        if (examId) {
            exam = await Exam.findById(examId);
        }

        const schoolInfo = {
            schoolName: school?.schoolName || "SMART CAMPUS",
            primaryColor: school?.primaryColor || "#1a5f7a",
            secondaryColor: school?.secondaryColor || "#e5e5e5",
            address: school?.address || "Dhaka, Bangladesh",
            logo: school?.logo?.url || null,
            phone: school?.phone || "",
            email: school?.email || ""
        };

        const examInfo = exam || {
            name: "Annual Examination",
            year: new Date().getFullYear(),
            startDate: "2026-02-15",
            endDate: "2026-02-28",
            subjects: ["Bangla", "English", "Math", "Science"]
        };

        // Generate QR Code
        const qrData = JSON.stringify({
            studentId: student._id,
            name: student.name,
            roll: student.roll,
            class: student.studentClass,
            school: schoolInfo.schoolName,
            exam: examInfo.name
        });
        
        const qrCode = await QRCode.toDataURL(qrData);

        // Create PDF
        const doc = new PDFDocument({ 
            margin: 30, 
            size: [400, 650], // Admit card size
            bufferPages: true 
        });

        res.setHeader('Content-disposition', `attachment; filename="Admit_${student.roll}_${student.studentClass}.pdf"`);
        res.setHeader('Content-type', 'application/pdf');
        res.setHeader('Cache-Control', 'no-cache');

        doc.pipe(res);

        // Header with school name and logo
        if (schoolInfo.logo) {
            // Add logo if exists
            doc.image(schoolInfo.logo, 30, 30, { width: 50 });
        }
        
        doc.fillColor(schoolInfo.primaryColor)
           .fontSize(18)
           .font('Helvetica-Bold')
           .text(schoolInfo.schoolName, schoolInfo.logo ? 90 : 30, schoolInfo.logo ? 35 : 30, { align: 'center', width: 280 });
        
        doc.fontSize(10)
           .font('Helvetica')
           .fillColor('#666666')
           .text(schoolInfo.address, 0, 65, { align: 'center', width: 400 });

        // Title
        doc.moveDown(2)
           .fillColor('#000000')
           .fontSize(16)
           .font('Helvetica-Bold')
           .text('ADMIT CARD', 0, 100, { align: 'center' });

        // Exam name
        doc.fontSize(12)
           .fillColor(schoolInfo.primaryColor)
           .text(examInfo.name, 0, 130, { align: 'center' });

        // Student Photo (if exists)
        if (student.photo) {
            doc.image(student.photo, 300, 140, { width: 70, height: 70 });
        }

        // Student Information Box
        doc.rect(40, 180, 320, 120)
           .fillAndStroke('#f8f9fa', schoolInfo.primaryColor);
        
        doc.fillColor('#000000')
           .fontSize(11)
           .font('Helvetica-Bold')
           .text('Student Information', 50, 190);
        
        doc.font('Helvetica')
           .fontSize(10)
           .fillColor('#333333');

        const studentInfo = [
            { label: 'Name', value: student.name },
            { label: 'Class', value: student.studentClass },
            { label: 'Roll No', value: student.roll },
            { label: 'Section', value: student.section || 'N/A' },
            { label: 'Father\'s Name', value: student.fatherName || 'N/A' },
            { label: 'Mother\'s Name', value: student.motherName || 'N/A' }
        ];

        let yPosition = 210;
        studentInfo.forEach(info => {
            doc.text(`${info.label}: ${info.value}`, 50, yPosition);
            yPosition += 18;
        });

        // Exam Details Box
        doc.rect(40, 310, 320, 100)
           .fillAndStroke('#ffffff', schoolInfo.primaryColor);
        
        doc.fillColor('#000000')
           .fontSize(11)
           .font('Helvetica-Bold')
           .text('Examination Details', 50, 320);
        
        doc.font('Helvetica')
           .fontSize(9)
           .fillColor('#333333')
           .text(`Examination: ${examInfo.name} - ${examInfo.year}`, 50, 340)
           .text(`Date: ${new Date(examInfo.startDate).toLocaleDateString()} to ${new Date(examInfo.endDate).toLocaleDateString()}`, 50, 360)
           .text('Reporting Time: 9:30 AM', 50, 380)
           .text('Exam Time: 10:00 AM to 1:00 PM', 50, 400);

        // Subjects List
        if (examInfo.subjects && examInfo.subjects.length > 0) {
            doc.text('Subjects:', 50, 420);
            let subjectY = 435;
            examInfo.subjects.forEach((subject, index) => {
                if (index % 2 === 0) {
                    doc.text(`• ${subject}`, 50, subjectY);
                } else {
                    doc.text(`• ${subject}`, 200, subjectY);
                    subjectY += 15;
                }
            });
        }

        // QR Code
        doc.image(qrCode, 280, 500, { width: 70, height: 70 });

        // Instructions Box
        doc.rect(40, 500, 220, 70)
           .stroke(schoolInfo.primaryColor);
        
        doc.fontSize(9)
           .font('Helvetica-Bold')
           .text('INSTRUCTIONS:', 50, 510);
        
        doc.font('Helvetica')
           .fontSize(8)
           .fillColor('#666666')
           .text('• Bring this card to the exam hall', 50, 525)
           .text('• Mobile phones are prohibited', 50, 540)
           .text('• Use black/blue ink only', 50, 555);

        // Signature
        doc.fontSize(10)
           .fillColor('#000000')
           .text('____________________', 220, 585)
           .text('Controller of Examinations', 210, 600);

        // Footer
        doc.fontSize(7)
           .fillColor('#999999')
           .text(`Generated on: ${new Date().toLocaleString()}`, 30, 620, { align: 'center', width: 340 });

        // Watermark
        if (process.env.NODE_ENV === 'production') {
            doc.fontSize(40)
               .fillColor('#cccccc')
               .opacity(0.3)
               .text('OFFICIAL', 50, 300, { align: 'center', angle: 45 });
        }

        doc.end();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'ADMIT_CARD_DOWNLOADED',
            details: { studentId: student._id, studentName: student.name, exam: examInfo.name },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

    } catch (error) {
        console.error('Admit card generation error:', error);
        
        if (!res.headersSent) {
            res.status(500).json({ 
                message: 'Failed to generate admit card',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
};

// @desc    Download Multiple Admit Cards (ZIP)
// @route   POST /api/admit/bulk
// @access  Private
exports.downloadBulkAdmitCards = async (req, res) => {
    const { studentIds, examId } = req.body;
    
    try {
        if (!studentIds || !Array.isArray(studentIds) || studentIds.length === 0) {
            return res.status(400).json({ message: 'Student IDs are required' });
        }

        if (studentIds.length > 50) {
            return res.status(400).json({ message: 'Maximum 50 students allowed' });
        }

        // Get students
        const students = await Student.find({ 
            _id: { $in: studentIds },
            schoolCode: req.user.schoolCode
        }).populate('schoolCode');

        if (students.length === 0) {
            return res.status(404).json({ message: 'No students found' });
        }

        // Get school info
        const school = await School.findOne({ schoolCode: req.user.schoolCode });
        
        // Get exam info
        let exam = null;
        if (examId) {
            exam = await Exam.findById(examId);
        }

        const schoolInfo = {
            schoolName: school?.schoolName || "SMART CAMPUS",
            primaryColor: school?.primaryColor || "#1a5f7a",
            secondaryColor: school?.secondaryColor || "#e5e5e5",
            address: school?.address || "Dhaka, Bangladesh",
            logo: school?.logo?.url || null
        };

        const examInfo = exam || {
            name: "Annual Examination",
            year: new Date().getFullYear(),
            startDate: "2026-02-15",
            endDate: "2026-02-28",
            subjects: ["Bangla", "English", "Math", "Science"]
        };

        // Create temp directory
        const tempDir = path.join(__dirname, '../temp', Date.now().toString());
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Generate PDFs
        const pdfPromises = students.map(async (student) => {
            return new Promise(async (resolve, reject) => {
                try {
                    const filename = `Admit_${student.roll}_${student.studentClass}.pdf`;
                    const filepath = path.join(tempDir, filename);
                    
                    // Generate QR Code
                    const qrData = JSON.stringify({
                        studentId: student._id,
                        name: student.name,
                        roll: student.roll,
                        class: student.studentClass,
                        school: schoolInfo.schoolName,
                        exam: examInfo.name
                    });
                    
                    const qrCode = await QRCode.toDataURL(qrData);

                    // Create PDF
                    const doc = new PDFDocument({ margin: 30, size: [400, 650] });
                    const writeStream = fs.createWriteStream(filepath);
                    doc.pipe(writeStream);

                    // Generate PDF content (similar to single admit card)
                    // ... (same PDF generation code as above)
                    
                    doc.end();
                    
                    writeStream.on('finish', resolve);
                    writeStream.on('error', reject);
                } catch (error) {
                    reject(error);
                }
            });
        });

        await Promise.all(pdfPromises);

        // Create ZIP file
        const zipFilename = `Admit_Cards_${Date.now()}.zip`;
        const zipPath = path.join(tempDir, zipFilename);
        const output = fs.createWriteStream(zipPath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        output.on('close', async () => {
            // Send ZIP file
            res.download(zipPath, zipFilename, async (err) => {
                if (err) {
                    console.error('Download error:', err);
                }
                
                // Clean up temp files
                fs.rm(tempDir, { recursive: true, force: true }, (err) => {
                    if (err) console.error('Cleanup error:', err);
                });
            });

            // Audit log
            await AuditLog.create({
                user: req.user._id,
                action: 'BULK_ADMIT_CARDS_DOWNLOADED',
                details: { studentCount: students.length, exam: examInfo.name },
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });
        });

        archive.on('error', (err) => {
            throw err;
        });

        archive.pipe(output);
        archive.directory(tempDir, false);
        archive.finalize();

    } catch (error) {
        console.error('Bulk admit cards error:', error);
        res.status(500).json({ message: 'Failed to generate admit cards' });
    }
};

// @desc    Generate Admit Card Template
// @route   GET /api/admit/template/:schoolCode
// @access  Private
exports.getAdmitTemplate = async (req, res) => {
    try {
        const school = await School.findOne({ schoolCode: req.params.schoolCode });
        
        if (!school) {
            return res.status(404).json({ message: 'School not found' });
        }

        const template = {
            schoolName: school.schoolName,
            primaryColor: school.primaryColor || '#1a5f7a',
            secondaryColor: school.secondaryColor || '#e5e5e5',
            address: school.address,
            logo: school.logo,
            examName: school.examName || 'Annual Examination',
            signature: school.signature,
            instructions: school.admitInstructions || [
                'Bring this card to the exam hall',
                'Mobile phones are prohibited',
                'Use black/blue ink only'
            ]
        };

        res.json(template);

    } catch (error) {
        console.error('Get template error:', error);
        res.status(500).json({ message: 'Failed to fetch template' });
    }
};

// @desc    Update Admit Card Template
// @route   PUT /api/admit/template
// @access  Private (Principal only)
exports.updateAdmitTemplate = async (req, res) => {
    const { primaryColor, secondaryColor, examName, instructions, signature } = req.body;
    
    try {
        if (req.user.role !== 'principal') {
            return res.status(403).json({ message: 'Access denied' });
        }

        const school = await School.findOne({ schoolCode: req.user.schoolCode });
        
        if (!school) {
            return res.status(404).json({ message: 'School not found' });
        }

        if (primaryColor) school.primaryColor = primaryColor;
        if (secondaryColor) school.secondaryColor = secondaryColor;
        if (examName) school.examName = examName;
        if (instructions) school.admitInstructions = instructions;
        if (signature) school.signature = signature;

        await school.save();

        res.json({ 
            message: 'Template updated successfully',
            template: {
                primaryColor: school.primaryColor,
                secondaryColor: school.secondaryColor,
                examName: school.examName,
                instructions: school.admitInstructions
            }
        });

    } catch (error) {
        console.error('Update template error:', error);
        res.status(500).json({ message: 'Failed to update template' });
    }
};