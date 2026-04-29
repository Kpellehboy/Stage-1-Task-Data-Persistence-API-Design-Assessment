const mongoose = require('mongoose');
const { v7: uuidv7 } = require('uuid');

const refreshTokenSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => uuidv7(),
    alias: 'id'
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  user_id: {
    type: String,
    ref: 'User',
    required: true,
    index: true
  },
  expires_at: {
    type: Date,
    required: true
  },
  created_at: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false,
  versionKey: false
});

module.exports = mongoose.model('RefreshToken', refreshTokenSchema);