const jwt = require('jsonwebtoken');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const crypto = require('crypto');

// Generate access token (expires 3 minutes)
function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role, github_id: user.github_id },
    process.env.JWT_SECRET,
    { expiresIn: '3m' }
  );
}

// Generate refresh token (expires 5 minutes)
function generateRefreshToken(userId) {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  return { token, expiresAt };
}

// Save refresh token
async function saveRefreshToken(userId, token, expiresAt) {
  await RefreshToken.create({
    token,
    user_id: userId,
    expires_at: expiresAt
  });
}

// Verify refresh token and issue new pair
async function refreshAccessToken(refreshTokenString) {
  const tokenDoc = await RefreshToken.findOne({ token: refreshTokenString }).populate('user_id');
  if (!tokenDoc || tokenDoc.expires_at < new Date()) {
    throw new Error('Invalid or expired refresh token');
  }
  const user = tokenDoc.user_id;
  // Invalidate old refresh token
  await RefreshToken.deleteOne({ _id: tokenDoc._id });
  // Generate new pair
  const accessToken = generateAccessToken(user);
  const newRefresh = generateRefreshToken(user.id);
  await saveRefreshToken(user.id, newRefresh.token, newRefresh.expiresAt);
  return { accessToken, refreshToken: newRefresh.token };
}

// Logout: delete refresh token
async function logout(refreshTokenString) {
  await RefreshToken.deleteOne({ token: refreshTokenString });
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  saveRefreshToken,
  refreshAccessToken,
  logout
};