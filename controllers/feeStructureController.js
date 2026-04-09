/**
 * Fee Structure Controller - aligned with FeeStructure canonical schema
 */
const FeeStructure = require('../models/FeeStructure');
const School = require('../models/School');

const toNumber = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const toPositive = (value) => {
    const n = toNumber(value, NaN);
    return Number.isFinite(n) && n >= 0 ? n : null;
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

const defaultAcademicYear = (school) => {
    if (school?.academicSettings?.currentSession) return school.academicSettings.currentSession;
    const y = new Date().getFullYear();
    return `${y}-${y + 1}`;
};

const mapStructure = (row) => {
    const item = row.toObject ? row.toObject() : row;
    return {
        ...item,
        className: item.classLevel,
        name: `${item.classLevel} - ${item.feeType}`,
        type: String(item.feeType || '').toLowerCase(),
        dueDate: item.dueDayOfMonth ? new Date(new Date().getFullYear(), new Date().getMonth(), item.dueDayOfMonth).toISOString() : null
    };
};

exports.createFeeStructure = async (req, res) => {
    try {
        const classLevel = String(req.body.classLevel || req.body.className || req.body.name || '').trim();
        const amount = toPositive(req.body.amount);
        if (!classLevel || amount === null) {
            return res.status(400).json({ success: false, message: 'classLevel and non-negative amount are required' });
        }

        const school = await School.findOne({ schoolCode: req.user.schoolCode }).select('_id schoolCode academicSettings');
        if (!school) return res.status(404).json({ success: false, message: 'School not found' });

        const dueDate = req.body.dueDate ? new Date(req.body.dueDate) : null;
        const dueDayOfMonth = req.body.dueDayOfMonth !== undefined
            ? Math.min(Math.max(Math.floor(toNumber(req.body.dueDayOfMonth, 1)), 1), 28)
            : (dueDate && !Number.isNaN(dueDate.getTime()) ? Math.min(Math.max(dueDate.getDate(), 1), 28) : undefined);

        const structure = await FeeStructure.create({
            schoolId: school._id,
            schoolCode: school.schoolCode,
            classLevel,
            section: req.body.section || undefined,
            feeType: parseFeeType(req.body.feeType || req.body.type),
            amount,
            academicYear: String(req.body.academicYear || defaultAcademicYear(school)).trim(),
            dueDayOfMonth,
            lateFinePerDay: toPositive(req.body.lateFinePerDay) ?? 0,
            isActive: req.body.isActive !== undefined ? Boolean(req.body.isActive) : true,
            createdBy: req.user._id
        });

        res.status(201).json({ success: true, data: mapStructure(structure) });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ success: false, message: 'Fee structure already exists' });
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getFeeStructures = async (req, res) => {
    try {
        const { academicYear, classLevel, className, feeType } = req.query;
        const query = { schoolCode: req.user.schoolCode };
        if (academicYear) query.academicYear = academicYear;
        if (classLevel || className) query.classLevel = classLevel || className;
        if (feeType) query.feeType = parseFeeType(feeType);

        const structures = await FeeStructure.find(query).sort({ createdAt: -1 });
        res.json({ success: true, data: structures.map(mapStructure) });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateFeeStructure = async (req, res) => {
    try {
        const structure = await FeeStructure.findOne({ _id: req.params.id, schoolCode: req.user.schoolCode });
        if (!structure) return res.status(404).json({ success: false, message: 'Fee structure not found' });

        const classLevel = req.body.classLevel || req.body.className;
        if (classLevel !== undefined) structure.classLevel = String(classLevel).trim();
        if (req.body.section !== undefined) structure.section = req.body.section || undefined;
        if (req.body.feeType !== undefined || req.body.type !== undefined) structure.feeType = parseFeeType(req.body.feeType || req.body.type);
        if (req.body.academicYear !== undefined) structure.academicYear = String(req.body.academicYear).trim();
        if (req.body.isActive !== undefined) structure.isActive = Boolean(req.body.isActive);
        if (req.body.amount !== undefined) {
            const amount = toPositive(req.body.amount);
            if (amount === null) return res.status(400).json({ success: false, message: 'amount must be non-negative' });
            structure.amount = amount;
        }
        if (req.body.dueDayOfMonth !== undefined) {
            structure.dueDayOfMonth = Math.min(Math.max(Math.floor(toNumber(req.body.dueDayOfMonth, 1)), 1), 28);
        }
        if (req.body.lateFinePerDay !== undefined) {
            const fine = toPositive(req.body.lateFinePerDay);
            if (fine === null) return res.status(400).json({ success: false, message: 'lateFinePerDay must be non-negative' });
            structure.lateFinePerDay = fine;
        }

        structure.updatedAt = new Date();
        await structure.save();
        res.json({ success: true, data: mapStructure(structure) });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ success: false, message: 'Fee structure already exists' });
        res.status(500).json({ success: false, message: err.message });
    }
};
