/**
 * Fee Structure Controller - Class-wise fee setup
 */
const FeeStructure = require('../models/FeeStructure');
const School = require('../models/School');

exports.createFeeStructure = async (req, res) => {
    try {
        const { classLevel, section, feeType, amount, academicYear, dueDayOfMonth, lateFinePerDay } = req.body;
        if (!classLevel || !amount || !academicYear) {
            return res.status(400).json({ success: false, message: 'Class level, amount, and academic year required' });
        }
        const school = await School.findOne({ schoolCode: req.user.schoolCode });
        if (!school) return res.status(404).json({ success: false, message: 'School not found' });

        const structure = await FeeStructure.create({
            schoolId: school._id,
            schoolCode: req.user.schoolCode,
            classLevel,
            section,
            feeType: feeType || 'Monthly',
            amount,
            academicYear,
            dueDayOfMonth,
            lateFinePerDay: lateFinePerDay || 0,
            createdBy: req.user._id
        });
        res.status(201).json({ success: true, data: structure });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ success: false, message: 'Fee structure already exists' });
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getFeeStructures = async (req, res) => {
    try {
        const { academicYear, classLevel, feeType } = req.query;
        const query = { schoolCode: req.user.schoolCode };
        if (academicYear) query.academicYear = academicYear;
        if (classLevel) query.classLevel = classLevel;
        if (feeType) query.feeType = feeType;

        const structures = await FeeStructure.find(query).sort({ classLevel: 1 }).lean();
        res.json({ success: true, data: structures });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateFeeStructure = async (req, res) => {
    try {
        const structure = await FeeStructure.findOne({ _id: req.params.id, schoolCode: req.user.schoolCode });
        if (!structure) return res.status(404).json({ success: false, message: 'Fee structure not found' });

        const { amount, dueDayOfMonth, lateFinePerDay, isActive } = req.body;
        if (amount !== undefined) structure.amount = amount;
        if (dueDayOfMonth !== undefined) structure.dueDayOfMonth = dueDayOfMonth;
        if (lateFinePerDay !== undefined) structure.lateFinePerDay = lateFinePerDay;
        if (isActive !== undefined) structure.isActive = isActive;
        await structure.save();
        res.json({ success: true, data: structure });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
