/**
 * Academic Session Controller - Academic year management
 */
const AcademicSession = require('../models/AcademicSession');
const School = require('../models/School');

exports.createSession = async (req, res) => {
    try {
        const { name, startDate, endDate, academicYear, isCurrent } = req.body;
        if (!name || !startDate || !endDate || !academicYear) {
            return res.status(400).json({ success: false, message: 'Name, dates, and academic year required' });
        }
        const school = await School.findOne({ schoolCode: req.user.schoolCode });
        if (!school) return res.status(404).json({ success: false, message: 'School not found' });

        if (isCurrent) {
            await AcademicSession.updateMany(
                { schoolCode: req.user.schoolCode },
                { isCurrent: false }
            );
        }

        const session = await AcademicSession.create({
            schoolId: school._id,
            schoolCode: req.user.schoolCode,
            name,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            academicYear,
            isCurrent: isCurrent || false
        });
        res.status(201).json({ success: true, data: session });
    } catch (err) {
        if (err.code === 11000) return res.status(400).json({ success: false, message: 'Academic year already exists' });
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getSessions = async (req, res) => {
    try {
        const { isCurrent, isActive } = req.query;
        const query = { schoolCode: req.user.schoolCode };
        if (isCurrent !== undefined) query.isCurrent = isCurrent === 'true';
        if (isActive !== undefined) query.isActive = isActive === 'true';

        const sessions = await AcademicSession.find(query).sort({ startDate: -1 }).lean();
        res.json({ success: true, data: sessions });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.setCurrentSession = async (req, res) => {
    try {
        await AcademicSession.updateMany(
            { schoolCode: req.user.schoolCode },
            { isCurrent: false }
        );
        const session = await AcademicSession.findByIdAndUpdate(
            req.params.id,
            { isCurrent: true },
            { new: true }
        );
        if (!session || session.schoolCode !== req.user.schoolCode) {
            return res.status(404).json({ success: false, message: 'Session not found' });
        }
        res.json({ success: true, data: session });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
