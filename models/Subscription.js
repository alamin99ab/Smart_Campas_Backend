/**
 * 💰 SUBSCRIPTION MODEL
 * Enterprise SaaS subscription management
 */

const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
    schoolId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'School', 
        required: true,
        unique: true
    },
    
    // Plan details
    plan: { 
        type: String, 
        enum: ['trial', 'basic', 'standard', 'premium', 'enterprise'], 
        required: true,
        default: 'trial'
    },
    
    status: { 
        type: String, 
        enum: ['active', 'inactive', 'expired', 'suspended', 'cancelled'], 
        default: 'active'
    },
    
    // Billing cycle
    billingCycle: {
        type: String,
        enum: ['monthly', 'yearly'],
        default: 'yearly'
    },
    
    // Dates
    startDate: { 
        type: Date, 
        default: Date.now 
    },
    endDate: { 
        type: Date,
        required: true
    },
    trialEndDate: Date,
    
    // Payment details
    amount: {
        currency: { type: String, default: 'USD' },
        amount: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        tax: { type: Number, default: 0 },
        total: { type: Number, required: true }
    },
    
    // Payment method
    paymentMethod: {
        type: String,
        enum: ['card', 'bank_transfer', 'paypal', 'stripe'],
        required: true
    },
    
    paymentInfo: {
        lastFour: String,
        brand: String,
        expiryMonth: Number,
        expiryYear: Number
    },
    
    // Auto-renewal
    autoRenew: {
        type: Boolean,
        default: true
    },
    
    // Usage tracking
    usage: {
        users: { type: Number, default: 0 },
        students: { type: Number, default: 0 },
        teachers: { type: Number, default: 0 },
        classes: { type: Number, default: 0 },
        storage: { type: Number, default: 0 }, // in MB
        apiCalls: { type: Number, default: 0 }
    },
    
    // Limits based on plan
    limits: {
        maxUsers: { type: Number, required: true },
        maxStudents: { type: Number, required: true },
        maxTeachers: { type: Number, required: true },
        maxClasses: { type: Number, required: true },
        maxStorage: { type: Number, required: true }, // in MB
        maxApiCalls: { type: Number, required: true }
    },
    
    // Features included in plan
    features: {
        routine: { type: Boolean, default: true },
        attendance: { type: Boolean, default: true },
        exam: { type: Boolean, default: true },
        fee: { type: Boolean, default: true },
        notice: { type: Boolean, default: true },
        library: { type: Boolean, default: false },
        assignment: { type: Boolean, default: false },
        sms: { type: Boolean, default: false },
        bulkImport: { type: Boolean, default: false },
        mobileApp: { type: Boolean, default: false },
        apiAccess: { type: Boolean, default: false },
        advancedAnalytics: { type: Boolean, default: false },
        customBranding: { type: Boolean, default: false },
        prioritySupport: { type: Boolean, default: false },
        backup: { type: Boolean, default: false },
        integration: { type: Boolean, default: false }
    },
    
    // Billing history
    billingHistory: [{
        date: { type: Date, default: Date.now },
        type: { type: String, enum: ['charge', 'refund', 'adjustment'], required: true },
        amount: { type: Number, required: true },
        description: String,
        transactionId: String,
        status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'completed' }
    }],
    
    // Invoices
    invoices: [{
        invoiceNumber: { type: String, required: true, unique: true },
        date: { type: Date, default: Date.now },
        dueDate: { type: Date, required: true },
        amount: { type: Number, required: true },
        status: { type: String, enum: ['paid', 'pending', 'overdue'], default: 'pending' },
        url: String,
        pdfUrl: String
    }],
    
    // Subscription changes history
    changeHistory: [{
        date: { type: Date, default: Date.now },
        type: { type: String, enum: ['upgrade', 'downgrade', 'cancel', 'resume', 'suspend'], required: true },
        fromPlan: String,
        toPlan: String,
        reason: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    }],
    
    // Metadata
    notes: String,
    tags: [String],
    
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Pre-save middleware to update timestamps
subscriptionSchema.pre('save', function() {
    this.updatedAt = Date.now();
});

// Indexes for better performance
// Note: schoolId already has unique index from field definition
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ plan: 1 });
subscriptionSchema.index({ endDate: 1 });

// Static methods
subscriptionSchema.statics.getActiveSubscriptions = function() {
    return this.find({ status: 'active' });
};

subscriptionSchema.statics.getExpiringSubscriptions = function(days = 30) {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);
    
    return this.find({
        status: 'active',
        endDate: { $lte: expiryDate },
        autoRenew: false
    });
};

// Instance methods
subscriptionSchema.methods.isExpired = function() {
    return new Date() > this.endDate;
};

subscriptionSchema.methods.daysUntilExpiry = function() {
    const now = new Date();
    const diffTime = this.endDate - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

subscriptionSchema.methods.canAddUser = function(userType = 'student') {
    const limits = {
        student: 'maxStudents',
        teacher: 'maxTeachers',
        general: 'maxUsers'
    };
    
    const limitKey = limits[userType] || 'maxUsers';
    return this.usage[userType] < this.limits[limitKey];
};

subscriptionSchema.methods.hasFeature = function(feature) {
    return this.features[feature] === true;
};

subscriptionSchema.methods.updateUsage = async function(userType, increment = 1) {
    this.usage[userType] = (this.usage[userType] || 0) + increment;
    return this.save();
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
