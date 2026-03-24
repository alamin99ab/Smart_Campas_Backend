/**
 * 💰 SUBSCRIPTION MANAGEMENT CONTROLLER
 * Enterprise SaaS subscription management for Smart Campus
 */

const Subscription = require('../models/Subscription');
const School = require('../models/School');
const User = require('../models/User');
const { createNotification } = require('../utils/createNotification');

// Plan configurations
const PLAN_CONFIGS = {
    trial: {
        name: 'Trial',
        duration: 14, // days
        price: 0,
        maxUsers: 100,
        maxStudents: 50,
        maxTeachers: 10,
        maxClasses: 10,
        maxStorage: 500,
        maxApiCalls: 1000,
        features: {
            routine: true,
            attendance: true,
            exam: true,
            fee: true,
            notice: true,
            library: false,
            assignment: false,
            sms: false,
            bulkImport: false,
            mobileApp: false,
            apiAccess: false,
            advancedAnalytics: false,
            customBranding: false,
            prioritySupport: false,
            backup: false,
            integration: false
        }
    },
    monthly: {
        name: 'Monthly',
        duration: 30, // days
        price: 49.99,
        maxUsers: 500,
        maxStudents: 300,
        maxTeachers: 50,
        maxClasses: 30,
        maxStorage: 5000,
        maxApiCalls: 10000,
        features: {
            routine: true,
            attendance: true,
            exam: true,
            fee: true,
            notice: true,
            library: true,
            assignment: true,
            sms: false,
            bulkImport: true,
            mobileApp: false,
            apiAccess: false,
            advancedAnalytics: false,
            customBranding: false,
            prioritySupport: false,
            backup: false,
            integration: false
        }
    },
    yearly: {
        name: 'Yearly',
        duration: 365, // days
        price: 499.99,
        maxUsers: 2000,
        maxStudents: 1500,
        maxTeachers: 200,
        maxClasses: 100,
        maxStorage: 50000,
        maxApiCalls: 100000,
        features: {
            routine: true,
            attendance: true,
            exam: true,
            fee: true,
            notice: true,
            library: true,
            assignment: true,
            sms: true,
            bulkImport: true,
            mobileApp: true,
            apiAccess: true,
            advancedAnalytics: true,
            customBranding: true,
            prioritySupport: true,
            backup: true,
            integration: true
        }
    }
};

// @desc    Create subscription for a new school
// @route   POST /api/subscriptions/create
// @access  Private (Super Admin only)
exports.createSubscription = async (req, res) => {
    try {
        const { schoolId, plan, billingCycle, startDate } = req.body;

        if (!schoolId || !plan) {
            return res.status(400).json({
                success: false,
                message: 'School ID and plan are required'
            });
        }

        const school = await School.findById(schoolId);
        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        const planConfig = PLAN_CONFIGS[plan];
        if (!planConfig) {
            return res.status(400).json({
                success: false,
                message: 'Invalid plan selected'
            });
        }

        // Calculate dates
        const start = startDate ? new Date(startDate) : new Date();
        const endDate = new Date(start);
        endDate.setDate(endDate.getDate() + planConfig.duration);

        // Create subscription
        const subscription = await Subscription.create({
            schoolId,
            plan,
            status: 'active',
            billingCycle: billingCycle || (plan === 'trial' ? 'trial' : 'monthly'),
            startDate: start,
            endDate,
            trialEndDate: plan === 'trial' ? endDate : null,
            amount: {
                currency: 'USD',
                amount: planConfig.price,
                discount: 0,
                tax: 0,
                total: planConfig.price
            },
            paymentMethod: 'card',
            autoRenew: plan !== 'trial',
            usage: {
                users: 0,
                students: 0,
                teachers: 0,
                classes: 0,
                storage: 0,
                apiCalls: 0
            },
            limits: {
                maxUsers: planConfig.maxUsers,
                maxStudents: planConfig.maxStudents,
                maxTeachers: planConfig.maxTeachers,
                maxClasses: planConfig.maxClasses,
                maxStorage: planConfig.maxStorage,
                maxApiCalls: planConfig.maxApiCalls
            },
            features: planConfig.features
        });

        // Update school with subscription info
        school.subscription = {
            plan,
            status: 'active',
            startDate: start,
            endDate
        };
        await school.save();

        res.status(201).json({
            success: true,
            message: `Subscription created with ${plan} plan`,
            data: subscription
        });
    } catch (error) {
        console.error('Create subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create subscription',
            error: error.message
        });
    }
};

// @desc    Get subscription details for a school
// @route   GET /api/subscriptions/:schoolId
// @access  Private (Super Admin or School Admin)
exports.getSubscription = async (req, res) => {
    try {
        const { schoolId } = req.params;

        const subscription = await Subscription.findOne({ schoolId })
            .populate('schoolId', 'schoolName schoolCode');

        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found'
            });
        }

        res.json({
            success: true,
            data: subscription
        });
    } catch (error) {
        console.error('Get subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get subscription',
            error: error.message
        });
    }
};

