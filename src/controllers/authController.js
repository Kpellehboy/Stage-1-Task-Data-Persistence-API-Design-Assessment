const axios = require('axios');
const User = require('../models/User');
const { generateAccessToken, generateRefreshToken, saveRefreshToken } = require('../services/authService');

// GET /auth/github - redirect to GitHub
function githubAuth(req, res) {
  const { state, code_challenge } = req.query; // PKCE params will be sent from CLI/web
  // For simplicity, we'll let CLI/web generate PKCE. Backend only exchanges code.
  // Redirect to GitHub OAuth URL (but we actually expect CLI/web to initiate)
  // Instead, we'll implement the callback directly.
}

// GET /auth/github/callback
async function githubCallback(req, res, next) {
  try {
    const { code, state, code_verifier } = req.query;
    if (!code) {
      return res.status(400).json({ status: 'error', message: 'Missing authorization code' });
    }

    // Exchange code for access token
    const tokenResponse = await axios.post('https://github.com/login/oauth/access_token', {
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: process.env.GITHUB_CALLBACK_URL,
      ...(code_verifier && { code_verifier }) // PKCE
    }, {
      headers: { Accept: 'application/json' }
    });

    const { access_token } = tokenResponse.data;
    if (!access_token) {
      throw new Error('Failed to get access token');
    }

    // Fetch user info from GitHub
    const userResponse = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const { id, login, email, avatar_url } = userResponse.data;

    // Find or create user
    let user = await User.findOne({ github_id: String(id) });
    if (!user) {
      user = await User.create({
        github_id: String(id),
        username: login,
        email: email || `${login}@github.com`,
        avatar_url,
        role: 'analyst' // default
      });
    } else {
      // Update last_login_at
      user.last_login_at = new Date();
      await user.save();
    }

    // Generate tokens (access: 3min, refresh: 5min)
    const accessToken = generateAccessToken(user);
    const { token: refreshToken, expiresAt } = generateRefreshToken(user.id);
    await saveRefreshToken(user.id, refreshToken, expiresAt);

    // For web portal, we should set HTTP-only cookie with refresh token
    // For CLI, we return tokens in JSON.
    // We'll detect if request expects JSON or HTML.
    const acceptHeader = req.headers.accept || '';
    if (acceptHeader.includes('application/json')) {
      return res.json({
        status: 'success',
        access_token: accessToken,
        refresh_token: refreshToken
      });
    } else {
      // Web portal – set cookies and redirect
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 5 * 60 * 1000 // 5 minutes
      });
      res.cookie('access_token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 3 * 60 * 1000 // 3 minutes
      });
      // Redirect to web portal dashboard
      return res.redirect(process.env.WEB_PORTAL_URL || '/dashboard');
    }
  } catch (error) {
    console.error('GitHub callback error:', error);
    res.status(500).json({ status: 'error', message: 'Authentication failed' });
  }
}

// POST /auth/refresh
async function refreshToken(req, res, next) {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ status: 'error', message: 'Refresh token required' });
    }
    const { accessToken, refreshToken: newRefreshToken } = await refreshAccessToken(refresh_token);
    res.json({
      status: 'success',
      access_token: accessToken,
      refresh_token: newRefreshToken
    });
  } catch (error) {
    res.status(401).json({ status: 'error', message: error.message });
  }
}

// POST /auth/logout
async function logout(req, res) {
  try {
    const refreshToken = req.cookies?.refresh_token || req.body?.refresh_token;
    if (refreshToken) {
      await logout(refreshToken);
    }
    res.clearCookie('refresh_token');
    res.clearCookie('access_token');
    res.json({ status: 'success', message: 'Logged out' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Logout failed' });
  }
}

module.exports = { githubAuth, githubCallback, refreshToken, logout };