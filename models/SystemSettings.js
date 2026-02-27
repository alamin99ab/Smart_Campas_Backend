/**
 * 🔧 SYSTEM SETTINGS MODEL
 * Stores system-wide configuration and settings
 */

const mongoose = require('mongoose');

const systemSettingsSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    description: {
        type: String,
        default: ''
    },
    category: {
        type: String,
        default: 'general'
    },
    isPublic: {
        type: Boolean,
        default: false
    },
    lastUpdatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastUpdatedAt: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Index for efficient lookups
systemSettingsSchema.index({ key: 1 });
systemSettingsSchema.index({ category: 1 });

// Static method to get setting value
systemSettingsSchema.statics.getValue = async function(key, defaultValue = null) {
    const setting = await this.findOne({ key });
    return setting ? setting.value : defaultValue;
};

// Static method to set setting value
systemSettingsSchema.statics.setValue = async function(key, value, updatedBy = null, description = '') {
    return await this.findOneAndUpdate(
        { key },
        {
            value,
            description,
            lastUpdatedBy: updatedBy,
            lastUpdatedAt: new Date()
        },
        { upsert: true, new: true }
    );
};

// Static method to get all settings in a category
systemSettingsSchema.statics.getCategory = async function(category) {
    return await this.find({ category }).sort({ key: 1 });
};

// Pre-save middleware to update timestamps
systemSettingsSchema.pre('save', function(next) {
    this.lastUpdatedAt = new Date();
    next();
});

module.exports = mongoose.model('SystemSettings', systemSettingsSchema);
