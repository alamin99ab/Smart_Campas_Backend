/**
 * 🔐 MULTI-TENANT MIDDLEWARE
 * Enterprise-level data isolation for SaaS architecture
 */

const School = require('../models/School');
const User = require('../models/User');

/**
 * Middleware to ensure proper tenant isolation
 * Validates schoolId and sets tenant context
 */
exports.ensureTenantIsolation = async (req, res, next) => {
    try {
        // Skip for super admin routes
        if (req.user && req.user.role === 'super_admin') {
            return next();
        }

        // Get schoolId from authenticated user
        const schoolId = req.user?.schoolId;
        
        if (!schoolId) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: No school context found'
            });
        }

        // Verify school exists and is active
        const school = await School.findOne({ 
            _id: schoolId, 
            isActive: true 
        });

        if (!school) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: School not found or inactive'
            });
        }

        // Check subscription status
        if (school.subscription.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'Access denied: School subscription not active'
            });
        }

        // Set tenant context in request
        req.tenant = {
            schoolId,
            schoolCode: school.schoolCode,
            schoolName: school.schoolName,
            subscription: school.subscription,
            features: school.features
        };

        // Add schoolId filter to all queries
        req.queryFilter = { schoolId };

        next();
    } catch (error) {
        console.error('Tenant isolation error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during tenant validation'
        });
    }
};

/**
 * Feature access control middleware
 * Checks if tenant has access to specific feature
 */
exports.checkFeatureAccess = (feature) => {
    return (req, res, next) => {
        try {
            // Super admin has access to all features
            if (req.user && req.user.role === 'super_admin') {
                return next();
            }

            const tenantFeatures = req.tenant?.features;
            
            if (!tenantFeatures || !tenantFeatures[feature]) {
                return res.status(403).json({
                    success: false,
                    message: `Access denied: ${feature} feature not available in your subscription plan`
                });
            }

            next();
        } catch (error) {
            console.error('Feature access error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error during feature validation'
            });
        }
    };
};

/**
 * Subscription plan limit checker
 */
exports.checkSubscriptionLimits = (limitType) => {
    return async (req, res, next) => {
        try {
            // Skip for super admin
            if (req.user && req.user.role === 'super_admin') {
                return next();
            }

            const schoolId = req.tenant?.schoolId;
            const subscription = req.tenant?.subscription;

            if (!schoolId || !subscription) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied: No valid subscription found'
                });
            }

            // Define limits for each plan
            const limits = {
                trial: {
                    maxUsers: 50,
                    maxClasses: 10,
                    maxStudents: 200,
                    maxTeachers: 20
                },
                basic: {
                    maxUsers: 200,
                    maxClasses: 25,
                    maxStudents: 1000,
                    maxTeachers: 50
                },
                standard: {
                    maxUsers: 1000,
                    maxClasses: 100,
                    maxStudents: 5000,
                    maxTeachers: 200
                },
                premium: {
                    maxUsers: 5000,
                    maxClasses: 500,
                    maxStudents: 20000,
                    maxTeachers: 1000
                },
                enterprise: {
                    maxUsers: Infinity,
                    maxClasses: Infinity,
                    maxStudents: Infinity,
                    maxTeachers: Infinity
                }
            };

            const planLimits = limits[subscription.plan] || limits.trial;
            
            // Check specific limit type
            let currentCount = 0;
            let limit = 0;

            switch (limitType) {
                case 'users':
                    currentCount = await User.countDocuments({ schoolId });
                    limit = planLimits.maxUsers;
                    break;
                case 'students':
                    currentCount = await User.countDocuments({ schoolId, role: 'student' });
                    limit = planLimits.maxStudents;
                    break;
                case 'teachers':
                    currentCount = await User.countDocuments({ schoolId, role: 'teacher' });
                    limit = planLimits.maxTeachers;
                    break;
                default:
                    return next();
            }

            if (currentCount >= limit) {
                return res.status(403).json({
                    success: false,
                    message: `Limit exceeded: Your ${subscription.plan} plan allows maximum ${limit} ${limitType}. Current: ${currentCount}`
                });
            }

            next();
        } catch (error) {
            console.error('Subscription limit check error:', error);
            res.status(500).json({
                success: false,
                message: 'Internal server error during limit validation'
            });
        }
    };
};

/**
 * School data scope middleware
 * Automatically filters queries by schoolId
 */
exports.addSchoolScope = (req, res, next) => {
    // Skip for super admin
    if (req.user && req.user.role === 'super_admin') {
        return next();
    }

    const schoolId = req.tenant?.schoolId;
    
    if (schoolId) {
        // Add schoolId to request body for POST/PUT operations
        if (req.method === 'POST' && req.body) {
            req.body.schoolId = schoolId;
        }
        
        // Add schoolId to query parameters for GET operations
        if (req.method === 'GET' && req.query) {
            req.query.schoolId = schoolId;
        }
    }

    next();
};

/**
 * Audit trail middleware for tenant actions
 */
exports.tenantAuditTrail = (action, resource) => {
    return (req, res, next) => {
        // Store audit info for later logging
        req.auditInfo = {
            action,
            resource,
            schoolId: req.tenant?.schoolId,
            userId: req.user?.id,
            userRole: req.user?.role,
            timestamp: new Date(),
            ip: req.ip,
            userAgent: req.get('User-Agent')
        };

        next();
    };
};
