const mongoose = require('mongoose');
const Excel = require('exceljs');
const PDFDocument = require('pdfkit');

const Fee = require('../models/Fee');
const Student = require('../models/Student');
const User = require('../models/User');
const Class = require('../models/Class');
const PaymentHistory = require('../models/PaymentHistory');
const FeeStructure = require('../models/FeeStructure');
const School = require('../models/School');
const AuditLog = require('../models/AuditLog');

const { sendSMS } = require('../utils/smsService');
const { sendEmail } = require('../utils/emailService');

const FEE_STATUS = { PAID: 'Paid', PARTIAL: 'Partial', UNPAID: 'Unpaid' };
const PAYMENT_METHODS = new Set(['Cash', 'Bank', 'Mobile Banking', 'Cheque', 'Online']);
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];

const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const toPositive = (value) => {
    const n = toNumber(value, NaN);
    return Number.isFinite(n) && n >= 0 ? n : null;
};

const parsePeriod = (monthInput, yearInput) => {
    const month = Math.floor(toNumber(monthInput, NaN));
    const year = Math.floor(toNumber(yearInput, NaN));
    if (!Number.isInteger(month) || month < 1 || month > 12) return null;
    if (!Number.isInteger(year) || year < 1900 || year > 3000) return null;
    return { month, year };
};

const parseDate = (value) => {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

const computeOutstanding = (amountDue, amountPaid) => Math.max(0, toNumber(amountDue) - toNumber(amountPaid));
const computeStatus = (amountDue, amountPaid) => {
    if (toNumber(amountPaid) <= 0) return FEE_STATUS.UNPAID;
    return computeOutstanding(amountDue, amountPaid) <= 0 ? FEE_STATUS.PAID : FEE_STATUS.PARTIAL;
};

const normalizeStatus = (status) => {
    if (typeof status !== 'string') return null;
    const lower = status.trim().toLowerCase();
    if (lower === 'paid') return FEE_STATUS.PAID;
    if (lower === 'partial') return FEE_STATUS.PARTIAL;
    if (lower === 'unpaid') return FEE_STATUS.UNPAID;
    return null;
};

const normalizePaymentMethod = (method) => {
    if (typeof method !== 'string') return 'Cash';
    const normalized = method.trim();
    return PAYMENT_METHODS.has(normalized) ? normalized : 'Cash';
};

const monthName = (month) => MONTH_NAMES[month - 1] || 'Unknown';

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

const safeAudit = async (req, action, details) => {
    try {
        if (!AuditLog || mongoose.connection.readyState !== 1) return;
        const user = req?.user?._id || req?.user?.id;
        if (!user) return;
        await AuditLog.create({
            user,
            action,
            details,
            schoolCode: req?.user?.schoolCode,
            ip: req?.ip,
            userAgent: req?.headers?.['user-agent']
        });
    } catch (error) {
        console.error('Fee audit error:', error.message);
    }
};

const updateStudentTotalDue = async (studentId, schoolCode, session = null) => {
    const fees = await Fee.find({ studentId, schoolCode }).session(session).select('amountDue amountPaid');
    const totalDue = fees.reduce((sum, fee) => sum + computeOutstanding(fee.amountDue, fee.amountPaid), 0);
    await Student.findByIdAndUpdate(studentId, { totalDue }, { session: session || undefined });
    return totalDue;
};

const sendReceipt = async ({ student, fee, amount, paymentMethod }) => {
    if (!student) return;
    try {
        if (student.guardian?.phone) {
            await sendSMS({
                to: student.guardian.phone,
                message: `Payment received: ${amount} for ${student.name} (${monthName(fee.month)} ${fee.year}).`
            });
        }
        if (student.guardian?.email) {
            await sendEmail({
                to: student.guardian.email,
                subject: 'Fee Payment Receipt',
                template: 'payment-receipt',
                data: {
                    studentName: student.name,
                    amount,
                    month: monthName(fee.month),
                    year: fee.year,
                    method: paymentMethod,
                    date: new Date().toLocaleDateString()
                }
            });
        }
    } catch (error) {
        console.error('Send payment receipt error:', error.message);
    }
};

const resolveStudentFromAuth = async (req) => {
    const schoolCode = req.user.schoolCode;
    const userId = req.user._id || req.user.id;
    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
        const byId = await Student.findOne({ _id: userId, schoolCode });
        if (byId) return byId;
    }
    const roll = req.user.roll || req.user.rollNumber;
    if (roll) return Student.findOne({ schoolCode, roll: String(roll).trim() });
    return null;
};

const resolveStudentByRef = async (studentRef, schoolCode) => {
    if (!studentRef || !schoolCode) return null;

    const ref = String(studentRef).trim();
    if (mongoose.Types.ObjectId.isValid(ref)) {
        const byId = await Student.findOne({ _id: ref, schoolCode });
        if (byId) return byId;

        const userDoc = await User.findOne({ _id: ref, role: 'student', schoolCode }).select('rollNumber classId section');
        if (userDoc?.rollNumber) {
            const roll = String(userDoc.rollNumber).trim();
            const studentQuery = { schoolCode, roll };

            if (userDoc.classId) {
                const classDoc = await Class.findById(userDoc.classId).select('className').lean();
                if (classDoc?.className) studentQuery.studentClass = classDoc.className;
            }
            if (userDoc.section) studentQuery.section = userDoc.section;

            let byUser = await Student.findOne(studentQuery);
            if (!byUser && studentQuery.section) {
                delete studentQuery.section;
                byUser = await Student.findOne(studentQuery);
            }
            if (byUser) return byUser;
        }
    }

    const byRoll = await Student.findOne({ schoolCode, roll: ref });
    if (byRoll) return byRoll;

    return null;
};

const resolveAuthenticatedStudent = async (req) => {
    return resolveStudentFromAuth(req);
};

