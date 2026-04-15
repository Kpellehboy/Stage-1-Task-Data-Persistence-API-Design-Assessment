const mongoose = require('mongoose');
const { v7: uuidv7 } = require('uuid');

const profileSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => uuidv7(), // Generate UUID v7 automatically
    alias: 'id' // Allows using `.id` instead of `._id`
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  normalizedName: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  gender: {
    type: String,
    enum: ['male', 'female', null],
    default: null
  },
  genderProbability: {
    type: Number,
    min: 0,
    max: 1,
    default: null
  },
  sampleSize: {
    type: Number,
    min: 0,
    default: null
  },
  age: {
    type: Number,
    min: 0,
    default: null
  },
  ageGroup: {
    type: String,
    enum: ['child', 'teen', 'adult', 'senior', null],
    default: null,
    index: true
  },
  countryId: {
    type: String,
    uppercase: true,
    trim: true,
    default: null,
    index: true
  },
  countryProbability: {
    type: Number,
    min: 0,
    max: 1,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true, // Cannot be changed after creation
    index: true
  }
}, {
  timestamps: false, // We use only createdAt, no updatedAt needed
  versionKey: false, // Remove __v field
  toJSON: {
    transform: (doc, ret) => {
      ret.id = ret._id; // Ensure id field is returned
      delete ret._id;
      delete ret.normalizedName; // Hide internal field
      return ret;
    },
    virtuals: true
  }
});

// Pre-save middleware to set normalizedName from name
profileSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.normalizedName = this.name.toLowerCase().trim();
  }
  next();
});

// Optional: add a static method to find by name case-insensitively
profileSchema.statics.findByName = function(name) {
  return this.findOne({ normalizedName: name.toLowerCase().trim() });
};

module.exports = mongoose.model('Profile', profileSchema);