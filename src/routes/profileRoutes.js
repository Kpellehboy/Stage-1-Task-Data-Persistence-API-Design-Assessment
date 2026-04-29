const express = require('express');
const router = express.Router();
const { createProfile, getProfileById, getAllProfiles, deleteProfile, searchProfiles } = require('../controllers/profileController');
const { exportProfilesCSV } = require('../controllers/exportController');
const { authenticate, requireAdmin } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Admin-only routes
router.post('/', requireAdmin, createProfile);
router.delete('/:id', requireAdmin, deleteProfile);

// Read-only routes (both admin and analyst)
router.get('/:id', getProfileById);
router.get('/', getAllProfiles);
router.get('/search', searchProfiles);

// CSV export (requires authentication, respects filters)
router.get('/export', authenticate, exportProfilesCSV);

module.exports = router;