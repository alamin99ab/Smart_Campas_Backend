// controllers/feeController.js
const Fee = require('../models/Fee');
const Student = require('../models/Student');
const PaymentHistory = require('../models/PaymentHistory');
const AuditLog = require('../models/AuditLog');
const School = require('../models/School');
const Excel = require('exceljs');
const PDFDocument = require('pdfkit');
const { sendSMS } = require('../utils/smsService');
const { sendEmail } = require('../utils/emailService');

// @desc    Update Student Fee
// @route   POST /api/fee/update
// @access  Private (Principal/Accountant)
exports.updateFee = async (req, res) => {
    const { studentId, month, year, amountPaid, amountDue, paymentMethod, transactionId, remarks } = req.body;
    
    try {
        // Validation
        if (!studentId || !month || !year || amountPaid === undefined || amountDue === undefined) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Check if student exists and belongs to this school
        const student = await Student.findOne({ 
            _id: studentId, 
            schoolCode: req.user.schoolCode 
        });
        
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Calculate status
        let status = 'Unpaid';
        if (amountPaid >= amountDue) status = 'Paid';
        else if (amountPaid > 0) status = 'Partial';

        // Check for existing fee record
        const existingFee = await Fee.findOne({
            studentId,
            month,
            year,
            schoolCode: req.user.schoolCode
        });

        // Use transaction for data consistency
        const session = await Fee.startSession();
        session.startTransaction();

        try {
            let fee;
            
            if (existingFee) {
                // Update existing
                const previousAmountPaid = existingFee.amountPaid;
                
                existingFee.amountPaid = amountPaid;
                existingFee.amountDue = amountDue;
                existingFee.status = status;
                existingFee.updatedBy = req.user._id;
                existingFee.updatedAt = Date.now();
                
                await existingFee.save({ session });
                fee = existingFee;

                // Create payment history record
                if (amountPaid > previousAmountPaid) {
                    await PaymentHistory.create([{
                        feeId: fee._id,
                        studentId,
                        month,
                        year,
                        amount: amountPaid - previousAmountPaid,
                        previousDue: previousAmountPaid,
                        newDue: amountPaid,
                        paymentMethod,
                        transactionId,
                        remarks,
                        receivedBy: req.user._id,
                        schoolCode: req.user.schoolCode
                    }], { session });
                }
            } else {
                // Create new
                fee = await Fee.create([{
                    studentId,
                    month,
                    year,
                    amountPaid,
                    amountDue,
                    status,
                    schoolCode: req.user.schoolCode,
                    createdBy: req.user._id
                }], { session });

                // Create payment history
                if (amountPaid > 0) {
                    await PaymentHistory.create([{
                        feeId: fee[0]._id,
                        studentId,
                        month,
                        year,
                        amount: amountPaid,
                        previousDue: 0,
                        newDue: amountPaid,
                        paymentMethod,
                        transactionId,
                        remarks,
                        receivedBy: req.user._id,
                        schoolCode: req.user.schoolCode
                    }], { session });
                }
            }

            await session.commitTransaction();

            // Update student's total due
            await updateStudentTotalDue(studentId);

            // Send SMS/Email receipt if requested
            if (amountPaid > 0 && process.env.SEND_PAYMENT_RECEIPT === 'true') {
                sendPaymentReceipt(student, fee, amountPaid, paymentMethod);
            }

            // Audit log
            await AuditLog.create({
                user: req.user._id,
                action: existingFee ? 'FEE_UPDATED' : 'FEE_CREATED',
                details: { 
                    studentId, 
                    studentName: student.name,
                    month, 
                    year, 
                    amountPaid,
                    status
                },
                ip: req.ip,
                userAgent: req.headers['user-agent']
            });

            res.json({ 
                message: existingFee ? 'Fee updated successfully' : 'Fee added successfully',
                fee: existingFee || fee[0]
            });

        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }

    } catch (error) {
        console.error('Update fee error:', error);
        res.status(500).json({ message: 'Failed to update fee' });
    }
};

