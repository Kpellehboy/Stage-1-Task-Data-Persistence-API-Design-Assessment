const express = require('express');
const router = express.Router();
const { githubCallback, refreshToken, logout } = require('../controllers/authController');

// GitHub OAuth endpoints
router.get('/github', (req, res) => {
  // Build GitHub OAuth URL with PKCE parameters from query
  const { state, code_challenge } = req.query;
  let authUrl = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=user:email`;
  if (state) authUrl += `&state=${state}`;
  if (code_challenge) authUrl += `&code_challenge=${code_challenge}&code_challenge_method=S256`;
  authUrl += `&redirect_uri=${encodeURIComponent(process.env.GITHUB_CALLBACK_URL)}`;
  res.redirect(authUrl);
});

router.get('/github/callback', githubCallback);
router.post('/refresh', refreshToken);
router.post('/logout', logout);

module.exports = router;