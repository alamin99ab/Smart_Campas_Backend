const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        default: undefined
    },
    // Support both 'user' and 'userId' for backward compatibility
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: undefined
    },
    // For environment-based super admin
    isEnvUser: {
        type: Boolean,
        default: false
    },
    envUserEmail: {
        type: String,
        default: null
    },
    action: { 
        type: String, 
        required: true,
        index: true
    },
    details: { 
        type: mongoose.Schema.Types.Mixed,
        default: {} 
    },
    ip: { 
        type: String 
    },
    userAgent: { 
        type: String 
    },
    deviceId: { 
        type: String 
    },
    createdAt: { 
        type: Date, 
        default: Date.now,
        index: true
    }
});

auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);