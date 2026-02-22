// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, select: false },
    role: { type: String, enum: ['super_admin', 'admin', 'principal', 'teacher', 'student', 'parent'], required: true },
    schoolCode: { type: String, required: true },
    schoolName: String,
    phone: String,
    address: String,
    profileImage: String,
    isApproved: { type: Boolean, default: false },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    approvedAt: Date,
    permissions: [String],
    emailVerified: { type: Boolean, default: false },
    emailVerificationToken: String,
    emailVerificationExpire: Date,
    resetPasswordToken: String,
    resetPasswordExpire: Date,
    loginAttempts: { type: Number, default: 0 },
    isBlocked: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastLogin: Date,
    lastLoginIP: String,
    lastUserAgent: String,
    passwordChangedAt: Date,
    refreshToken: { type: String, select: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, select: false },
    devices: [{
        deviceId: String,
        name: String,
        lastActive: Date
    }],
    sessions: [{
        token: String,
        device: String,
        deviceId: String,
        ip: String,
        lastActive: Date
    }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function() {
    if (!this.isModified('password')) return;
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);