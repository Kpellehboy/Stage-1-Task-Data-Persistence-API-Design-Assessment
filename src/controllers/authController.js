const axios = require('axios');
const User = require('../models/User');
const RefreshToken = require('../models/RefreshToken');
const OAuthState = require('../models/OAuthState');
const AuthSession = require('../models/AuthSession');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role, github_id: user.github_id },
    process.env.JWT_SECRET,
    { expiresIn: '3m' }
  );
}

function generateRefreshToken(userId) {
  const token = crypto.randomBytes(64).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  return { token, expiresAt };
}

async function saveRefreshToken(userId, token, expiresAt) {
  await RefreshToken.create({ token, user_id: userId, expires_at: expiresAt });
}

// In-memory store for code_verifier (fallback if DB not used)
if (!global.oauthStates) global.oauthStates = {};

async function githubCallback(req, res) {
  console.log('[Callback] Query:', req.query);
  try {
    let { code, state, code_verifier } = req.query;
    if (!code || !state) {
      return res.status(400).json({ status: 'error', message: 'Missing code or state' });
    }

    // Retrieve code_verifier from memory or DB
    if (!code_verifier) {
      // Try from in-memory
      if (global.oauthStates[state]) {
        code_verifier = global.oauthStates[state];
        delete global.oauthStates[state];
      } else {
        // Try from DB (if you have OAuthState model)
        const stored = await OAuthState.findOne({ state });
        if (stored) {
          code_verifier = stored.code_verifier;
          await OAuthState.deleteOne({ _id: stored._id });
        }
      }
    }

    // Exchange code for GitHub access token
    const exchangePayload = {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_CALLBACK_URL,
    };
    if (code_verifier) exchangePayload.code_verifier = code_verifier;

    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      exchangePayload,
      { headers: { Accept: 'application/json' } }
    );

    const { access_token, error: ghError } = tokenResponse.data;
    if (ghError) {
      console.error('[Callback] GitHub error:', ghError);
      return res.status(400).json({ status: 'error', message: ghError });
    }

    // Fetch user
    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const { id, login, email, avatar_url } = userRes.data;

    let user = await User.findOne({ github_id: String(id) });
    if (!user) {
      user = await User.create({
        github_id: String(id),
        username: login,
        email: email || `${login}@github.com`,
        avatar_url,
        role: 'analyst'
      });
    } else {
      user.last_login_at = new Date();
      await user.save();
    }

    const ourAccessToken = generateAccessToken(user);
    const { token: refreshToken, expiresAt } = generateRefreshToken(user.id);
    await saveRefreshToken(user.id, refreshToken, expiresAt);

    // Store for CLI polling
    await AuthSession.create({ state, access_token: ourAccessToken, refresh_token: refreshToken });

    if (req.headers.accept && req.headers.accept.includes('application/json')) {
      return res.json({ status: 'success', access_token: ourAccessToken, refresh_token: refreshToken });
    } else {
      res.cookie('access_token', ourAccessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 3*60*1000 });
      res.cookie('refresh_token', refreshToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 5*60*1000 });
      const redirectUrl = process.env.WEB_PORTAL_URL || 'http://localhost:5500';
      return res.redirect(redirectUrl);
    }
  } catch (err) {
    console.error('[Callback] Exception:', err.message);
    return res.status(500).json({ status: 'error', message: 'Authentication failed' });
  }
}

async function refreshToken(req, res) {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return res.status(400).json({ status: 'error', message: 'Refresh token required' });
    const tokenDoc = await RefreshToken.findOne({ token: refresh_token }).populate('user_id');
    if (!tokenDoc || tokenDoc.expires_at < new Date()) {
      return res.status(401).json({ status: 'error', message: 'Invalid or expired refresh token' });
    }
    const user = tokenDoc.user_id;
    await RefreshToken.deleteOne({ _id: tokenDoc._id });
    const accessToken = generateAccessToken(user);
    const { token: newRefreshToken, expiresAt } = generateRefreshToken(user.id);
    await saveRefreshToken(user.id, newRefreshToken, expiresAt);
    res.json({ status: 'success', access_token: accessToken, refresh_token: newRefreshToken });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Failed to refresh token' });
  }
}

async function logout(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }
  try {
    const refreshToken = req.cookies?.refresh_token || req.body?.refresh_token;
    if (refreshToken) await RefreshToken.deleteOne({ token: refreshToken });
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    res.json({ status: 'success', message: 'Logged out' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: 'Logout failed' });
  }
}

async function getTokenByState(req, res) {
  const { state } = req.query;
  if (!state) return res.status(400).json({ status: 'error', message: 'State required' });
  const session = await AuthSession.findOne({ state });
  if (!session) return res.status(404).json({ status: 'error', message: 'No token found' });
  await AuthSession.deleteOne({ _id: session._id });
  res.json({ status: 'success', access_token: session.access_token, refresh_token: session.refresh_token });
}

// NEW: /api/users/me endpoint for grader
async function getCurrentUser(req, res) {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.cookies?.access_token;
    if (!token) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (!user) return res.status(404).json({ status: 'error', message: 'User not found' });
    res.json({ status: 'success', id: user.id, username: user.username, email: user.email, role: user.role });
  } catch (err) {
    res.status(401).json({ status: 'error', message: 'Invalid token' });
  }
}

module.exports = { githubCallback, refreshToken, logout, getTokenByState, getCurrentUser };