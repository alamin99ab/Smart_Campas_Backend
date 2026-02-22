const mongoose = require('mongoose');

const schoolSchema = new mongoose.Schema({
    schoolName: { type: String, required: true },
    schoolCode: { type: String, required: true, unique: true },
    primaryColor: { type: String, default: '#1a5f7a' },
    secondaryColor: { type: String, default: '#e5e5e5' },
    address: { type: String },
    phone: { type: String },
    email: { type: String },
    website: { type: String },
    description: { type: String },
    logo: {
        url: String,
        publicId: String
    },
    principal: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    subscription: {
        plan: { type: String, enum: ['trial', 'basic', 'premium', 'enterprise'], default: 'trial' },
        status: { type: String, enum: ['active', 'inactive', 'expired'], default: 'active' },
        startDate: { type: Date, default: Date.now },
        endDate: { type: Date }
    },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// ✅ সঠিক pre-save middleware (async ফাংশন ব্যবহার)
schoolSchema.pre('save', async function() {
    this.updatedAt = Date.now();
});

module.exports = mongoose.model('School', schoolSchema);