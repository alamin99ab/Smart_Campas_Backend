/**
 * Accountant controller aligned with the canonical fee ledger model:
 * Fee.amountDue/amountPaid/status + PaymentHistory.amount/month/year/createdAt.
 */

const mongoose = require('mongoose');

const Fee = require('../models/Fee');
const FeeStructure = require('../models/FeeStructure');
const PaymentHistory = require('../models/PaymentHistory');
const Student = require('../models/Student');
const School = require('../models/School');

const FEE_STATUS = { PAID: 'Paid', PARTIAL: 'Partial', UNPAID: 'Unpaid' };
const PAYMENT_METHODS = new Set(['Cash', 'Bank', 'Mobile Banking', 'Cheque', 'Online']);

const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const toPositive = (value) => {
    const n = toNumber(value, NaN);
    return Number.isFinite(n) && n >= 0 ? n : null;
};

const parseDate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

const parsePeriod = (monthInput, yearInput) => {
    const month = Math.floor(toNumber(monthInput, NaN));
    const year = Math.floor(toNumber(yearInput, NaN));
    if (!Number.isInteger(month) || month < 1 || month > 12) return null;
    if (!Number.isInteger(year) || year < 1900 || year > 3000) return null;
    return { month, year };
};

const normalizePaymentMethod = (method) => {
    if (typeof method !== 'string') return 'Cash';
    const normalized = method.trim();
    return PAYMENT_METHODS.has(normalized) ? normalized : 'Cash';
};

const computeOutstanding = (amountDue, amountPaid) => Math.max(0, toNumber(amountDue) - toNumber(amountPaid));

const computeStatus = (amountDue, amountPaid) => {
    if (toNumber(amountPaid) <= 0) return FEE_STATUS.UNPAID;
    return computeOutstanding(amountDue, amountPaid) <= 0 ? FEE_STATUS.PAID : FEE_STATUS.PARTIAL;
};

const sendError = (res, status, message, code = 'REQUEST_FAILED', details) => res.status(status).json({
    success: false,
    code,
    message,
    ...(details && process.env.NODE_ENV !== 'production' ? { details } : {})
});

const sendSuccess = (res, { status = 200, code = 'REQUEST_SUCCESS', message = 'Request successful', data, extra = {} } = {}) => {
    return res.status(status).json({
        success: true,
        code,
        message,
        ...(data !== undefined ? { data } : {}),
        ...extra
    });
};

const updateStudentTotalDue = async (studentId, schoolCode, session = null) => {
    const fees = await Fee.find({ studentId, schoolCode }).session(session).select('amountDue amountPaid');
    const totalDue = fees.reduce((sum, fee) => sum + computeOutstanding(fee.amountDue, fee.amountPaid), 0);
    await Student.findOneAndUpdate(
        { _id: studentId, schoolCode },
        { totalDue },
        { session: session || undefined }
    );
    return totalDue;
};

const mapFeeStructure = (doc) => {
    const row = doc.toObject ? doc.toObject() : doc;
    return {
        ...row,
        className: row.classLevel,
        name: `${row.classLevel} - ${row.feeType}`,
        type: String(row.feeType || '').toLowerCase(),
        dueDay: row.dueDayOfMonth
    };
};

const defaultAcademicYear = (school) => {
    if (school?.academicSettings?.currentSession) return school.academicSettings.currentSession;
    const y = new Date().getFullYear();
    return `${y}-${y + 1}`;
};

const parseFeeType = (value) => {
    const key = String(value || 'monthly').trim().toLowerCase();
    const map = {
        tuition: 'Tuition',
        monthly: 'Monthly',
        yearly: 'Yearly',
        transport: 'Transport',
        library: 'Library',
        lab: 'Lab',
        other: 'Other',
        examination: 'Other',
        sports: 'Other'
    };
    return map[key] || 'Monthly';
};

