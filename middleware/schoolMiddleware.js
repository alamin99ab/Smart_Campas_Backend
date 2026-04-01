const School = require('../models/School');

// Check if school is active and subscription valid
exports.checkSchoolStatus = async (req, res, next) => {
    try {
// Trust tenant context from authenticated user/tenant context only; do not trust client-provided schoolCode
    const schoolCode = req.user?.schoolCode || req.tenant?.schoolCode;

    if (!schoolCode) {
        return next(); // No school code needed for super admin routes or non-tenant flows
        }

        const school = await School.findOne({ schoolCode: schoolCode.toUpperCase() });
        
        if (!school) {
            return res.status(404).json({ message: 'School not found' });
        }

        if (!school.isActive) {
            return res.status(403).json({ message: 'School is inactive' });
        }

        // Check subscription
        if (school.subscription.status !== 'active' && req.user?.role !== 'super_admin') {
            return res.status(403).json({ message: 'School subscription is not active' });
        }

        req.school = school;
        next();

    } catch (error) {
        console.error('School middleware error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};