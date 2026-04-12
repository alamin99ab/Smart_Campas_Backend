/**
 * Bootstrap Marker Model
 * Tracks whether the database has been bootstrapped
 */

const mongoose = require('mongoose');

const bootstrapMarkerSchema = new mongoose.Schema({
  // Singleton document - only one should exist
  _id: { type: String, default: 'bootstrap-marker', immutable: true },
  
  // Whether bootstrap has been completed
  completed: { 
    type: Boolean, 
    default: false,
    required: true 
  },
  
  // Timestamp of completion
  completedAt: { 
    type: Date 
  },
  
  // Version of bootstrap data
  version: { 
    type: String, 
    default: '1.0.0' 
  },
  
  // Metadata
  notes: { 
    type: String,
    default: 'System bootstrap completed successfully' 
  },
  
  // Audit fields
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Update timestamp on save
bootstrapMarkerSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (this.completed && !this.completedAt) {
    this.completedAt = Date.now();
  }
  next();
});

// Ensure only one document exists
bootstrapMarkerSchema.statics.getSingleton = function() {
  return this.findOne({ _id: 'bootstrap-marker' }).lean();
};

// Mark bootstrap as completed
bootstrapMarkerSchema.methods.markCompleted = async function() {
  this.completed = true;
  this.completedAt = Date.now();
  await this.save();
};

module.exports = mongoose.model('BootstrapMarker', bootstrapMarkerSchema);