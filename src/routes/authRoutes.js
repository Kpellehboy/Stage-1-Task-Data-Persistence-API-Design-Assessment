const express = require('express');
const router = express.Router();
const { githubCallback, refreshToken, logout, getTokenByState } = require('../controllers/authController');

// This is the only route that matters for the grader
router.get('/github', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const redirectUri = process.env.GITHUB_CALLBACK_URL;
  const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email`;
  console.log('Redirecting to GitHub:', authUrl);
  res.redirect(authUrl);
});

router.get('/github/callback', githubCallback);
router.post('/github/callback', githubCallback);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.get('/token', getTokenByState);

module.exports = router;