// @desc    Update subscription (upgrade/downgrade)
// @route   PUT /api/subscriptions/:schoolId
// @access  Private (Super Admin only)
exports.updateSubscription = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { plan, billingCycle, startDate, reason } = req.body;

        const subscription = await Subscription.findOne({ schoolId });
        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found'
            });
        }

        const oldPlan = subscription.plan;
        const newPlan = plan || oldPlan;
        const planConfig = PLAN_CONFIGS[newPlan];

        if (!planConfig) {
            return res.status(400).json({
                success: false,
                message: 'Invalid plan selected'
            });
        }

        // Calculate new dates
        let newStartDate = startDate ? new Date(startDate) : new Date();
        let newEndDate = new Date(newStartDate);
        newEndDate.setDate(newEndDate.getDate() + planConfig.duration);

        // If extending from current subscription
        if (subscription.status === 'active' && subscription.endDate > new Date()) {
            newStartDate = subscription.endDate;
            newEndDate = new Date(newStartDate);
            newEndDate.setDate(newEndDate.getDate() + planConfig.duration);
        }

        // Update subscription
        subscription.plan = newPlan;
        subscription.billingCycle = billingCycle || (newPlan === 'trial' ? 'trial' : 'monthly');
        subscription.startDate = newStartDate;
        subscription.endDate = newEndDate;
        subscription.trialEndDate = newPlan === 'trial' ? newEndDate : null;
        subscription.autoRenew = newPlan !== 'trial';
        subscription.amount.total = planConfig.price;
        
        // Update limits and features
        subscription.limits = {
            maxUsers: planConfig.maxUsers,
            maxStudents: planConfig.maxStudents,
            maxTeachers: planConfig.maxTeachers,
            maxClasses: planConfig.maxClasses,
            maxStorage: planConfig.maxStorage,
            maxApiCalls: planConfig.maxApiCalls
        };
        subscription.features = planConfig.features;

        // Add to change history
        subscription.changeHistory.push({
            date: new Date(),
            type: plan !== oldPlan ? (planConfig.price > PLAN_CONFIGS[oldPlan].price ? 'upgrade' : 'downgrade') : 'update',
            fromPlan: oldPlan,
            toPlan: newPlan,
            reason: reason || 'Plan changed',
            changedBy: req.user?.id
        });

        await subscription.save();

        // Update school
        const school = await School.findById(schoolId);
        if (school) {
            school.subscription = {
                plan: newPlan,
                status: 'active',
                startDate: newStartDate,
                endDate: newEndDate
            };
            await school.save();

            // Notify principal
            if (school.principal) {
                await createNotification(
                    school.principal,
                    'SUBSCRIPTION_UPDATED',
                    {
                        title: 'Subscription Updated',
                        message: `Your school subscription has been updated to ${planConfig.name} plan`
                    },
                    school.schoolCode
                );
            }
        }

        res.json({
            success: true,
            message: `Subscription updated to ${planConfig.name} plan`,
            data: subscription
        });
    } catch (error) {
        console.error('Update subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update subscription',
            error: error.message
        });
    }
};

// @desc    Cancel subscription
// @route   DELETE /api/subscriptions/:schoolId
// @access  Private (Super Admin only)
exports.cancelSubscription = async (req, res) => {
    try {
        const { schoolId } = req.params;
        const { reason, cancelAtPeriodEnd } = req.body;

        const subscription = await Subscription.findOne({ schoolId });
        if (!subscription) {
            return res.status(404).json({
                success: false,
                message: 'Subscription not found'
            });
        }

        if (cancelAtPeriodEnd) {
            subscription.autoRenew = false;
            subscription.status = 'active';
            await subscription.save();
        } else {
            subscription.status = 'cancelled';
            subscription.changeHistory.push({
                date: new Date(),
                type: 'cancel',
                fromPlan: subscription.plan,
                toPlan: null,
                reason: reason || 'Subscription cancelled',
                changedBy: req.user?.id
            });
            await subscription.save();

            // Update school
            const school = await School.findById(schoolId);
            if (school) {
                school.subscription.status = 'inactive';
                await school.save();
            }
        }

        res.json({
            success: true,
            message: cancelAtPeriodEnd 
                ? 'Subscription will be cancelled at the end of billing period'
                : 'Subscription cancelled successfully',
            data: subscription
        });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel subscription',
            error: error.message
        });
    }
};

