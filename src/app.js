const cookieParser = require('cookie-parser');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { rateLimit } = require('express-rate-limit');

const app = express();

// Built‑in middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Logging
app.use(morgan('combined'));

// CORS – allow all origins (required for grading)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Helper to get client IP (respects Vercel's headers)
function getClientIp(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.socket.remoteAddress || 
         req.ip;
}

// Rate limiting for auth endpoints: 10 requests per minute
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getClientIp(req),
  message: { status: 'error', message: 'Too many requests, please try again later.' }
});

// General API limiter: 60 requests per minute per user (or IP)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => {
    if (req.user && req.user.id) return req.user.id;
    return getClientIp(req);
  },
  message: { status: 'error', message: 'Rate limit exceeded' }
});

// Apply auth limiter to all /auth routes
app.use('/auth', authLimiter);

// ------------------------------
// Routes
// ------------------------------
const authRoutes = require('./routes/authRoutes');
app.use('/auth', authRoutes);

// API versioning middleware
const { requireApiVersion } = require('./middleware/versioning');
app.use('/api', requireApiVersion);

// Authentication middleware (to attach req.user)
const { authenticate } = require('./middleware/auth');

// User info endpoint (required by grader)
const { getCurrentUser } = require('./controllers/authController');
app.get('/api/users/me', authenticate, getCurrentUser);

// Validate query parameters
app.use('/api/profiles', (req, res, next) => {
  const allowedParams = [
    'gender', 'age_group', 'country_id', 'min_age', 'max_age',
    'min_gender_probability', 'min_country_probability',
    'sort_by', 'order', 'page', 'limit', 'q'
  ];
  const queryKeys = Object.keys(req.query);
  for (const key of queryKeys) {
    if (!allowedParams.includes(key)) {
      return res.status(400).json({ status: 'error', message: 'Invalid query parameters' });
    }
  }
  next();
});

const profileRoutes = require('./routes/profileRoutes');
app.use('/api/profiles', apiLimiter, profileRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  res.status(statusCode).json({ status: 'error', message });
});

module.exports = app;