exports.getAccountantDashboard = async (req, res) => {
    const schoolCode = req.user.schoolCode;
    try {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

        const [studentCount, monthlyPayments, outstandingAgg, statusAgg, trendRows] = await Promise.all([
            Student.countDocuments({ schoolCode, isActive: true }),
            PaymentHistory.aggregate([
                { $match: { schoolCode, createdAt: { $gte: monthStart, $lt: monthEnd } } },
                { $group: { _id: null, totalAmount: { $sum: '$amount' }, totalPayments: { $sum: 1 } } }
            ]),
            Fee.aggregate([
                { $match: { schoolCode } },
                {
                    $group: {
                        _id: null,
                        totalOutstanding: { $sum: { $max: [0, { $subtract: ['$amountDue', '$amountPaid'] }] } }
                    }
                }
            ]),
            Fee.aggregate([
                { $match: { schoolCode } },
                { $group: { _id: '$status', count: { $sum: 1 } } }
            ]),
            PaymentHistory.aggregate([
                { $match: { schoolCode, createdAt: { $gte: trendStart } } },
                {
                    $group: {
                        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
                        total: { $sum: '$amount' }
                    }
                },
                { $sort: { '_id.year': 1, '_id.month': 1 } }
            ])
        ]);

        const monthlyCollection = monthlyPayments[0]?.totalAmount || 0;
        const monthlyPaymentsCount = monthlyPayments[0]?.totalPayments || 0;
        const totalOutstanding = outstandingAgg[0]?.totalOutstanding || 0;

        const paidCount = statusAgg.find((row) => row._id === FEE_STATUS.PAID)?.count || 0;
        const partialCount = statusAgg.find((row) => row._id === FEE_STATUS.PARTIAL)?.count || 0;
        const unpaidCount = statusAgg.find((row) => row._id === FEE_STATUS.UNPAID)?.count || 0;
        const totalRecords = paidCount + partialCount + unpaidCount;
        const collectionRate = totalRecords ? Math.round((paidCount / totalRecords) * 100) : 0;

        const trendMap = new Map(trendRows.map((row) => [`${row._id.year}-${row._id.month}`, row.total]));
        const months = [];
        const monthlyCollectionSeries = [];
        const monthlyOutstandingSeries = [];
        for (let i = 5; i >= 0; i -= 1) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
            months.push(d.toLocaleString('en-US', { month: 'short' }));
            monthlyCollectionSeries.push(trendMap.get(key) || 0);
            monthlyOutstandingSeries.push(totalOutstanding);
        }

        return sendSuccess(res, {
            code: 'ACCOUNTANT_DASHBOARD_FETCHED',
            message: 'Accountant dashboard fetched successfully',
            data: {
                monthlyCollection,
                monthlyPayments: monthlyPaymentsCount,
                totalOutstanding,
                totalStudents: studentCount,
                pendingInvoices: unpaidCount + partialCount,
                collectionRate,
                studentFeeStats: {
                    paid: paidCount,
                    partial: partialCount,
                    unpaid: unpaidCount
                },
                months,
                monthlyCollectionSeries,
                monthlyOutstandingSeries
            }
        });
    } catch (error) {
        console.error('getAccountantDashboard error:', error);
        return sendError(res, 500, 'Failed to fetch dashboard', 'ACCOUNTANT_DASHBOARD_FETCH_FAILED', error.message);
    }
};