// @desc    Get all subscriptions (for Super Admin dashboard)
// @route   GET /api/subscriptions
// @access  Private (Super Admin only)
exports.getAllSubscriptions = async (req, res) => {
    try {
        const { status, plan, page = 1, limit = 20 } = req.query;

        const query = {};
        if (status) query.status = status;
        if (plan) query.plan = plan;

        const subscriptions = await Subscription.find(query)
            .populate('schoolId', 'schoolName schoolCode isActive')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Subscription.countDocuments(query);

        // Calculate statistics
        const stats = {
            total: total,
            active: await Subscription.countDocuments({ status: 'active' }),
            trial: await Subscription.countDocuments({ plan: 'trial', status: 'active' }),
            expired: await Subscription.countDocuments({ status: 'expired' }),
            monthly: await Subscription.countDocuments({ billingCycle: 'monthly', status: 'active' }),
            yearly: await Subscription.countDocuments({ billingCycle: 'yearly', status: 'active' })
        };

        res.json({
            success: true,
            data: subscriptions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            },
            stats
        });
    } catch (error) {
        console.error('Get all subscriptions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get subscriptions',
            error: error.message
        });
    }
};

// @desc    Get expiring subscriptions
// @route   GET /api/subscriptions/expiring
// @access  Private (Super Admin only)
exports.getExpiringSubscriptions = async (req, res) => {
    try {
        const { days = 7 } = req.query;
        
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + parseInt(days));

        const subscriptions = await Subscription.find({
            status: 'active',
            endDate: { $lte: expiryDate },
            autoRenew: false
        })
        .populate('schoolId', 'schoolName schoolCode')
        .sort({ endDate: 1 });

        res.json({
            success: true,
            data: subscriptions,
            count: subscriptions.length
        });
    } catch (error) {
        console.error('Get expiring subscriptions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get expiring subscriptions',
            error: error.message
        });
    }
};

// @desc    Check subscription status and auto-expire if needed
// @route   GET /api/subscriptions/check-expired
// @access  Private (cron job)
exports.checkExpiredSubscriptions = async (req, res) => {
    try {
        const now = new Date();

        // Find and expire subscriptions
        const expiredSubscriptions = await Subscription.find({
            status: 'active',
            endDate: { $lt: now }
        });

        for (const subscription of expiredSubscriptions) {
            subscription.status = 'expired';
            await subscription.save();

            // Update school
            const school = await School.findById(subscription.schoolId);
            if (school) {
                school.subscription.status = 'expired';
                await school.save();

                // Notify principal
                if (school.principal) {
                    await createNotification(
                        school.principal,
                        'SUBSCRIPTION_EXPIRED',
                        {
                            title: 'Subscription Expired',
                            message: 'Your school subscription has expired. Please renew to continue using the system.'
                        },
                        school.schoolCode
                    );
                }
            }
        }

        res.json({
            success: true,
            message: `Checked ${expiredSubscriptions.length} subscriptions`,
            data: { expired: expiredSubscriptions.length }
        });
    } catch (error) {
        console.error('Check expired subscriptions error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to check expired subscriptions',
            error: error.message
        });
    }
};

// @desc    Get plan details
// @route   GET /api/subscriptions/plans
// @access  Public
exports.getPlanDetails = async (req, res) => {
    try {
        const plans = Object.entries(PLAN_CONFIGS).map(([key, value]) => ({
            id: key,
            name: value.name,
            duration: value.duration,
            price: value.price,
            limits: {
                maxUsers: value.maxUsers,
                maxStudents: value.maxStudents,
                maxTeachers: value.maxTeachers,
                maxClasses: value.maxClasses,
                maxStorage: value.maxStorage,
                maxApiCalls: value.maxApiCalls
            },
            features: value.features
        }));

        res.json({
            success: true,
            data: plans
        });
    } catch (error) {
        console.error('Get plan details error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get plan details',
            error: error.message
        });
    }
};

// @desc    Validate subscription limits before adding users
// @route   POST /api/subscriptions/validate
// @access  Private
exports.validateSubscriptionLimits = async (req, res) => {
    try {
        const { schoolCode, userType, count = 1 } = req.body;

        const school = await School.findOne({ schoolCode });
        if (!school) {
            return res.status(404).json({
                success: false,
                message: 'School not found'
            });
        }

        const subscription = await Subscription.findOne({ schoolId: school._id });
        if (!subscription || subscription.status !== 'active') {
            return res.status(403).json({
                success: false,
                message: 'No active subscription'
            });
        }

        const currentCount = subscription.usage[userType] || 0;
        const limitKey = `max${userType.charAt(0).toUpperCase() + userType.slice(1)}s`;
        const limit = subscription.limits[limitKey];

        if (currentCount + count > limit) {
            return res.status(400).json({
                success: false,
                message: `Cannot add ${count} ${userType}. Limit of ${limit} would be exceeded.`,
                current: currentCount,
                limit,
                available: limit - currentCount
            });
        }

        res.json({
            success: true,
            message: 'Within limits',
            current: currentCount,
            limit,
            available: limit - currentCount
        });
    } catch (error) {
        console.error('Validate subscription limits error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to validate limits',
            error: error.message
        });
    }
};
