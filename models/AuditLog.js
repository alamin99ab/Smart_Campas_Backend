const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
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