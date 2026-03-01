const School = require('../models/School');

// Check if school is active and subscription valid
exports.checkSchoolStatus = async (req, res, next) => {
    try {
        const schoolCode = req.user?.schoolCode || req.body.schoolCode || req.params.schoolCode || req.query.schoolCode;
        
        if (!schoolCode) {
            return next(); // No school code needed for super admin routes
        }

        const school = await School.findOne({ schoolCode });
        
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