// @desc    Get Student Clearance
// @route   GET /api/fee/clearance/:studentId
// @access  Private
exports.getClearance = async (req, res) => {
    const { studentId } = req.params;
    
    try {
        const student = await Student.findById(studentId)
            .populate('schoolCode', 'schoolName');
            
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Check if student belongs to this school
        if (student.schoolCode !== req.user.schoolCode && req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied' });
        }

        // Get all fees for this student
        const fees = await Fee.find({ 
            studentId, 
            schoolCode: student.schoolCode 
        }).sort({ year: -1, month: -1 });

        // Calculate total due
        const totalDue = fees.reduce((acc, curr) => {
            return acc + (curr.amountDue - curr.amountPaid);
        }, 0);

        // Get payment history
        const paymentHistory = await PaymentHistory.find({ studentId })
            .populate('receivedBy', 'name')
            .sort({ createdAt: -1 })
            .limit(10);

        // Check if student has special permission or force admit
        const isCleared = totalDue <= 0 || student.forceAdmit === true;

        // Monthly breakdown
        const monthlyBreakdown = fees.map(fee => ({
            month: fee.month,
            year: fee.year,
            amountDue: fee.amountDue,
            amountPaid: fee.amountPaid,
            due: fee.amountDue - fee.amountPaid,
            status: fee.status
        }));

        res.json({
            studentId: student._id,
            studentName: student.name,
            studentClass: student.studentClass,
            roll: student.roll,
            schoolName: student.schoolCode?.schoolName,
            totalDue,
            isCleared,
            specialPermission: student.forceAdmit || false,
            monthlyBreakdown,
            recentPayments: paymentHistory
        });

    } catch (error) {
        console.error('Get clearance error:', error);
        res.status(500).json({ message: 'Failed to fetch clearance' });
    }
};

// @desc    Give Special Permission (Force Admit)
// @route   PUT /api/fee/special-permission/:studentId
// @access  Private (Principal only)
exports.giveSpecialPermission = async (req, res) => {
    try {
        if (req.user.role !== 'principal') {
            return res.status(403).json({ message: 'Access denied. Principal only.' });
        }

        const { studentId } = req.params;
        const { reason, expiryDate } = req.body;

        const student = await Student.findOne({ 
            _id: studentId, 
            schoolCode: req.user.schoolCode 
        });

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        // Update student
        student.forceAdmit = true;
        student.forceAdmitReason = reason || 'Special permission granted';
        student.forceAdmitExpiry = expiryDate || null;
        student.forceAdmitGrantedBy = req.user._id;
        student.forceAdmitGrantedAt = new Date();
        
        await student.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'SPECIAL_PERMISSION_GRANTED',
            details: { 
                studentId, 
                studentName: student.name,
                reason,
                expiryDate 
            },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ 
            message: 'Special permission granted successfully',
            student: {
                id: student._id,
                name: student.name,
                forceAdmit: true,
                forceAdmitExpiry: student.forceAdmitExpiry
            }
        });

    } catch (error) {
        console.error('Special permission error:', error);
        res.status(500).json({ message: 'Failed to grant special permission' });
    }
};

// @desc    Revoke Special Permission
// @route   PUT /api/fee/revoke-permission/:studentId
// @access  Private (Principal only)
exports.revokeSpecialPermission = async (req, res) => {
    try {
        if (req.user.role !== 'principal') {
            return res.status(403).json({ message: 'Access denied. Principal only.' });
        }

        const student = await Student.findOne({ 
            _id: req.params.studentId, 
            schoolCode: req.user.schoolCode 
        });

        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        student.forceAdmit = false;
        student.forceAdmitReason = null;
        student.forceAdmitExpiry = null;
        await student.save();

        // Audit log
        await AuditLog.create({
            user: req.user._id,
            action: 'SPECIAL_PERMISSION_REVOKED',
            details: { studentId: student._id, studentName: student.name },
            ip: req.ip,
            userAgent: req.headers['user-agent']
        });

        res.json({ message: 'Special permission revoked' });

    } catch (error) {
        console.error('Revoke permission error:', error);
        res.status(500).json({ message: 'Failed to revoke permission' });
    }
};