const mapFeeStructure = (doc) => {
    const row = doc.toObject ? doc.toObject() : doc;
    const now = new Date();
    const dueDate = row.dueDayOfMonth
        ? new Date(now.getFullYear(), now.getMonth(), row.dueDayOfMonth)
        : null;
    return {
        ...row,
        className: row.classLevel,
        name: `${row.classLevel} - ${row.feeType}`,
        type: String(row.feeType || '').toLowerCase(),
        dueDay: row.dueDayOfMonth,
        dueDate: dueDate ? dueDate.toISOString() : null
    };
};

const defaultAcademicYear = (school) => {
    if (school?.academicSettings?.currentSession) return school.academicSettings.currentSession;
    const year = new Date().getFullYear();
    return `${year}-${year + 1}`;
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

const applyPaymentAcrossFees = async ({
    schoolCode, studentId, amount, paymentMethod, transactionId, remarks, actorId, feeId, month, year, session
}) => {
    const payableAmount = toPositive(amount);
    if (payableAmount === null || payableAmount <= 0) throw new Error('Payment amount must be a positive number');

    const query = { schoolCode, studentId };
    if (feeId) query._id = feeId;
    if (!feeId && month && year) {
        query.month = month;
        query.year = year;
    }

    const feeRows = await Fee.find(query).session(session).sort({ year: 1, month: 1, createdAt: 1 });
    if (!feeRows.length) throw new Error('No fee records found');

    const rows = feeRows
        .map((fee) => ({ fee, outstanding: computeOutstanding(fee.amountDue, fee.amountPaid) }))
        .filter((row) => row.outstanding > 0);
    if (!rows.length) throw new Error('All selected fee records are already paid');

    const totalOutstanding = rows.reduce((sum, row) => sum + row.outstanding, 0);
    if (payableAmount > totalOutstanding) {
        throw new Error(`Payment exceeds outstanding amount (${totalOutstanding.toFixed(2)})`);
    }

    let remaining = payableAmount;
    const paymentEntries = [];
    for (const row of rows) {
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
            remarks: remarks || undefined,
            receivedBy: actorId || undefined,
            schoolCode
        }], { session });
        paymentEntries.push(docs[0]);
        remaining -= applied;
    }

    return { appliedAmount: payableAmount - remaining, paymentEntries };
};