exports.getCollectionReport = async (req, res) => {
    const schoolCode = req.user.schoolCode;
    const { startDate, endDate } = req.query;
    try {
        const match = { schoolCode };
        const start = parseDate(startDate);
        const end = parseDate(endDate);
        if (start || end) {
            match.createdAt = {};
            if (start) match.createdAt.$gte = start;
            if (end) match.createdAt.$lte = end;
        }

        const [rows, totals] = await Promise.all([
            PaymentHistory.aggregate([
                { $match: match },
                {
                    $lookup: {
                        from: 'fees',
                        localField: 'feeId',
                        foreignField: '_id',
                        as: 'fee'
                    }
                },
                { $unwind: { path: '$fee', preserveNullAndEmptyArrays: true } },
                {
                    $lookup: {
                        from: 'students',
                        localField: 'studentId',
                        foreignField: '_id',
                        as: 'student'
                    }
                },
                { $unwind: { path: '$student', preserveNullAndEmptyArrays: true } },
                {
                    $group: {
                        _id: {
                            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                            class: '$student.studentClass',
                            section: '$student.section',
                            feeType: { $ifNull: ['$fee.feeType', 'General'] }
                        },
                        totalAmount: { $sum: '$amount' },
                        paymentCount: { $sum: 1 }
                    }
                },
                { $sort: { '_id.date': -1 } }
            ]),
            PaymentHistory.aggregate([
                { $match: match },
                { $group: { _id: null, totalCollected: { $sum: '$amount' }, totalPayments: { $sum: 1 } } }
            ])
        ]);

        return sendSuccess(res, {
            code: 'COLLECTION_REPORT_FETCHED',
            message: 'Collection report fetched successfully',
            data: rows,
            extra: {
                summary: {
                    totalCollected: totals[0]?.totalCollected || 0,
                    totalPayments: totals[0]?.totalPayments || 0,
                    totalDue: 0
                }
            }
        });
    } catch (error) {
        console.error('getCollectionReport error:', error);
        return sendError(res, 500, 'Failed to fetch collection report', 'COLLECTION_REPORT_FETCH_FAILED', error.message);
    }
};

