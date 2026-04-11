const USER_SENSITIVE_FIELDS = [
    'password',
    'refreshToken',
    'sessions',
    'devices',
    'loginAttempts',
    'isBlocked',
    'twoFactorSecret',
    'emailVerificationToken',
    'emailVerificationExpire',
    'resetPasswordToken',
    'resetPasswordExpire',
    'lastLoginIP',
    'lastUserAgent'
];

const USER_SAFE_RESPONSE_PROJECTION = USER_SENSITIVE_FIELDS.map((field) => `-${field}`).join(' ');

const sanitizeUserForResponse = (userDoc) => {
    if (!userDoc) return userDoc;
    const plain = typeof userDoc.toObject === 'function' ? userDoc.toObject() : { ...userDoc };
    USER_SENSITIVE_FIELDS.forEach((field) => {
        delete plain[field];
    });
    return plain;
};

const sanitizeUsersForResponse = (userDocs = []) => userDocs.map((userDoc) => sanitizeUserForResponse(userDoc));

module.exports = {
    USER_SENSITIVE_FIELDS,
    USER_SAFE_RESPONSE_PROJECTION,
    sanitizeUserForResponse,
    sanitizeUsersForResponse
};
