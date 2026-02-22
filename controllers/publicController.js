const School = require('../models/School');

/**
 * GET /api/public/school/:code
 * Public info for a school by code (for login/registration page - "Find your school")
 * Returns only non-sensitive, display-only fields
 */
exports.getSchoolByCode = async (req, res) => {
    try {
        const code = (req.params.code || '').trim().toUpperCase().slice(0, 50);
        if (!code || code.length < 2) {
            return res.status(400).json({ success: false, message: 'School code required' });
        }

        const school = await School.findOne({
            schoolCode: code,
            isActive: true
        }).select('schoolName schoolCode logo address phone email website').lean();

        if (!school) {
            return res.status(404).json({ success: false, message: 'School not found or inactive' });
        }

        res.json({
            success: true,
            data: {
                schoolName: school.schoolName,
                schoolCode: school.schoolCode,
                logo: school.logo,
                address: school.address,
                phone: school.phone,
                email: school.email,
                website: school.website
            }
        });
    } catch (err) {
        console.error('Public school lookup error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch school info' });
    }
};