exports.getOutstandingFees = async (req, res) => {
    const schoolCode = req.user.schoolCode;
    try {
        const now = new Date();
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const rows = await Fee.aggregate([
            { $match: { schoolCode, $expr: { $gt: ['$amountDue', '$amountPaid'] } } },
            {
                $project: {
                    studentId: 1,
                    outstanding: { $max: [0, { $subtract: ['$amountDue', '$amountPaid'] }] },
                    isOverdue: {
                        $lt: [
                            { $dateFromParts: { year: '$year', month: '$month', day: 1 } },
                            startOfCurrentMonth
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: '$studentId',
                    totalDue: { $sum: '$outstanding' },
                    overdueAmount: { $sum: { $cond: ['$isOverdue', '$outstanding', 0] } }
                }
            },
            { $lookup: { from: 'students', localField: '_id', foreignField: '_id', as: 'student' } },
            { $unwind: '$student' },
            {
                $project: {
                    _id: '$student._id',
                    studentId: '$student._id',
                    studentName: '$student.name',
                    roll: '$student.roll',
                    class: '$student.studentClass',
                    section: '$student.section',
                    totalDue: 1,
                    overdueAmount: 1
                }
            },
            { $sort: { totalDue: -1, studentName: 1 } }
        ]);

        const summary = rows.reduce((acc, row) => {
            acc.totalOutstanding += toNumber(row.totalDue);
            acc.overdueTotal += toNumber(row.overdueAmount);
            if (toNumber(row.overdueAmount) > 0) acc.overdueCount += 1;
            return acc;
        }, { totalOutstanding: 0, overdueTotal: 0, overdueCount: 0 });

        return sendSuccess(res, {
            code: 'OUTSTANDING_FEES_FETCHED',
            message: 'Outstanding fees fetched successfully',
            data: rows,
            extra: { summary }
        });
    } catch (error) {
        console.error('getOutstandingFees error:', error);
        return sendError(res, 500, 'Failed to fetch outstanding fees', 'OUTSTANDING_FEES_FETCH_FAILED', error.message);
    }
};

exports.recordPayment = async (req, res) => {
    const schoolCode = req.user.schoolCode;
    const actorId = req.user._id || req.user.id;
    const { studentId, feeId, amount, paymentMethod, month, year, transactionId, remarks, notes } = req.body || {};
    const normalizedRemarks = remarks || notes;
    const period = (month && year) ? parsePeriod(month, year) : null;
    if ((month || year) && !period) return sendError(res, 400, 'Invalid month/year', 'VALIDATION_ERROR');

    const fail = (status, code, message) => {
        const err = new Error(message);
        err.status = status;
        err.code = code;
        throw err;
    };

    try {
        const student = await Student.findOne({ _id: studentId, schoolCode });
        if (!student) fail(404, 'STUDENT_NOT_FOUND', 'Student not found');

        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const query = { schoolCode, studentId: student._id };
            if (feeId) query._id = feeId;
            if (!feeId && period) {
                query.month = period.month;
                query.year = period.year;
            }

            const fees = await Fee.find(query).session(session).sort({ year: 1, month: 1 });
            if (!fees.length) fail(404, 'FEE_NOT_FOUND', 'No fee records found for this payment');

            const payable = fees
                .map((fee) => ({ fee, outstanding: computeOutstanding(fee.amountDue, fee.amountPaid) }))
                .filter((row) => row.outstanding > 0);
            if (!payable.length) fail(400, 'NO_OUTSTANDING_FEES', 'Selected fee records are already paid');

            const payAmount = toPositive(amount);
            if (payAmount === null || payAmount <= 0) fail(400, 'VALIDATION_ERROR', 'amount must be positive');
            const totalOutstanding = payable.reduce((sum, row) => sum + row.outstanding, 0);
            if (payAmount > totalOutstanding) {
                fail(400, 'PAYMENT_EXCEEDS_OUTSTANDING', `Payment exceeds outstanding amount (${totalOutstanding.toFixed(2)})`);
            }

            let remaining = payAmount;
            const paymentRows = [];
            for (const row of payable) {
                if (remaining <= 0) break;
                const applied = Math.min(remaining, row.outstanding);
                row.fee.amountPaid = toNumber(row.fee.amountPaid) + applied;
                row.fee.status = computeStatus(row.fee.amountDue, row.fee.amountPaid);
                row.fee.updatedBy = actorId;
                row.fee.updatedAt = new Date();
                await row.fee.save({ session });

                const docs = await PaymentHistory.create([{
                    feeId: row.fee._id,
                    studentId: row.fee.studentId,
                    month: row.fee.month,
                    year: row.fee.year,
                    amount: applied,
                    previousDue: row.outstanding,
                    newDue: Math.max(0, row.outstanding - applied),
                    paymentMethod: normalizePaymentMethod(paymentMethod),
                    transactionId: transactionId || undefined,
                    remarks: normalizedRemarks || undefined,
                    receivedBy: actorId,
                    schoolCode
                }], { session });

                paymentRows.push(docs[0]);
                remaining -= applied;
            }

            await updateStudentTotalDue(student._id, schoolCode, session);
            await session.commitTransaction();

            return sendSuccess(res, {
                status: 201,
                code: 'PAYMENT_RECORDED',
                message: 'Payment recorded successfully',
                data: {
                    appliedAmount: payAmount - remaining,
                    paymentEntries: paymentRows
                }
            });
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    } catch (error) {
        console.error('recordPayment error:', error);
        return sendError(
            res,
            error.status || 500,
            error.message || 'Failed to record payment',
            error.code || 'PAYMENT_RECORD_FAILED'
        );
    }
};

exports.getFeeStructures = async (req, res) => {
    try {
        const rows = await FeeStructure.find({ schoolCode: req.user.schoolCode }).sort({ createdAt: -1 });
        return sendSuccess(res, {
            code: 'ACCOUNTANT_FEE_STRUCTURES_FETCHED',
            message: 'Fee structures fetched successfully',
            data: rows.map(mapFeeStructure)
        });
    } catch (error) {
        console.error('getFeeStructures (accountant) error:', error);
        return sendError(res, 500, 'Failed to fetch fee structures', 'FEE_STRUCTURES_FETCH_FAILED', error.message);
    }
};

exports.createFeeStructure = async (req, res) => {
    try {
        const school = await School.findOne({ schoolCode: req.user.schoolCode }).select('_id schoolCode academicSettings');
        if (!school) return sendError(res, 404, 'School not found', 'SCHOOL_NOT_FOUND');

        const classLevel = String(req.body.classLevel || req.body.className || req.body.name || '').trim();
        if (!classLevel) return sendError(res, 400, 'classLevel is required', 'VALIDATION_ERROR');
        const amount = toPositive(req.body.amount);
        if (amount === null) return sendError(res, 400, 'amount must be non-negative', 'VALIDATION_ERROR');

        const dueDate = parseDate(req.body.dueDate);
        const dueDayOfMonth = req.body.dueDayOfMonth !== undefined
            ? Math.min(Math.max(Math.floor(toNumber(req.body.dueDayOfMonth, 1)), 1), 28)
            : (dueDate ? Math.min(Math.max(dueDate.getDate(), 1), 28) : undefined);

        const structure = await FeeStructure.create({
            schoolId: school._id,
            schoolCode: school.schoolCode,
            academicYear: String(req.body.academicYear || defaultAcademicYear(school)).trim(),
            classLevel,
            section: req.body.section || undefined,
            feeType: parseFeeType(req.body.feeType || req.body.type),
            amount,
            dueDayOfMonth,
            lateFinePerDay: toPositive(req.body.lateFinePerDay) ?? 0,
            isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
            createdBy: req.user._id || req.user.id
        });

        return sendSuccess(res, {
            status: 201,
            code: 'ACCOUNTANT_FEE_STRUCTURE_CREATED',
            message: 'Fee structure created successfully',
            data: mapFeeStructure(structure)
        });
    } catch (error) {
        if (error?.code === 11000) return sendError(res, 400, 'Fee structure already exists', 'FEE_STRUCTURE_DUPLICATE');
        console.error('createFeeStructure (accountant) error:', error);
        return sendError(res, 500, 'Failed to create fee structure', 'FEE_STRUCTURE_CREATE_FAILED', error.message);
    }
};

exports.generateInvoices = async (req, res) => {
    const schoolCode = req.user.schoolCode;
    const requestedClassLevel = String(req.body.classLevel || req.body.className || '').trim();
    const requestedSection = req.body.section ? String(req.body.section).trim() : null;
    const period = parsePeriod(req.body.month || new Date().getMonth() + 1, req.body.year || new Date().getFullYear());
    if (!period) return sendError(res, 400, 'month and year are required', 'VALIDATION_ERROR');

    try {
        const school = await School.findOne({ schoolCode }).select('_id academicSettings');
        if (!school) return sendError(res, 404, 'School not found', 'SCHOOL_NOT_FOUND');
        const academicYear = String(req.body.academicYear || defaultAcademicYear(school)).trim();

        const explicitAmount = req.body.amount !== undefined ? toPositive(req.body.amount) : null;
        if (req.body.amount !== undefined && explicitAmount === null) {
            return sendError(res, 400, 'amount must be non-negative', 'VALIDATION_ERROR');
        }

        const targetMap = new Map();
        const targetKey = (classLevel, section) => `${classLevel}::${section || ''}`;

        if (requestedClassLevel) {
            targetMap.set(targetKey(requestedClassLevel, requestedSection), {
                classLevel: requestedClassLevel,
                section: requestedSection,
                amountDue: explicitAmount
            });
        } else {
            const structureQuery = { schoolCode, academicYear, isActive: true };
            if (req.body.feeType || req.body.type) structureQuery.feeType = parseFeeType(req.body.feeType || req.body.type);

            const structures = await FeeStructure.find(structureQuery)
                .sort({ createdAt: -1 })
                .select('classLevel section amount');

            structures.forEach((structure) => {
                const key = targetKey(structure.classLevel, structure.section || null);
                if (!targetMap.has(key)) {
                    targetMap.set(key, {
                        classLevel: structure.classLevel,
                        section: structure.section || null,
                        amountDue: explicitAmount !== null ? explicitAmount : toNumber(structure.amount)
                    });
                }
            });

            if (!targetMap.size && explicitAmount !== null) {
                const classRows = await Student.aggregate([
                    { $match: { schoolCode, isActive: true } },
                    { $group: { _id: '$studentClass' } }
                ]);

                classRows.forEach((row) => {
                    if (row._id) {
                        targetMap.set(targetKey(row._id, null), {
                            classLevel: row._id,
                            section: null,
                            amountDue: explicitAmount
                        });
                    }
                });
            }
        }

        if (!targetMap.size) {
            return sendError(
                res,
                400,
                'No class target found. Provide classLevel or configure active fee structures.',
                'FEE_STRUCTURE_REQUIRED'
            );
        }

        const session = await mongoose.startSession();
        session.startTransaction();
        let createdCount = 0;
        let updatedCount = 0;
        const touchedStudentIds = [];
        const processedTargets = [];
        try {
            for (const target of targetMap.values()) {
                const amountDue = explicitAmount !== null ? explicitAmount : target.amountDue;
                if (amountDue === null || !Number.isFinite(amountDue)) {
                    continue;
                }

                const studentQuery = { schoolCode, studentClass: target.classLevel, isActive: true };
                if (target.section) studentQuery.section = target.section;
                const students = await Student.find(studentQuery).select('_id');
                if (!students.length) continue;

                processedTargets.push({
                    classLevel: target.classLevel,
                    section: target.section,
                    studentCount: students.length,
                    amountDue
                });

                for (const student of students) {
                    const existing = await Fee.findOne({
                        schoolCode,
                        studentId: student._id,
                        month: period.month,
                        year: period.year
                    }).session(session);
                    if (existing) {
                        if (req.body.overwrite === true) {
                            existing.amountDue = Math.max(amountDue, toNumber(existing.amountPaid));
                            existing.status = computeStatus(existing.amountDue, existing.amountPaid);
                            existing.updatedBy = req.user._id || req.user.id;
                            existing.updatedAt = new Date();
                            await existing.save({ session });
                            updatedCount += 1;
                            touchedStudentIds.push(student._id);
                        }
                        continue;
                    }

                    await Fee.create([{
                        studentId: student._id,
                        month: period.month,
                        year: period.year,
                        amountDue,
                        amountPaid: 0,
                        status: FEE_STATUS.UNPAID,
                        schoolCode,
                        createdBy: req.user._id || req.user.id,
                        updatedBy: req.user._id || req.user.id
                    }], { session });
                    createdCount += 1;
                    touchedStudentIds.push(student._id);
                }
            }

            if (!createdCount && !updatedCount) {
                throw Object.assign(new Error('No active students found for invoice generation targets'), {
                    status: 404,
                    code: 'NO_STUDENTS_FOUND'
                });
            }

            await Promise.all(Array.from(new Set(touchedStudentIds.map((id) => String(id))))
                .map((id) => updateStudentTotalDue(id, schoolCode, session)));
            await session.commitTransaction();
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }

        return sendSuccess(res, {
            status: 201,
            code: 'ACCOUNTANT_INVOICES_GENERATED',
            message: `Invoices processed (${createdCount} created, ${updatedCount} updated)`,
            data: {
                month: period.month,
                year: period.year,
                createdCount,
                updatedCount,
                targets: processedTargets
            }
        });
    } catch (error) {
        if (error?.status) return sendError(res, error.status, error.message, error.code || 'REQUEST_FAILED');
        console.error('generateInvoices (accountant) error:', error);
        return sendError(res, 500, 'Failed to generate invoices', 'INVOICE_GENERATION_FAILED', error.message);
    }
};
