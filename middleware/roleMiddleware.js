// Check if user has required role
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Access denied. Insufficient permissions.' });
        }
        next();
    };
};

// Specific role checkers
exports.principalOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'principal') {
        return res.status(403).json({ success: false, message: 'Access denied. Principal only.' });
    }
    next();
};

exports.adminOnly = (req, res, next) => {
    if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'superadmin')) {
        return res.status(403).json({ success: false, message: 'Access denied. Admin only.' });
    }
    next();
};

exports.superAdminOnly = (req, res, next) => {
    if (!req.user || req.user.role !== 'superadmin') {
        return res.status(403).json({ success: false, message: 'Access denied. Super admin only.' });
    }
    next();
};

exports.accountantOnly = (req, res, next) => {
    if (!req.user || (req.user.role !== 'accountant' && req.user.role !== 'principal')) {
        return res.status(403).json({ success: false, message: 'Access denied. Accountant or Principal only.' });
    }
    next();
};

exports.sameSchool = (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, message: 'Not authorized' });

    const targetSchoolCode = req.body.schoolCode || req.params.schoolCode || req.query.schoolCode;

    if (targetSchoolCode && targetSchoolCode !== req.user.schoolCode) {
        return res.status(403).json({ success: false, message: 'Access denied. You can only access your own school data.' });
    }
    
    // For superadmin, allow cross-school access
    if (req.user.role === 'superadmin' || req.user.role === 'admin') {
        return next();
    }
    
    next();
};