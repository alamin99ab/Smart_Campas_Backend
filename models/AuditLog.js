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
        enum: [
            'LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGIN_BLOCKED',
            'LOGOUT', 'LOGOUT_ALL_DEVICES',
            'PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED', 'PASSWORD_RESET_COMPLETED',
            'EMAIL_VERIFIED', 'VERIFICATION_EMAIL_RESENT',
            '2FA_SETUP_INITIATED', '2FA_ENABLED', '2FA_DISABLED', '2FA_FAILED',
            'PROFILE_VIEW', 'PROFILE_UPDATE',
            'SESSION_REVOKED', 'REFRESH_TOKEN_DEVICE_MISMATCH',
            'SCHOOL_CREATED', 'SCHOOL_UPDATED', 'SCHOOL_DELETED',
            'TEACHER_APPROVED', 'TEACHER_REJECTED',
            'STUDENT_ADDED', 'STUDENT_UPDATED', 'STUDENT_DELETED',
            'ATTENDANCE_TAKEN', 'ATTENDANCE_UPDATED', 'ATTENDANCE_DELETED',
            'FEE_CREATED', 'FEE_UPDATED', 'FEE_DELETED',
            'NOTICE_CREATED', 'NOTICE_UPDATED', 'NOTICE_DELETED',
            'ADMIT_CARD_DOWNLOADED', 'BULK_ADMIT_CARDS_DOWNLOADED',
            'ROUTINE_CREATED', 'ROUTINE_UPDATED', 'ROUTINE_DELETED',
            'SPECIAL_PERMISSION_GRANTED', 'SPECIAL_PERMISSION_REVOKED',
            'ACCOUNT_BLOCKED',
            'REGISTER'
        ]
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