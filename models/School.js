const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
    schoolName: { type: String, required: true },
    schoolCode: { type: String, required: true, unique: true },
    
    // Contact information
    address: { type: String },
    phone: { type: String },
    email: { type: String },
    website: { type: String },
    
    // School details
    description: { type: String },
    establishedYear: Number,
    schoolType: {
        type: String,
        enum: ['primary', 'secondary', 'higher_secondary', 'college', 'university', 'international'],
        required: true
    },
    
    // Location
    location: {
        country: { type: String, default: 'Bangladesh' },
        division: String,
        district: String,
        upazila: String,
        address: String,
        coordinates: {
            latitude: Number,
            longitude: Number
        }
    },
    
    // Branding
    logo: { url: String, publicId: String },
    primaryColor: { type: String, default: '#1a5f7a' },
    secondaryColor: { type: String, default: '#e5e5e5' },
    customDomain: String,
    
    // Leadership
    principal: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    vicePrincipal: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    
    // Academic settings
    academicSettings: {
        currentSession: { type: String, required: true },
        sessionStartMonth: { type: Number, default: 1 }, // January
        gradingSystem: {
            type: String,
            enum: ['gpa_4', 'gpa_5', 'percentage', 'custom'],
            default: 'gpa_5'
        },
        workingDays: [{
            type: String,
            enum: ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        }],
        classDuration: { type: Number, default: 45 }, // minutes
        breakTime: { type: Number, default: 15 }, // minutes
        lunchBreak: { type: Number, default: 30 } // minutes
    },
    
    // Subscription (reference to Subscription model)
    subscription: {
        plan: { type: String, enum: ['trial', 'basic', 'standard', 'premium', 'enterprise'], default: 'trial' },
        status: { type: String, enum: ['active', 'inactive', 'expired', 'suspended'], default: 'active' },
        startDate: { type: Date, default: Date.now },
        endDate: { type: Date }
    },
    
    // Payment information
    amountPaid: { type: Number, default: 0 },
    
    // Feature flags (will be moved to Subscription model)
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
    
    // System settings
    settings: {
        timezone: { type: String, default: 'Asia/Dhaka' },
        currency: { type: String, default: 'BDT' },
        language: { type: String, default: 'en' },
        dateFormat: { type: String, default: 'DD/MM/YYYY' },
        smsProvider: { type: String, enum: ['twilio', 'local', 'none'], default: 'none' },
        emailProvider: { type: String, enum: ['smtp', 'sendgrid', 'aws', 'none'], default: 'none' }
    },
    
    // Statistics
    stats: {
        totalStudents: { type: Number, default: 0 },
        totalTeachers: { type: Number, default: 0 },
        totalClasses: { type: Number, default: 0 },
        totalSubjects: { type: Number, default: 0 },
        storageUsed: { type: Number, default: 0 }, // in MB
        lastActivity: { type: Date, default: Date.now }
    },
    
    // Status
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    verificationDate: Date,
    
    // Metadata
    tags: [String],
    notes: String,
    
    // Audit fields
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// ✅ সঠিক pre-save middleware (async ফাংশন ব্যবহার)
schoolSchema.pre('save', async function() {
    this.updatedAt = Date.now();
});

module.exports = mongoose.model('School', schoolSchema);