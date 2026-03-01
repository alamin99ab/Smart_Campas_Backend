/**
 * 💰 ACCOUNTANT CONTROLLER
 * Complete accountant dashboard implementation
 */

const School = require('../models/School');
const Fee = require('../models/Fee');
const FeeStructure = require('../models/FeeStructure');
const PaymentHistory = require('../models/PaymentHistory');
const Student = require('../models/Student');
const User = require('../models/User');

/**
 * @desc    Get accountant dashboard
 * @route   GET /api/accountant/dashboard
 * @access  Accountant only
 */
exports.getAccountantDashboard = async (req, res) => {
    try {
        const schoolId = req.user.schoolId;
        const schoolCode = req.user.schoolCode;

        // Get current month's collection
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthStart = new Date(currentYear, currentMonth, 1);
        const monthEnd = new Date(currentYear, currentMonth + 1, 0);

        const monthlyCollection = await PaymentHistory.aggregate([
            {
                $match: {
                    schoolCode,
                    paymentDate: { $gte: monthStart, $lt: monthEnd }
                }
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: '$amount' },
                    totalPayments: { $sum: 1 }
                }
            }
        ]);

        // Get total outstanding fees
        const totalOutstanding = await Fee.aggregate([
            {
                $match: {
                    schoolCode,
                    status: 'unpaid'
                }
            },
            {
                $group: {
                    _id: null,
                    totalAmount: { $sum: { $subtract: ['$amount', '$paidAmount'] } }
                }
            }
        ]);

        // Get recent payments
        const recentPayments = await PaymentHistory.find({ schoolCode })
            .sort({ paymentDate: -1 })
            .limit(10)
            .populate('studentId', 'name rollNumber')
            .populate('feeId', 'feeType description');

        // Get fee collection trends (last 6 months)
        const sixMonthsAgo = new Date(currentYear, currentMonth - 5, 1);
        const collectionTrends = await PaymentHistory.aggregate([
            {
                $match: {
                    schoolCode,
                    paymentDate: { $gte: sixMonthsAgo }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$paymentDate' },
                        month: { $month: '$paymentDate' }
                    },
                    amount: { $sum: '$amount' }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1 }
            }
        ]);

        // Get student fee statistics
        const studentFeeStats = await Fee.aggregate([
            {
                $match: { schoolCode }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' }
                }
            }
        ]);

        const dashboard = {
            monthlyCollection: monthlyCollection[0]?.totalAmount || 0,
            monthlyPayments: monthlyCollection[0]?.totalPayments || 0,
            totalOutstanding: totalOutstanding[0]?.totalAmount || 0,
            recentPayments,
            collectionTrends: collectionTrends,
            studentFeeStats: {
                paid: studentFeeStats.find(s => s._id === 'paid')?.count || 0,
                unpaid: studentFeeStats.find(s => s._id === 'unpaid')?.count || 0,
                partial: studentFeeStats.find(s => s._id === 'partial')?.count || 0
            }
        };

        res.status(200).json({
            success: true,
            data: dashboard
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Get fee collection report
 * @route   GET /api/accountant/collection-report
 * @access  Accountant only
 */
exports.getCollectionReport = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        const { startDate, endDate, classId, sectionId } = req.query;

        // Build match criteria
        const matchCriteria = { schoolCode };
        if (startDate || endDate) {
            matchCriteria.paymentDate = {};
            if (startDate) matchCriteria.paymentDate.$gte = new Date(startDate);
            if (endDate) matchCriteria.paymentDate.$lte = new Date(endDate);
        }

        const collectionReport = await PaymentHistory.aggregate([
            {
                $match: matchCriteria
            },
            {
                $lookup: {
                    from: 'students',
                    localField: 'studentId',
                    foreignField: '_id',
                    as: 'student'
                }
            },
            {
                $lookup: {
                    from: 'fees',
                    localField: 'feeId',
                    foreignField: '_id',
                    as: 'fee'
                }
            },
            {
                $group: {
                    _id: {
                        date: { $dateToString: { format: '%Y-%m-%d', date: '$paymentDate' } },
                        class: '$student.classId',
                        feeType: '$fee.feeType'
                    },
                    totalAmount: { $sum: '$amount' },
                    paymentCount: { $sum: 1 }
                }
            },
            {
                $sort: { '_id.date': 1 }
            }
        ]);

        res.status(200).json({
            success: true,
            data: collectionReport
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Get outstanding fees
 * @route   GET /api/accountant/outstanding-fees
 * @access  Accountant only
 */
exports.getOutstandingFees = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        const { classId, sectionId, overdueOnly } = req.query;

        // Build match criteria
        const matchCriteria = { 
            schoolCode,
            $expr: { $gt: ['$amount', '$paidAmount'] }
        };

        if (classId) matchCriteria.classId = classId;
        if (sectionId) matchCriteria.sectionId = sectionId;
        if (overdueOnly === 'true') {
            matchCriteria.dueDate = { $lt: new Date() };
        }

        const outstandingFees = await Fee.find(matchCriteria)
            .populate('studentId', 'name rollNumber')
            .populate('classId', 'className')
            .populate('sectionId', 'sectionName')
            .populate('feeStructureId', 'feeType description')
            .sort({ dueDate: 1 });

        const totalOutstanding = outstandingFees.reduce((sum, fee) => 
            sum + (fee.amount - fee.paidAmount), 0
        );

        res.status(200).json({
            success: true,
            data: {
                fees: outstandingFees,
                summary: {
                    totalOutstanding,
                    totalStudents: outstandingFees.length,
                    overdueCount: outstandingFees.filter(f => f.dueDate < new Date()).length
                }
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Record payment
 * @route   POST /api/accountant/record-payment
 * @access  Accountant only
 */
exports.recordPayment = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        const { 
            studentId, 
            feeId, 
            amount, 
            paymentMethod, 
            paymentDate,
            transactionId,
            notes 
        } = req.body;

        // Validate fee exists and belongs to school
        const fee = await Fee.findOne({ _id: feeId, schoolCode });
        if (!fee) {
            return res.status(404).json({
                success: false,
                message: 'Fee not found'
            });
        }

        // Create payment record
        const payment = await PaymentHistory.create({
            studentId,
            feeId,
            amount,
            paymentMethod,
            paymentDate: paymentDate || new Date(),
            transactionId,
            notes,
            schoolCode,
            recordedBy: req.user.id
        });

        // Update fee status
        const newPaidAmount = fee.paidAmount + amount;
        const newStatus = newPaidAmount >= fee.amount ? 'paid' : 'partial';

        await Fee.findByIdAndUpdate(feeId, {
            paidAmount: newPaidAmount,
            status: newStatus,
            lastPaymentDate: paymentDate || new Date()
        });

        res.status(201).json({
            success: true,
            message: 'Payment recorded successfully',
            data: payment
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Get fee structure management
 * @route   GET /api/accountant/fee-structures
 * @access  Accountant only
 */
exports.getFeeStructures = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;

        const feeStructures = await FeeStructure.find({ schoolCode })
            .populate('classId', 'className')
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: feeStructures
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Create fee structure
 * @route   POST /api/accountant/fee-structures
 * @access  Accountant only
 */
exports.createFeeStructure = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        const {
            name,
            description,
            classId,
            feeType,
            amount,
            frequency,
            dueDate,
            isOptional
        } = req.body;

        const feeStructure = await FeeStructure.create({
            name,
            description,
            classId,
            feeType,
            amount,
            frequency,
            dueDate,
            isOptional: isOptional || false,
            schoolCode,
            createdBy: req.user.id
        });

        res.status(201).json({
            success: true,
            message: 'Fee structure created successfully',
            data: feeStructure
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

/**
 * @desc    Generate fee invoices
 * @route   POST /api/accountant/generate-invoices
 * @access  Accountant only
 */
exports.generateInvoices = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        const { classId, sectionId, feeStructureId, dueDate } = req.body;

        // Get students for invoice generation
        const matchCriteria = { schoolCode, isActive: true };
        if (classId) matchCriteria.classId = classId;
        if (sectionId) matchCriteria.sectionId = sectionId;

        const students = await Student.find(matchCriteria);

        // Generate fee records for each student
        const invoices = await Promise.all(
            students.map(async (student) => {
                // Check if fee already exists
                const existingFee = await Fee.findOne({
                    studentId: student._id,
                    feeStructureId,
                    dueDate
                });

                if (existingFee) {
                    return existingFee;
                }

                return await Fee.create({
                    studentId: student._id,
                    feeStructureId,
                    amount: 0, // Will be set from fee structure
                    paidAmount: 0,
                    dueDate,
                    status: 'unpaid',
                    schoolCode,
                    generatedBy: req.user.id
                });
            })
        );

        res.status(201).json({
            success: true,
            message: `Generated ${invoices.length} fee invoices`,
            data: {
                generatedCount: invoices.length,
                invoices
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};
