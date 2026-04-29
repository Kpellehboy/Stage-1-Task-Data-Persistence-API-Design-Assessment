const mongoose = require('mongoose');
const { v7: uuidv7 } = require('uuid');

const userSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => uuidv7(),
    alias: 'id'
  },
  github_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  avatar_url: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['admin', 'analyst'],
    default: 'analyst'
  },
  is_active: {
    type: Boolean,
    default: true
  },
  last_login_at: {
    type: Date,
    default: null
  },
  created_at: {
    type: Date,
    default: Date.now,
    immutable: true
  }
}, {
  timestamps: false,
  versionKey: false,
  toJSON: {
    transform: (doc, ret) => {
      ret.id = ret._id;
      delete ret._id;
      return ret;
    }
  }
});

module.exports = mongoose.model('User', userSchema);