exports.getFees = async (req, res) => {
    try {
        const { page = 1, limit = 10, studentId, month, year, status } = req.query;
        const filter = { schoolCode: req.user.schoolCode };
        if (studentId) filter.studentId = studentId;
        if (month && year) {
            const period = parsePeriod(month, year);
            if (!period) return sendError(res, 400, 'Invalid month/year', 'VALIDATION_ERROR');
            filter.month = period.month;
            filter.year = period.year;
        }
        if (status) {
            const normalizedStatus = normalizeStatus(status);
            if (!normalizedStatus) return sendError(res, 400, 'Invalid status', 'VALIDATION_ERROR');
            filter.status = normalizedStatus;
        }

        const pageNum = Math.max(toNumber(page, 1), 1);
        const limitNum = Math.min(Math.max(toNumber(limit, 10), 1), 500);
        const skip = (pageNum - 1) * limitNum;

        const [fees, total] = await Promise.all([
            Fee.find(filter)
                .populate('studentId', 'name roll studentClass section')
                .sort({ year: -1, month: -1, createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Fee.countDocuments(filter)
        ]);

        const summary = fees.reduce((acc, fee) => {
            acc.totalAssessed += toNumber(fee.amountDue);
            acc.totalPaid += toNumber(fee.amountPaid);
            acc.totalDue += computeOutstanding(fee.amountDue, fee.amountPaid);
            return acc;
        }, { totalAssessed: 0, totalPaid: 0, totalDue: 0 });

        return sendSuccess(res, {
            code: 'FEES_FETCHED',
            message: 'Fees fetched successfully',
            data: {
                fees,
                summary,
                pagination: {
                    page: pageNum,
                    limit: limitNum,
                    total,
                    pages: Math.max(Math.ceil(total / limitNum), 1)
                }
            }
        });
    } catch (error) {
        console.error('getFees error:', error);
        return sendError(res, 500, 'Failed to fetch fees', 'FEES_FETCH_FAILED', error.message);
    }
};

exports.updateFee = async (req, res) => {
    const { studentId, month, year, amountDue, amountPaid, paymentMethod, transactionId, remarks } = req.body || {};
    const schoolCode = req.user.schoolCode;
    const actorId = req.user._id || req.user.id;
    const period = parsePeriod(month, year);

    if (!studentId || !period) return sendError(res, 400, 'studentId, month, and year are required', 'VALIDATION_ERROR');
    const due = toPositive(amountDue);
    const paid = toPositive(amountPaid);
    if (due === null || paid === null) return sendError(res, 400, 'amountDue and amountPaid must be non-negative', 'VALIDATION_ERROR');

    try {
        const student = await resolveStudentByRef(studentId, schoolCode);
        if (!student) return sendError(res, 404, 'Student not found', 'STUDENT_NOT_FOUND');

        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const existing = await Fee.findOne({ studentId: student._id, month: period.month, year: period.year, schoolCode }).session(session);
            let feeDoc;
            let payment = null;

            if (existing) {
                const oldPaid = toNumber(existing.amountPaid);
                existing.amountDue = due;
                existing.amountPaid = paid;
                existing.status = computeStatus(due, paid);
                existing.updatedBy = actorId;
                existing.updatedAt = new Date();
                await existing.save({ session });
                feeDoc = existing;

                const increment = paid - oldPaid;
                if (increment > 0) {
                    const docs = await PaymentHistory.create([{
                        feeId: existing._id,
                        studentId: existing.studentId,
                        month: existing.month,
                        year: existing.year,
                        amount: increment,
                        previousDue: computeOutstanding(due, oldPaid),
                        newDue: computeOutstanding(due, paid),
                        paymentMethod: normalizePaymentMethod(paymentMethod),
                        transactionId: transactionId || undefined,
                        remarks: remarks || undefined,
                        receivedBy: actorId,
                        schoolCode
                    }], { session });
                    payment = docs[0];
                }
            } else {
                const docs = await Fee.create([{
                    studentId: student._id,
                    month: period.month,
                    year: period.year,
                    amountDue: due,
                    amountPaid: paid,
                    status: computeStatus(due, paid),
                    schoolCode,
                    createdBy: actorId,
                    updatedBy: actorId
                }], { session });
                feeDoc = docs[0];

                if (paid > 0) {
                    const pdocs = await PaymentHistory.create([{
                        feeId: feeDoc._id,
                        studentId: feeDoc.studentId,
                        month: feeDoc.month,
                        year: feeDoc.year,
                        amount: paid,
                        previousDue: due,
                        newDue: computeOutstanding(due, paid),
                        paymentMethod: normalizePaymentMethod(paymentMethod),
                        transactionId: transactionId || undefined,
                        remarks: remarks || undefined,
                        receivedBy: actorId,
                        schoolCode
                    }], { session });
                    payment = pdocs[0];
                }
            }

            await updateStudentTotalDue(student._id, schoolCode, session);
            await session.commitTransaction();

            await safeAudit(req, existing ? 'FEE_UPDATED' : 'FEE_CREATED', {
                feeId: feeDoc._id, studentId: student._id, month: period.month, year: period.year, amountDue: due, amountPaid: paid
            });

            if (payment && process.env.SEND_PAYMENT_RECEIPT === 'true') {
                await sendReceipt({ student, fee: feeDoc, amount: payment.amount, paymentMethod: payment.paymentMethod });
            }

            return sendSuccess(res, {
                code: existing ? 'FEE_UPDATED' : 'FEE_CREATED',
                message: existing ? 'Fee updated successfully' : 'Fee created successfully',
                data: { fee: feeDoc, payment },
                extra: { fee: feeDoc }
            });
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    } catch (error) {
        console.error('updateFee error:', error);
        return sendError(res, 500, 'Failed to update fee', 'FEE_UPDATE_FAILED', error.message);
    }
};

exports.collectPayment = async (req, res) => {
    const { studentId, amount, paymentMethod, transactionId, remarks, feeId, month, year } = req.body || {};
    const schoolCode = req.user.schoolCode;
    const actorId = req.user._id || req.user.id;
    if (!studentId) return sendError(res, 400, 'Student ID is required', 'VALIDATION_ERROR');
    const period = (month && year) ? parsePeriod(month, year) : null;
    if ((month || year) && !period) return sendError(res, 400, 'Invalid month/year', 'VALIDATION_ERROR');

    try {
        const student = await resolveStudentByRef(studentId, schoolCode);
        if (!student) return sendError(res, 404, 'Student not found', 'STUDENT_NOT_FOUND');

        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const result = await applyPaymentAcrossFees({
                schoolCode,
                studentId: student._id,
                amount,
                paymentMethod,
                transactionId,
                remarks,
                actorId,
                feeId,
                month: period?.month,
                year: period?.year,
                session
            });
            await updateStudentTotalDue(student._id, schoolCode, session);
            await session.commitTransaction();

            if (result.paymentEntries.length && process.env.SEND_PAYMENT_RECEIPT === 'true') {
                const latest = result.paymentEntries[result.paymentEntries.length - 1];
                const fee = await Fee.findById(latest.feeId);
                await sendReceipt({ student, fee, amount: latest.amount, paymentMethod: latest.paymentMethod });
            }

            return sendSuccess(res, {
                status: 201,
                code: 'FEE_PAYMENT_COLLECTED',
                message: 'Payment collected successfully',
                data: { appliedAmount: result.appliedAmount, payments: result.paymentEntries }
            });
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    } catch (error) {
        return sendError(res, 400, error.message || 'Payment failed', 'PAYMENT_COLLECTION_FAILED');
    }
};

exports.getClearance = async (req, res) => {
    const { studentId } = req.params;
    const schoolCode = req.user.schoolCode;
    try {
        const [student, school] = await Promise.all([
            resolveStudentByRef(studentId, schoolCode),
            School.findOne({ schoolCode }).select('schoolName')
        ]);
        if (!student) return sendError(res, 404, 'Student not found', 'STUDENT_NOT_FOUND');

        const [fees, recentPayments] = await Promise.all([
            Fee.find({ studentId: student._id, schoolCode }).sort({ year: -1, month: -1 }),
            PaymentHistory.find({ studentId: student._id, schoolCode }).populate('receivedBy', 'name').sort({ createdAt: -1 }).limit(20)
        ]);

        const totalDue = fees.reduce((sum, fee) => sum + computeOutstanding(fee.amountDue, fee.amountPaid), 0);
        return sendSuccess(res, {
            code: 'FEE_CLEARANCE_FETCHED',
            message: 'Fee clearance fetched successfully',
            data: {
                studentId: student._id,
                studentName: student.name,
                studentClass: student.studentClass,
                roll: student.roll,
                schoolName: school?.schoolName || schoolCode,
                totalDue,
                isCleared: totalDue <= 0 || student.forceAdmit === true,
                specialPermission: Boolean(student.forceAdmit),
                monthlyBreakdown: fees.map((fee) => ({
                    feeId: fee._id,
                    month: fee.month,
                    year: fee.year,
                    amountDue: fee.amountDue,
                    amountPaid: fee.amountPaid,
                    due: computeOutstanding(fee.amountDue, fee.amountPaid),
                    status: fee.status
                })),
                recentPayments
            }
        });
    } catch (error) {
        console.error('getClearance error:', error);
        return sendError(res, 500, 'Failed to fetch clearance', 'FEE_CLEARANCE_FETCH_FAILED', error.message);
    }
};

exports.getStudentFeeHistory = async (req, res) => {
    const { studentId } = req.params;
    const schoolCode = req.user.schoolCode;
    try {
        const student = await resolveStudentByRef(studentId, schoolCode);
        if (!student) return sendError(res, 404, 'Student not found', 'STUDENT_NOT_FOUND');
        const [fees, paymentHistory] = await Promise.all([
            Fee.find({ studentId: student._id, schoolCode }).sort({ year: -1, month: -1 }),
            PaymentHistory.find({ studentId: student._id, schoolCode }).populate('receivedBy', 'name').sort({ createdAt: -1 })
        ]);
        return sendSuccess(res, {
            code: 'STUDENT_FEE_HISTORY_FETCHED',
            message: 'Fee history fetched successfully',
            data: {
                student: { id: student._id, name: student.name, roll: student.roll, class: student.studentClass, section: student.section },
                fees,
                paymentHistory
            }
        });
    } catch (error) {
        console.error('getStudentFeeHistory error:', error);
        return sendError(res, 500, 'Failed to fetch fee history', 'FEE_HISTORY_FETCH_FAILED', error.message);
    }
};

exports.getFeeReport = async (req, res) => {
    const { class: className, section, month, year, status, page = 1, limit = 20 } = req.query;
    const schoolCode = req.user.schoolCode;
    try {
        const query = { schoolCode };
        if (month && year) {
            const period = parsePeriod(month, year);
            if (!period) return sendError(res, 400, 'Invalid month/year', 'VALIDATION_ERROR');
            query.month = period.month;
            query.year = period.year;
        }
        if (status) {
            const normalizedStatus = normalizeStatus(status);
            if (!normalizedStatus) return sendError(res, 400, 'Invalid status filter', 'VALIDATION_ERROR');
            query.status = normalizedStatus;
        }
        if (className || section) {
            const studentQuery = { schoolCode };
            if (className) studentQuery.studentClass = className;
            if (section) studentQuery.section = section;
            const students = await Student.find(studentQuery).select('_id');
            query.studentId = { $in: students.map((s) => s._id) };
        }

        const pageNum = Math.max(toNumber(page, 1), 1);
        const limitNum = Math.min(Math.max(toNumber(limit, 20), 1), 500);
        const skip = (pageNum - 1) * limitNum;

        const [fees, total, summaryAgg] = await Promise.all([
            Fee.find(query)
                .populate('studentId', 'name roll studentClass section fatherName motherName guardian')
                .sort({ year: -1, month: -1, createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            Fee.countDocuments(query),
            Fee.aggregate([
                { $match: query },
                {
                    $group: {
                        _id: null,
                        totalAssessed: { $sum: '$amountDue' },
                        totalCollected: { $sum: '$amountPaid' },
                        totalDue: { $sum: { $max: [0, { $subtract: ['$amountDue', '$amountPaid'] }] } },
                        paidCount: { $sum: { $cond: [{ $eq: ['$status', FEE_STATUS.PAID] }, 1, 0] } },
                        partialCount: { $sum: { $cond: [{ $eq: ['$status', FEE_STATUS.PARTIAL] }, 1, 0] } },
                        unpaidCount: { $sum: { $cond: [{ $eq: ['$status', FEE_STATUS.UNPAID] }, 1, 0] } }
                    }
                }
            ])
        ]);

        const summary = summaryAgg[0] || { totalAssessed: 0, totalCollected: 0, totalDue: 0, paidCount: 0, partialCount: 0, unpaidCount: 0 };
        const payload = {
            fees,
            summary,
            pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.max(Math.ceil(total / limitNum), 1) }
        };

        return sendSuccess(res, {
            code: 'FEE_REPORT_FETCHED',
            message: 'Fee report fetched successfully',
            data: payload,
            extra: { fees, summary, totalPages: payload.pagination.totalPages, currentPage: pageNum, total }
        });
    } catch (error) {
        console.error('getFeeReport error:', error);
        return sendError(res, 500, 'Failed to fetch report', 'FEE_REPORT_FETCH_FAILED', error.message);
    }
};

exports.getDueList = async (req, res) => {
    const { class: className, section, month, year, minDue = 0 } = req.query;
    const schoolCode = req.user.schoolCode;
    try {
        const query = { schoolCode };
        if (month && year) {
            const period = parsePeriod(month, year);
            if (!period) return sendError(res, 400, 'Invalid month/year', 'VALIDATION_ERROR');
            query.month = period.month;
            query.year = period.year;
        }
        const rows = await Fee.find(query)
            .populate('studentId', 'name roll studentClass section fatherName guardian')
            .sort({ year: 1, month: 1 });

        const minDueNumber = Math.max(toNumber(minDue, 0), 0);
        const dues = rows.map((fee) => ({
            feeId: fee._id,
            studentId: fee.studentId?._id,
            studentName: fee.studentId?.name,
            roll: fee.studentId?.roll,
            class: fee.studentId?.studentClass,
            section: fee.studentId?.section,
            fatherName: fee.studentId?.fatherName,
            phone: fee.studentId?.guardian?.phone,
            month: fee.month,
            year: fee.year,
            amountDue: fee.amountDue,
            amountPaid: fee.amountPaid,
            dueAmount: computeOutstanding(fee.amountDue, fee.amountPaid),
            status: fee.status
        }))
            .filter((row) => row.studentId)
            .filter((row) => row.dueAmount > minDueNumber)
            .filter((row) => !className || row.class === className)
            .filter((row) => !section || row.section === section);

        return sendSuccess(res, {
            code: 'FEE_DUE_LIST_FETCHED',
            message: 'Due list fetched successfully',
            data: { totalDue: dues.reduce((sum, row) => sum + row.dueAmount, 0), totalStudents: dues.length, dues },
            extra: { totalDue: dues.reduce((sum, row) => sum + row.dueAmount, 0), totalStudents: dues.length, dues }
        });
    } catch (error) {
        console.error('getDueList error:', error);
        return sendError(res, 500, 'Failed to fetch due list', 'FEE_DUE_LIST_FETCH_FAILED', error.message);
    }
};

exports.giveSpecialPermission = async (req, res) => {
    try {
        if (req.user.role !== 'principal') {
            return sendError(res, 403, 'Access denied. Principal only.', 'FORBIDDEN');
        }

        const { studentId } = req.params;
        const { reason, expiryDate } = req.body || {};
        const student = await resolveStudentByRef(studentId, req.user.schoolCode);

        if (!student) return sendError(res, 404, 'Student not found', 'STUDENT_NOT_FOUND');

        student.forceAdmit = true;
        student.forceAdmitReason = reason || 'Special permission granted';
        student.forceAdmitExpiry = expiryDate || null;
        student.forceAdmitGrantedBy = req.user._id || req.user.id;
        student.forceAdmitGrantedAt = new Date();
        await student.save();

        await safeAudit(req, 'SPECIAL_PERMISSION_GRANTED', {
            studentId: student._id,
            reason: student.forceAdmitReason,
            expiryDate: student.forceAdmitExpiry
        });

        return sendSuccess(res, {
            code: 'SPECIAL_PERMISSION_GRANTED',
            message: 'Special permission granted successfully',
            data: {
                id: student._id,
                name: student.name,
                forceAdmit: true,
                forceAdmitExpiry: student.forceAdmitExpiry
            }
        });
    } catch (error) {
        console.error('giveSpecialPermission error:', error);
        return sendError(res, 500, 'Failed to grant special permission', 'SPECIAL_PERMISSION_FAILED', error.message);
    }
};

exports.revokeSpecialPermission = async (req, res) => {
    try {
        if (req.user.role !== 'principal') {
            return sendError(res, 403, 'Access denied. Principal only.', 'FORBIDDEN');
        }

        const student = await resolveStudentByRef(req.params.studentId, req.user.schoolCode);
        if (!student) return sendError(res, 404, 'Student not found', 'STUDENT_NOT_FOUND');

        student.forceAdmit = false;
        student.forceAdmitReason = null;
        student.forceAdmitExpiry = null;
        await student.save();

        await safeAudit(req, 'SPECIAL_PERMISSION_REVOKED', { studentId: student._id });

        return sendSuccess(res, {
            code: 'SPECIAL_PERMISSION_REVOKED',
            message: 'Special permission revoked',
            data: { id: student._id, forceAdmit: false }
        });
    } catch (error) {
        console.error('revokeSpecialPermission error:', error);
        return sendError(res, 500, 'Failed to revoke special permission', 'SPECIAL_PERMISSION_REVOKE_FAILED', error.message);
    }
};

exports.exportFeeReport = async (req, res) => {
    const { class: className, section, month, year, status } = req.query;

    try {
        const query = { schoolCode: req.user.schoolCode };
        if (month && year) {
            const period = parsePeriod(month, year);
            if (!period) return sendError(res, 400, 'Invalid month/year', 'VALIDATION_ERROR');
            query.month = period.month;
            query.year = period.year;
        }
        if (status) {
            const normalizedStatus = normalizeStatus(status);
            if (!normalizedStatus) return sendError(res, 400, 'Invalid status', 'VALIDATION_ERROR');
            query.status = normalizedStatus;
        }
        if (className || section) {
            const studentQuery = { schoolCode: req.user.schoolCode };
            if (className) studentQuery.studentClass = className;
            if (section) studentQuery.section = section;
            const students = await Student.find(studentQuery).select('_id');
            query.studentId = { $in: students.map((s) => s._id) };
        }

        const fees = await Fee.find(query)
            .populate('studentId', 'name roll studentClass section fatherName guardian')
            .sort({ year: -1, month: -1, createdAt: -1 })
            .lean();

        const workbook = new Excel.Workbook();
        const worksheet = workbook.addWorksheet('Fee Report');

        worksheet.columns = [
            { header: 'Student Name', key: 'studentName', width: 25 },
            { header: 'Class', key: 'className', width: 12 },
            { header: 'Section', key: 'section', width: 10 },
            { header: 'Roll', key: 'roll', width: 10 },
            { header: 'Month', key: 'month', width: 15 },
            { header: 'Year', key: 'year', width: 8 },
            { header: 'Amount Due', key: 'amountDue', width: 14 },
            { header: 'Amount Paid', key: 'amountPaid', width: 14 },
            { header: 'Due', key: 'due', width: 14 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Phone', key: 'phone', width: 15 }
        ];

        fees.forEach((fee) => {
            worksheet.addRow({
                studentName: fee.studentId?.name || 'N/A',
                className: fee.studentId?.studentClass || 'N/A',
                section: fee.studentId?.section || 'N/A',
                roll: fee.studentId?.roll || 'N/A',
                month: getMonthName(fee.month),
                year: fee.year,
                amountDue: toNumber(fee.amountDue),
                amountPaid: toNumber(fee.amountPaid),
                due: computeOutstanding(fee.amountDue, fee.amountPaid),
                status: fee.status,
                phone: fee.studentId?.guardian?.phone || 'N/A'
            });
        });

        const totals = fees.reduce((acc, fee) => {
            acc.totalDue += toNumber(fee.amountDue);
            acc.totalPaid += toNumber(fee.amountPaid);
            acc.totalOutstanding += computeOutstanding(fee.amountDue, fee.amountPaid);
            return acc;
        }, { totalDue: 0, totalPaid: 0, totalOutstanding: 0 });

        worksheet.addRow({});
        worksheet.addRow({
            studentName: 'SUMMARY',
            amountDue: totals.totalDue,
            amountPaid: totals.totalPaid,
            due: totals.totalOutstanding
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=fee_report_${Date.now()}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('exportFeeReport error:', error);
        return sendError(res, 500, 'Failed to export report', 'FEE_EXPORT_FAILED', error.message);
    }
};

exports.generateFeeSummaryPDF = async (req, res) => {
    const { month, year } = req.query;
    const period = parsePeriod(month, year);
    if (!period) return sendError(res, 400, 'Month and year required', 'VALIDATION_ERROR');

    try {
        const school = await School.findOne({ schoolCode: req.user.schoolCode }).select('schoolName');
        const [summaryRows, recentPayments] = await Promise.all([
            Fee.aggregate([
                {
                    $match: {
                        schoolCode: req.user.schoolCode,
                        month: period.month,
                        year: period.year
                    }
                },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 },
                        totalCollected: { $sum: '$amountPaid' },
                        totalDue: { $sum: { $max: [0, { $subtract: ['$amountDue', '$amountPaid'] }] } }
                    }
                }
            ]),
            PaymentHistory.find({
                schoolCode: req.user.schoolCode,
                month: period.month,
                year: period.year
            })
                .populate('studentId', 'name roll')
                .populate('receivedBy', 'name')
                .sort({ createdAt: -1 })
                .limit(20)
        ]);

        const map = new Map(summaryRows.map((row) => [row._id, row]));
        const paid = map.get(FEE_STATUS.PAID) || { count: 0, totalCollected: 0, totalDue: 0 };
        const partial = map.get(FEE_STATUS.PARTIAL) || { count: 0, totalCollected: 0, totalDue: 0 };
        const unpaid = map.get(FEE_STATUS.UNPAID) || { count: 0, totalCollected: 0, totalDue: 0 };

        const totalCollected = toNumber(paid.totalCollected) + toNumber(partial.totalCollected);
        const totalDue = toNumber(paid.totalDue) + toNumber(partial.totalDue) + toNumber(unpaid.totalDue);

        const doc = new PDFDocument({ margin: 48, size: 'A4' });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=fee_summary_${period.month}_${period.year}.pdf`);
        doc.pipe(res);

        doc.fontSize(18).text(school?.schoolName || req.user.schoolCode, { align: 'center' });
        doc.fontSize(14).text('Fee Collection Summary', { align: 'center' });
        doc.fontSize(11).text(`${getMonthName(period.month)} ${period.year}`, { align: 'center' });
        doc.moveDown();

        doc.fontSize(12).text(`Total Collected: ${totalCollected.toFixed(2)}`);
        doc.text(`Total Outstanding: ${totalDue.toFixed(2)}`);
        doc.text(`Paid Records: ${paid.count || 0}`);
        doc.text(`Partial Records: ${partial.count || 0}`);
        doc.text(`Unpaid Records: ${unpaid.count || 0}`);

        doc.moveDown();
        doc.fontSize(12).text('Recent Payments');
        doc.moveDown(0.5);

        let y = doc.y;
        recentPayments.slice(0, 12).forEach((payment) => {
            doc.fontSize(9)
                .text(new Date(payment.createdAt).toLocaleDateString(), 48, y)
                .text(payment.studentId?.name || 'N/A', 130, y)
                .text(String(payment.amount || 0), 300, y)
                .text(payment.paymentMethod || 'Cash', 390, y);
            y += 14;
        });

        doc.end();
    } catch (error) {
        console.error('generateFeeSummaryPDF error:', error);
        return sendError(res, 500, 'Failed to generate PDF', 'FEE_SUMMARY_PDF_FAILED', error.message);
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
            code: 'FEE_STRUCTURE_CREATED',
            message: 'Fee structure created successfully',
            data: mapFeeStructure(structure)
        });
    } catch (error) {
        if (error?.code === 11000) return sendError(res, 409, 'Fee structure already exists', 'FEE_STRUCTURE_DUPLICATE');
        console.error('createFeeStructure error:', error);
        return sendError(res, 500, 'Server error', 'FEE_STRUCTURE_CREATE_FAILED', error.message);
    }
};

exports.getFeeStructures = async (req, res) => {
    try {
        const { academicYear, classLevel, className, feeType } = req.query;
        const query = { schoolCode: req.user.schoolCode };
        if (academicYear) query.academicYear = academicYear;
        if (classLevel || className) query.classLevel = classLevel || className;
        if (feeType) query.feeType = parseFeeType(feeType);

        const rows = await FeeStructure.find(query).sort({ createdAt: -1 });
        return sendSuccess(res, {
            code: 'FEE_STRUCTURES_FETCHED',
            message: 'Fee structures fetched successfully',
            data: rows.map(mapFeeStructure)
        });
    } catch (error) {
        console.error('getFeeStructures error:', error);
        return sendError(res, 500, 'Server error', 'FEE_STRUCTURES_FETCH_FAILED', error.message);
    }
};

exports.updateFeeStructure = async (req, res) => {
    try {
        const structure = await FeeStructure.findOne({
            _id: req.params.id,
            schoolCode: req.user.schoolCode
        });
        if (!structure) return sendError(res, 404, 'Fee structure not found', 'FEE_STRUCTURE_NOT_FOUND');

        const classLevel = req.body.classLevel || req.body.className;
        if (classLevel !== undefined) structure.classLevel = String(classLevel).trim();
        if (req.body.section !== undefined) structure.section = req.body.section || undefined;
        if (req.body.feeType !== undefined || req.body.type !== undefined) {
            structure.feeType = parseFeeType(req.body.feeType || req.body.type);
        }
        if (req.body.academicYear !== undefined) structure.academicYear = String(req.body.academicYear).trim();
        if (req.body.isActive !== undefined) structure.isActive = Boolean(req.body.isActive);
        if (req.body.amount !== undefined) {
            const amount = toPositive(req.body.amount);
            if (amount === null) return sendError(res, 400, 'amount must be non-negative', 'VALIDATION_ERROR');
            structure.amount = amount;
        }
        if (req.body.dueDayOfMonth !== undefined) {
            structure.dueDayOfMonth = Math.min(Math.max(Math.floor(toNumber(req.body.dueDayOfMonth, 1)), 1), 28);
        } else if (req.body.dueDate !== undefined) {
            const dueDate = parseDate(req.body.dueDate);
            structure.dueDayOfMonth = dueDate ? Math.min(Math.max(dueDate.getDate(), 1), 28) : undefined;
        }
        if (req.body.lateFinePerDay !== undefined) {
            const fine = toPositive(req.body.lateFinePerDay);
            if (fine === null) return sendError(res, 400, 'lateFinePerDay must be non-negative', 'VALIDATION_ERROR');
            structure.lateFinePerDay = fine;
        }

        structure.updatedAt = new Date();
        await structure.save();

        return sendSuccess(res, {
            code: 'FEE_STRUCTURE_UPDATED',
            message: 'Fee structure updated successfully',
            data: mapFeeStructure(structure)
        });
    } catch (error) {
        if (error?.code === 11000) return sendError(res, 409, 'Fee structure already exists', 'FEE_STRUCTURE_DUPLICATE');
        console.error('updateFeeStructure error:', error);
        return sendError(res, 500, 'Server error', 'FEE_STRUCTURE_UPDATE_FAILED', error.message);
    }
};

exports.getFeeCollections = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const query = { schoolCode: req.user.schoolCode };

        const start = parseDate(startDate);
        const end = parseDate(endDate);
        if (start || end) {
            query.createdAt = {};
            if (start) query.createdAt.$gte = start;
            if (end) query.createdAt.$lte = end;
        }

        const collections = await PaymentHistory.find(query)
            .populate('studentId', 'name roll studentClass section')
            .populate('receivedBy', 'name')
            .sort({ createdAt: -1 });

        const summary = collections.reduce((acc, item) => {
            acc.totalCollected += toNumber(item.amount);
            acc.totalPayments += 1;
            return acc;
        }, { totalCollected: 0, totalPayments: 0 });

        return sendSuccess(res, {
            code: 'FEE_COLLECTIONS_FETCHED',
            message: 'Fee collections fetched successfully',
            data: collections,
            extra: { summary }
        });
    } catch (error) {
        console.error('getFeeCollections error:', error);
        return sendError(res, 500, 'Server error', 'FEE_COLLECTIONS_FETCH_FAILED', error.message);
    }
};

exports.getUnpaidFees = async (req, res) => {
    try {
        const rows = await Fee.aggregate([
            {
                $match: {
                    schoolCode: req.user.schoolCode,
                    $expr: { $gt: ['$amountDue', '$amountPaid'] }
                }
            },
            {
                $project: {
                    studentId: 1,
                    dueAmount: { $max: [0, { $subtract: ['$amountDue', '$amountPaid'] }] }
                }
            },
            {
                $group: {
                    _id: '$studentId',
                    totalDue: { $sum: '$dueAmount' }
                }
            },
            {
                $lookup: {
                    from: 'students',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'student'
                }
            },
            { $unwind: '$student' },
            {
                $project: {
                    _id: '$student._id',
                    name: '$student.name',
                    roll: '$student.roll',
                    studentClass: '$student.studentClass',
                    section: '$student.section',
                    totalDue: 1
                }
            },
            { $sort: { totalDue: -1, name: 1 } }
        ]);

        return sendSuccess(res, {
            code: 'UNPAID_FEES_FETCHED',
            message: 'Unpaid fees fetched successfully',
            data: rows
        });
    } catch (error) {
        console.error('getUnpaidFees error:', error);
        return sendError(res, 500, 'Server error', 'UNPAID_FEES_FETCH_FAILED', error.message);
    }
};

exports.generateInvoices = async (req, res) => {
    try {
        const schoolCode = req.user.schoolCode;
        const classLevel = String(req.body.classLevel || req.body.className || '').trim();
        if (!classLevel) return sendError(res, 400, 'classLevel is required', 'VALIDATION_ERROR');

        const period = parsePeriod(req.body.month || new Date().getMonth() + 1, req.body.year || new Date().getFullYear());
        if (!period) return sendError(res, 400, 'Invalid month/year', 'VALIDATION_ERROR');

        const section = req.body.section ? String(req.body.section).trim() : null;
        const school = await School.findOne({ schoolCode }).select('_id academicSettings');
        if (!school) return sendError(res, 404, 'School not found', 'SCHOOL_NOT_FOUND');
        const academicYear = String(req.body.academicYear || defaultAcademicYear(school)).trim();

        const structureQuery = { schoolCode, classLevel, academicYear, isActive: true };
        if (section) structureQuery.section = section;
        if (req.body.feeType || req.body.type) structureQuery.feeType = parseFeeType(req.body.feeType || req.body.type);
        const structure = await FeeStructure.findOne(structureQuery).sort({ createdAt: -1 });

        const explicitAmount = req.body.amount !== undefined ? toPositive(req.body.amount) : null;
        if (req.body.amount !== undefined && explicitAmount === null) {
            return sendError(res, 400, 'amount must be non-negative', 'VALIDATION_ERROR');
        }
        const amountDue = explicitAmount !== null ? explicitAmount : (structure ? toNumber(structure.amount) : null);
        if (amountDue === null) return sendError(res, 400, 'No fee structure found and amount not provided', 'FEE_STRUCTURE_REQUIRED');

        const studentQuery = { schoolCode, studentClass: classLevel, isActive: true };
        if (section) studentQuery.section = section;
        const students = await Student.find(studentQuery).select('_id');
        if (!students.length) return sendError(res, 404, 'No active students found for this class', 'NO_STUDENTS_FOUND');

        const session = await mongoose.startSession();
        session.startTransaction();
        let createdCount = 0;
        let updatedCount = 0;
        try {
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
            }

            await Promise.all(students.map((student) => updateStudentTotalDue(student._id, schoolCode, session)));
            await session.commitTransaction();
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }

        return sendSuccess(res, {
            status: 201,
            code: 'FEE_INVOICES_GENERATED',
            message: `Invoices processed (${createdCount} created, ${updatedCount} updated)`,
            data: {
                classLevel,
                section,
                month: period.month,
                year: period.year,
                amountDue,
                totalStudents: students.length,
                createdCount,
                updatedCount
            }
        });
    } catch (error) {
        console.error('generateInvoices error:', error);
        return sendError(res, 500, 'Server error', 'INVOICE_GENERATION_FAILED', error.message);
    }
};

exports.getStudentFees = async (req, res) => {
    try {
        const student = await resolveAuthenticatedStudent(req);
        if (!student) {
            return sendSuccess(res, {
                code: 'STUDENT_FEES_FETCHED',
                message: 'No linked fee ledger found for this student account',
                data: {
                    fees: [],
                    summary: { totalFees: 0, totalPaid: 0, totalDue: 0, paidCount: 0, partialCount: 0, unpaidCount: 0 },
                    feeDetails: []
                }
            });
        }

        const fees = await Fee.find({
            studentId: student._id,
            schoolCode: req.user.schoolCode
        }).sort({ year: -1, month: -1 });

        const summary = fees.reduce((acc, fee) => {
            const due = toNumber(fee.amountDue);
            const paid = toNumber(fee.amountPaid);
            const outstanding = computeOutstanding(due, paid);
            acc.totalFees += due;
            acc.totalPaid += paid;
            acc.totalDue += outstanding;
            if (fee.status === FEE_STATUS.PAID) acc.paidCount += 1;
            else if (fee.status === FEE_STATUS.PARTIAL) acc.partialCount += 1;
            else acc.unpaidCount += 1;
            return acc;
        }, { totalFees: 0, totalPaid: 0, totalDue: 0, paidCount: 0, partialCount: 0, unpaidCount: 0 });

        return sendSuccess(res, {
            code: 'STUDENT_FEES_FETCHED',
            message: 'Student fees fetched successfully',
            data: {
                student: {
                    id: student._id,
                    name: student.name,
                    roll: student.roll,
                    studentClass: student.studentClass,
                    section: student.section
                },
                fees,
                summary,
                feeDetails: fees.map((fee) => ({
                    feeId: fee._id,
                    month: fee.month,
                    year: fee.year,
                    amountDue: fee.amountDue,
                    amountPaid: fee.amountPaid,
                    dueAmount: computeOutstanding(fee.amountDue, fee.amountPaid),
                    status: fee.status,
                    title: `${monthName(fee.month)} ${fee.year}`,
                    amount: fee.amountDue,
                    isPaid: fee.status === FEE_STATUS.PAID
                }))
            },
            extra: { fees }
        });
    } catch (error) {
        console.error('getStudentFees error:', error);
        return sendError(res, 500, 'Server error', 'STUDENT_FEES_FETCH_FAILED', error.message);
    }
};

exports.getDueFees = async (req, res) => {
    try {
        const student = await resolveAuthenticatedStudent(req);
        if (!student) {
            return sendSuccess(res, {
                code: 'STUDENT_DUE_FEES_FETCHED',
                message: 'No linked fee ledger found for this student account',
                data: { totalDue: 0, dueItems: [] }
            });
        }

        const fees = await Fee.find({
            studentId: student._id,
            schoolCode: req.user.schoolCode,
            $expr: { $gt: ['$amountDue', '$amountPaid'] }
        }).sort({ year: -1, month: -1 });

        const dueItems = fees.map((fee) => ({
            feeId: fee._id,
            month: fee.month,
            year: fee.year,
            amountDue: fee.amountDue,
            amountPaid: fee.amountPaid,
            dueAmount: computeOutstanding(fee.amountDue, fee.amountPaid),
            status: fee.status
        }));

        const totalDue = dueItems.reduce((sum, row) => sum + row.dueAmount, 0);
        return sendSuccess(res, {
            code: 'STUDENT_DUE_FEES_FETCHED',
            message: 'Due fees fetched successfully',
            data: { totalDue, dueItems }
        });
    } catch (error) {
        console.error('getDueFees error:', error);
        return sendError(res, 500, 'Server error', 'STUDENT_DUE_FEES_FETCH_FAILED', error.message);
    }
};

exports.getPaymentHistory = async (req, res) => {
    try {
        const student = await resolveAuthenticatedStudent(req);
        if (!student) {
            return sendSuccess(res, {
                code: 'STUDENT_PAYMENT_HISTORY_FETCHED',
                message: 'No linked fee ledger found for this student account',
                data: { payments: [], totalPaid: 0 }
            });
        }

        const payments = await PaymentHistory.find({
            studentId: student._id,
            schoolCode: req.user.schoolCode
        })
            .populate('receivedBy', 'name')
            .sort({ createdAt: -1 });

        const totalPaid = payments.reduce((sum, row) => sum + toNumber(row.amount), 0);

        return sendSuccess(res, {
            code: 'STUDENT_PAYMENT_HISTORY_FETCHED',
            message: 'Payment history fetched successfully',
            data: { payments, totalPaid }
        });
    } catch (error) {
        console.error('getPaymentHistory error:', error);
        return sendError(res, 500, 'Server error', 'STUDENT_PAYMENT_HISTORY_FETCH_FAILED', error.message);
    }
};

exports.getInvoice = async (req, res) => {
    try {
        const student = await resolveAuthenticatedStudent(req);
        if (!student) return sendError(res, 404, 'Student fee ledger not found', 'STUDENT_NOT_FOUND');

        const fee = await Fee.findOne({
            _id: req.params.invoiceId,
            studentId: student._id,
            schoolCode: req.user.schoolCode
        });
        if (!fee) return sendError(res, 404, 'Invoice not found', 'INVOICE_NOT_FOUND');

        const payments = await PaymentHistory.find({
            feeId: fee._id,
            studentId: student._id,
            schoolCode: req.user.schoolCode
        })
            .populate('receivedBy', 'name')
            .sort({ createdAt: -1 });

        return sendSuccess(res, {
            code: 'STUDENT_INVOICE_FETCHED',
            message: 'Invoice fetched successfully',
            data: {
                invoiceId: fee._id,
                month: fee.month,
                year: fee.year,
                amountDue: fee.amountDue,
                amountPaid: fee.amountPaid,
                dueAmount: computeOutstanding(fee.amountDue, fee.amountPaid),
                status: fee.status,
                payments
            }
        });
    } catch (error) {
        console.error('getInvoice error:', error);
        return sendError(res, 500, 'Server error', 'STUDENT_INVOICE_FETCH_FAILED', error.message);
    }
};
