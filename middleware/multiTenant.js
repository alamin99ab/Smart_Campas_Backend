/**
 * 🔐 MULTI-TENANT MIDDLEWARE
 * Enterprise-level data isolation for SaaS architecture
 */

const User = require('../models/User');

/**
 * Middleware to ensure proper tenant isolation
 * Validates schoolId/schoolCode and sets tenant context
 */
exports.ensureTenantIsolation = async (req, res, next) => {
    try {
        const School = require('../models/School');
        
        // Skip for super admin routes
        if (req.user && req.user.role === 'super_admin') {
            return next();
        }

        // Get schoolCode from authenticated user (JWT contains schoolCode)
        let schoolCode = req.user?.schoolCode;

        // Normalize schoolCode if present
        if (schoolCode && typeof schoolCode === 'string') {
            schoolCode = schoolCode.toUpperCase();
        }

        if (!schoolCode) {
            // In production, require a schoolCode for tenant-scoped routes
            if (process.env.NODE_ENV === 'production') {
                console.warn('Access denied: Missing schoolCode in authenticated user in production');
                return res.status(403).json({ success: false, message: 'Access denied: Tenant context missing' });
            }
            // For non-production, allow without verbose logs
            return next();
        }

        // Verify school exists and is active - only use schoolCode string
        const school = await School.findOne({ 
            schoolCode: schoolCode,
            isActive: true 
        });

        if (!school) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: School not found or inactive'
            });
            return res.status(403).json({
                success: false,
                message: 'Access denied: School not found or inactive'
            });
        }

        // Check subscription status (handle both formats)
        const subscriptionStatus = school.subscription?.status || school.status;
        if (subscriptionStatus !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'Access denied: School subscription not active'
            });
        }

        // Set tenant context in request - include features from school
        req.tenant = {
            schoolId: school._id,
            schoolCode: school.schoolCode,
            schoolName: school.schoolName,
            subscription: school.subscription || { status: 'active', plan: 'trial' },
            features: school.features || {
                routine: true,
                attendance: true,
                exam: true,
                fee: true,
                notice: true
            }
        };

        // Add tenant filters to all queries
        req.queryFilter = { schoolId: school._id, schoolCode: school.schoolCode };

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

                    // If no tenant context, deny in production, allow in non-production for backwards compatibility
                    if (!req.tenant) {
                        if (process.env.NODE_ENV === 'production') {
                            return res.status(403).json({ success: false, message: 'Access denied: Tenant context missing' });
                        }
                        return next();
                    }

            const tenantFeatures = req.tenant?.features;
            
            // If no features object, allow access (default behavior for older schools)
            if (!tenantFeatures) {
                return next();
            }
            
            // Check if feature exists and is enabled
            const featureEnabled = tenantFeatures[feature];
            
            // If feature is undefined (not set), default to true for backward compatibility
            // If feature is explicitly false, deny access
            if (featureEnabled === false) {
                return res.status(403).json({
                    success: false,
                    message: `Access denied: ${feature} feature not available in your subscription plan`
                });
            }

            // Allow access if feature is true or undefined (backward compatibility)
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
        // Force tenant context into request body for mutation operations.
        // Remove any client-provided tenant fields to prevent tampering.
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.body) {
            delete req.body.schoolId;
            delete req.body.schoolCode;
            req.body.schoolId = schoolId;
            req.body.schoolCode = req.tenant?.schoolCode;
        }

        // Force tenant context into query parameters as canonical filters.
        if (req.query) {
            delete req.query.schoolId;
            delete req.query.schoolCode;
            req.query.schoolId = schoolId;
            req.query.schoolCode = req.tenant?.schoolCode;
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