// @desc    Get Fee Report (Monthly/Yearly)
// @route   GET /api/fee/report
// @access  Private (Principal/Accountant)
exports.getFeeReport = async (req, res) => {
    const { class: className, section, month, year, status, page = 1, limit = 20 } = req.query;
    
    try {
        let query = { schoolCode: req.user.schoolCode };

        if (month && year) {
            query.month = parseInt(month);
            query.year = parseInt(year);
        }

        // Get students first if class/section filter applied
        let studentIds = [];
        if (className || section) {
            const studentQuery = { schoolCode: req.user.schoolCode };
            if (className) studentQuery.studentClass = className;
            if (section) studentQuery.section = section;
            
            const students = await Student.find(studentQuery).select('_id');
            studentIds = students.map(s => s._id);
            query.studentId = { $in: studentIds };
        }

        // Status filter
        if (status) {
            query.status = status;
        }

        // Pagination
        const skip = (page - 1) * limit;

        const fees = await Fee.find(query)
            .populate('studentId', 'name roll studentClass section fatherName motherName')
            .populate('createdBy', 'name')
            .populate('updatedBy', 'name')
            .sort({ year: -1, month: -1, 'studentId.roll': 1 })
            .skip(skip)
            .limit(limit * 1);

        const total = await Fee.countDocuments(query);

        // Calculate summary
        const summary = await Fee.aggregate([
            { $match: query },
            {
                $group: {
                    _id: null,
                    totalCollected: { $sum: '$amountPaid' },
                    totalDue: { $sum: { $subtract: ['$amountDue', '$amountPaid'] } },
                    totalStudents: { $sum: 1 },
                    paidCount: { $sum: { $cond: [{ $eq: ['$status', 'Paid'] }, 1, 0] } },
                    partialCount: { $sum: { $cond: [{ $eq: ['$status', 'Partial'] }, 1, 0] } },
                    unpaidCount: { $sum: { $cond: [{ $eq: ['$status', 'Unpaid'] }, 1, 0] } }
                }
            }
        ]);

        res.json({
            fees,
            summary: summary[0] || { totalCollected: 0, totalDue: 0, totalStudents: 0 },
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });

    } catch (error) {
        console.error('Fee report error:', error);
        res.status(500).json({ message: 'Failed to fetch fee report' });
    }
};

// @desc    Get Student Fee History
// @route   GET /api/fee/history/:studentId
// @access  Private
exports.getStudentFeeHistory = async (req, res) => {
    const { studentId } = req.params;
    
    try {
        const student = await Student.findById(studentId);
        if (!student) {
            return res.status(404).json({ message: 'Student not found' });
        }

        const fees = await Fee.find({ 
            studentId, 
            schoolCode: req.user.schoolCode 
        }).sort({ year: -1, month: -1 });

        const paymentHistory = await PaymentHistory.find({ studentId })
            .populate('receivedBy', 'name')
            .sort({ createdAt: -1 });

        res.json({
            student: {
                name: student.name,
                roll: student.roll,
                class: student.studentClass,
                section: student.section
            },
            fees,
            paymentHistory
        });

    } catch (error) {
        console.error('Fee history error:', error);
        res.status(500).json({ message: 'Failed to fetch fee history' });
    }
};

// @desc    Get Due List
// @route   GET /api/fee/due-list
// @access  Private (Principal/Accountant)
exports.getDueList = async (req, res) => {
    const { class: className, section, month, year, minDue = 0 } = req.query;
    
    try {
        const matchQuery = {
            schoolCode: req.user.schoolCode,
            $expr: { $gt: [{ $subtract: ['$amountDue', '$amountPaid'] }, parseFloat(minDue)] }
        };

        if (month && year) {
            matchQuery.month = parseInt(month);
            matchQuery.year = parseInt(year);
        }

        // Get students with due
        const dues = await Fee.aggregate([
            { $match: matchQuery },
            {
                $lookup: {
                    from: 'students',
                    localField: 'studentId',
                    foreignField: '_id',
                    as: 'student'
                }
            },
            { $unwind: '$student' },
            { 
                $match: { 
                    'student.schoolCode': req.user.schoolCode,
                    ...(className && { 'student.studentClass': className }),
                    ...(section && { 'student.section': section })
                } 
            },
            {
                $project: {
                    studentId: 1,
                    studentName: '$student.name',
                    roll: '$student.roll',
                    class: '$student.studentClass',
                    section: '$student.section',
                    fatherName: '$student.fatherName',
                    phone: '$student.guardian.phone',
                    month: 1,
                    year: 1,
                    amountDue: 1,
                    amountPaid: 1,
                    dueAmount: { $subtract: ['$amountDue', '$amountPaid'] },
                    status: 1
                }
            },
            { $sort: { class: 1, section: 1, roll: 1 } }
        ]);

        // Calculate total due
        const totalDue = dues.reduce((acc, curr) => acc + curr.dueAmount, 0);

        res.json({
            totalDue,
            totalStudents: dues.length,
            dues
        });

    } catch (error) {
        console.error('Due list error:', error);
        res.status(500).json({ message: 'Failed to fetch due list' });
    }
};

