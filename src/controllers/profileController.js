const Profile = require('../models/Profile');
const { fetchProfileData, ExternalApiError } = require('../services/externalApiService');
const { getAgeGroup } = require('../utils/classifier');

/**
 * POST /api/profiles
 * Creates a new profile or returns existing one (idempotent).
 */
async function createProfile(req, res, next) {
  try {
    const { name } = req.body;

    // --- Validation ---
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (typeof name !== 'string') {
      return res.status(422).json({ error: 'Name must be a string' });
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      return res.status(400).json({ error: 'Name cannot be empty' });
    }

    const normalizedName = trimmedName.toLowerCase();

    // --- Idempotency check ---
    let profile = await Profile.findOne({ normalizedName });
    if (profile) {
      // Return existing profile (idempotent response)
      return res.status(200).json(profile);
    }

    // --- Fetch external data ---
    const externalData = await fetchProfileData(trimmedName);
    const ageGroup = getAgeGroup(externalData.age);

    // --- Create new profile ---
    profile = new Profile({
      name: trimmedName,
      normalizedName,
      gender: externalData.gender,
      genderProbability: externalData.genderProbability,
      sampleSize: externalData.sampleSize,
      age: externalData.age,
      ageGroup,
      countryId: externalData.countryId,
      countryProbability: externalData.countryProbability
    });

    await profile.save();
    
    return res.status(201).json(profile);
  } catch (error) {
    // Handle known external API error
    if (error instanceof ExternalApiError) {
      return res.status(502).json({ error: error.message });
    }
    // Handle duplicate key race condition (should not happen often)
    if (error.code === 11000) {
      // Duplicate key on normalizedName - fetch and return existing
      const existing = await Profile.findOne({ normalizedName: req.body.name.toLowerCase().trim() });
      if (existing) {
        return res.status(200).json(existing);
      }
    }
    // Pass other errors to global error handler
    next(error);
  }
}

/**
 * GET /api/profiles/:id
 * Retrieves a single profile by its UUID v7.
 */
async function getProfileById(req, res, next) {
  try {
    const { id } = req.params;
    
    // Basic UUID v7 format validation (8-4-4-4-12 hex chars)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid profile ID format' });
    }
    
    const profile = await Profile.findById(id);
    
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    return res.status(200).json(profile);
  } catch (error) {
    // Handle CastError (if any, though we validated format)
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid profile ID format' });
    }
    next(error);
  }
}


/**
 * GET /api/profiles
 * Retrieves all profiles with optional filters.
 * Query params: gender, country_id, age_group (all case-insensitive)
 */
async function getAllProfiles(req, res, next) {
  try {
    const { gender, country_id, age_group } = req.query;
    
    // Build dynamic filter object
    const filter = {};
    
    if (gender) {
      filter.gender = gender.toLowerCase();
    }
    if (country_id) {
      filter.countryId = country_id.toUpperCase();
    }
    if (age_group) {
      filter.ageGroup = age_group.toLowerCase();
    }
    
    // Query database, exclude internal normalizedName field, sort newest first
    const profiles = await Profile.find(filter)
      .select('-normalizedName')
      .sort({ createdAt: -1 });
    
    return res.status(200).json(profiles);
  } catch (error) {
    next(error);
  }
}


/**
 * DELETE /api/profiles/:id
 * Permanently deletes a profile by its UUID v7.
 */
async function deleteProfile(req, res, next) {
  try {
    const { id } = req.params;
    
    // Validate UUID v7 format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ error: 'Invalid profile ID format' });
    }
    
    const deletedProfile = await Profile.findByIdAndDelete(id);
    
    if (!deletedProfile) {
      return res.status(404).json({ error: 'Profile not found' });
    }
    
    // 204 No Content - no response body
    return res.status(204).send();
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid profile ID format' });
    }
    next(error);
  }
}

module.exports = { createProfile, getProfileById, getAllProfiles, deleteProfile };