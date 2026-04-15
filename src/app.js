const express = require('express');
const cors = require('cors');
const app = express();

const profileRoutes = require('./routes/profileRoutes');

// Built-in middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS - allow all origins
app.use(cors({
  origin: '*',              // Allow any origin
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Routes
app.use('/api/profiles', profileRoutes);

// 404 handler for unmatched routes
app.use((req, res, next) => {
  res.status(404).json({ error: `Route ${req.method} ${req.originalUrl} not found` });
});

// Global error handler (must be last)
app.use((err, req, res, next) => {
  console.error('Global error:', err); // Log for debugging
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';
  
  res.status(statusCode).json({ error: message });
});

module.exports = app;