// @desc    Export Fee Report to Excel
// @route   GET /api/fee/export
// @access  Private (Principal/Accountant)
exports.exportFeeReport = async (req, res) => {
    const { class: className, section, month, year, startDate, endDate } = req.query;
    
    try {
        let query = { schoolCode: req.user.schoolCode };

        if (month && year) {
            query.month = parseInt(month);
            query.year = parseInt(year);
        }

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            query.createdAt = { $gte: start, $lte: end };
        }

        // Get students if class/section filter
        if (className || section) {
            const studentQuery = { schoolCode: req.user.schoolCode };
            if (className) studentQuery.studentClass = className;
            if (section) studentQuery.section = section;
            
            const students = await Student.find(studentQuery).select('_id');
            query.studentId = { $in: students.map(s => s._id) };
        }

        const fees = await Fee.find(query)
            .populate('studentId', 'name roll studentClass section fatherName motherName guardian')
            .sort({ year: -1, month: -1, 'studentId.roll': 1 })
            .lean();

        // Create Excel workbook
        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet('Fee Report');

        // Add headers
        worksheet.columns = [
            { header: 'Student Name', key: 'studentName', width: 25 },
            { header: 'Class', key: 'class', width: 10 },
            { header: 'Section', key: 'section', width: 10 },
            { header: 'Roll', key: 'roll', width: 10 },
            { header: 'Month', key: 'month', width: 15 },
            { header: 'Year', key: 'year', width: 8 },
            { header: 'Amount Due', key: 'amountDue', width: 15 },
            { header: 'Amount Paid', key: 'amountPaid', width: 15 },
            { header: 'Due', key: 'due', width: 15 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Father\'s Name', key: 'fatherName', width: 20 },
            { header: 'Phone', key: 'phone', width: 15 }
        ];

        // Add rows
        fees.forEach(fee => {
            worksheet.addRow({
                studentName: fee.studentId?.name || 'N/A',
                class: fee.studentId?.studentClass || 'N/A',
                section: fee.studentId?.section || 'N/A',
                roll: fee.studentId?.roll || 'N/A',
                month: getMonthName(fee.month),
                year: fee.year,
                amountDue: fee.amountDue,
                amountPaid: fee.amountPaid,
                due: fee.amountDue - fee.amountPaid,
                status: fee.status,
                fatherName: fee.studentId?.fatherName || 'N/A',
                phone: fee.studentId?.guardian?.phone || 'N/A'
            });
        });

        // Summary row
        const totalDue = fees.reduce((acc, f) => acc + (f.amountDue - f.amountPaid), 0);
        const totalPaid = fees.reduce((acc, f) => acc + f.amountPaid, 0);
        
        worksheet.addRow({});
        worksheet.addRow({
            studentName: 'SUMMARY',
            amountDue: totalPaid + totalDue,
            amountPaid: totalPaid,
            due: totalDue
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=fee_report_${Date.now()}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Export fee report error:', error);
        res.status(500).json({ message: 'Failed to export report' });
    }
};

// @desc    Generate Fee Collection Summary PDF
// @route   GET /api/fee/summary-pdf
// @access  Private (Principal only)
exports.generateFeeSummaryPDF = async (req, res) => {
    const { month, year } = req.query;
    
    try {
        if (!month || !year) {
            return res.status(400).json({ message: 'Month and year required' });
        }

        const school = await School.findOne({ schoolCode: req.user.schoolCode });
        
        // Get fee summary
        const summary = await Fee.aggregate([
            {
                $match: {
                    schoolCode: req.user.schoolCode,
                    month: parseInt(month),
                    year: parseInt(year)
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalCollected: { $sum: '$amountPaid' },
                    totalDue: { $sum: { $subtract: ['$amountDue', '$amountPaid'] } }
                }
            }
        ]);

        // Get recent collections
        const recentPayments = await PaymentHistory.find({
            schoolCode: req.user.schoolCode,
            month: parseInt(month),
            year: parseInt(year)
        })
        .populate('studentId', 'name roll')
        .populate('receivedBy', 'name')
        .sort({ createdAt: -1 })
        .limit(20);

        // Create PDF
        const doc = new PDFDocument({ margin: 50, size: 'A4' });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=fee_summary_${month}_${year}.pdf`);

        doc.pipe(res);

        // Header
        doc.fontSize(20)
           .font('Helvetica-Bold')
           .text(school.schoolName, { align: 'center' });
        
        doc.fontSize(16)
           .text(`Fee Collection Summary`, { align: 'center' });
        
        doc.fontSize(12)
           .text(`${getMonthName(month)} ${year}`, { align: 'center' });

        doc.moveDown();

        // Summary table
        doc.fontSize(14).text('Collection Summary', 50);
        doc.moveDown(0.5);

        const summaryData = {
            Paid: summary.find(s => s._id === 'Paid') || { count: 0, totalCollected: 0 },
            Partial: summary.find(s => s._id === 'Partial') || { count: 0, totalCollected: 0 },
            Unpaid: summary.find(s => s._id === 'Unpaid') || { count: 0, totalCollected: 0 }
        };

        const totalCollected = summaryData.Paid.totalCollected + summaryData.Partial.totalCollected;
        const totalDue = summaryData.Paid.totalDue + summaryData.Partial.totalDue + summaryData.Unpaid.totalDue;

        doc.fontSize(10);
        doc.text(`Total Collected: ৳${totalCollected}`, 50, doc.y);
        doc.text(`Total Due: ৳${totalDue}`, 50, doc.y + 20);
        doc.text(`Paid Students: ${summaryData.Paid.count}`, 250, doc.y - 20);
        doc.text(`Partial Students: ${summaryData.Partial.count}`, 250, doc.y);
        doc.text(`Unpaid Students: ${summaryData.Unpaid.count}`, 250, doc.y + 20);

        doc.moveDown(3);

        // Recent collections
        doc.fontSize(14).text('Recent Collections', 50);
        doc.moveDown(0.5);

        let y = doc.y;
        recentPayments.forEach((payment, index) => {
            if (index < 10) {
                doc.fontSize(9)
                   .text(`${new Date(payment.createdAt).toLocaleDateString()}`, 50, y)
                   .text(`${payment.studentId?.name || 'N/A'}`, 120, y)
                   .text(`৳${payment.amount}`, 300, y)
                   .text(`${payment.paymentMethod}`, 380, y);
                y += 15;
            }
        });

        doc.end();

    } catch (error) {
        console.error('Generate PDF error:', error);
        res.status(500).json({ message: 'Failed to generate PDF' });
    }
};

// Helper function to update student's total due
const updateStudentTotalDue = async (studentId) => {
    try {
        const fees = await Fee.find({ studentId });
        const totalDue = fees.reduce((acc, curr) => {
            return acc + (curr.amountDue - curr.amountPaid);
        }, 0);

        await Student.findByIdAndUpdate(studentId, { totalDue });
    } catch (error) {
        console.error('Update student total due error:', error);
    }
};

// Helper function to send payment receipt
const sendPaymentReceipt = async (student, fee, amount, method) => {
    try {
        // Send SMS
        if (student.guardian?.phone) {
            await sendSMS({
                to: student.guardian.phone,
                message: `Payment receipt: ৳${amount} received for ${student.name} (${fee.month}/${fee.year}). Thank you.`
            });
        }

        // Send Email
        if (student.guardian?.email) {
            await sendEmail({
                to: student.guardian.email,
                subject: 'Fee Payment Receipt',
                template: 'payment-receipt',
                data: {
                    studentName: student.name,
                    amount,
                    month: getMonthName(fee.month),
                    year: fee.year,
                    date: new Date().toLocaleDateString(),
                    method
                }
            });
        }
    } catch (error) {
        console.error('Send receipt error:', error);
    }
};

// Helper function to get month name
const getMonthName = (monthNumber) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                   'July', 'August', 'September', 'October', 'November', 'December'];
    return months[monthNumber - 1] || 'Unknown';
};