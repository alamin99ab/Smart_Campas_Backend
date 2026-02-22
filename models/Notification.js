const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, trim: true, maxlength: 1000 },
    type: {
        type: String,
        enum: ['notice', 'fee', 'attendance', 'result', 'event', 'approval', 'system', 'info'],
        default: 'info'
    },
    link: { type: String },
    data: { type: mongoose.Schema.Types.Mixed },
    schoolCode: { type: String, index: true },
    read: { type: Boolean, default: false },
    readAt: { type: Date },
    createdAt: { type: Date, default: Date.now, index: true }
});

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
