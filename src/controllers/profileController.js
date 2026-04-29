const Profile = require('../models/Profile');
const { fetchProfileData, ExternalApiError } = require('../services/externalApiService');
const { getAgeGroup } = require('../utils/classifier');

// ---------- Helper: build filters from query params ----------
const buildFilters = (query) => {
  const filter = {};
  if (query.gender) filter.gender = query.gender.toLowerCase();
  if (query.age_group) filter.ageGroup = query.age_group.toLowerCase();
  if (query.country_id) filter.countryId = query.country_id.toUpperCase();
  if (query.min_age) filter.age = { $gte: parseInt(query.min_age) };
  if (query.max_age) filter.age = { ...filter.age, $lte: parseInt(query.max_age) };
  if (query.min_gender_probability) filter.genderProbability = { $gte: parseFloat(query.min_gender_probability) };
  if (query.min_country_probability) filter.countryProbability = { $gte: parseFloat(query.min_country_probability) };
  return filter;
};

// ---------- Helper: build sort object ----------
const buildSort = (sortBy, order) => {
  const validSortFields = ['age', 'createdAt', 'genderProbability'];
  const fieldMap = {
    age: 'age',
    created_at: 'createdAt',
    gender_probability: 'genderProbability'
  };
  const sortField = fieldMap[sortBy] || 'createdAt';
  if (!validSortFields.includes(sortField)) return { createdAt: -1 };
  return { [sortField]: order === 'asc' ? 1 : -1 };
};

// ---------- POST /api/profiles ----------
async function createProfile(req, res, next) {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (typeof name !== 'string') return res.status(422).json({ error: 'Name must be a string' });
    const trimmedName = name.trim();
    if (trimmedName.length === 0) return res.status(400).json({ error: 'Name cannot be empty' });
    const normalizedName = trimmedName.toLowerCase();

    let profile = await Profile.findOne({ normalizedName });
    if (profile) {
      return res.status(200).json({ message: 'already exists', data: profile.toJSON() });
    }

    const externalData = await fetchProfileData(trimmedName);
    const ageGroup = getAgeGroup(externalData.age);
    profile = new Profile({
      name: trimmedName,
      normalizedName,
      gender: externalData.gender,
      genderProbability: externalData.genderProbability,
      sampleSize: externalData.sampleSize,
      age: externalData.age,
      ageGroup,
      countryId: externalData.countryId,
      countryProbability: externalData.countryProbability,
      countryName: null
    });
    await profile.save();
    return res.status(201).json(profile.toJSON());
  } catch (error) {
    if (error instanceof ExternalApiError) return res.status(502).json({ error: error.message });
    if (error.code === 11000) {
      const existing = await Profile.findOne({ normalizedName: req.body.name.toLowerCase().trim() });
      if (existing) return res.status(200).json({ message: 'already exists', data: existing.toJSON() });
    }
    next(error);
  }
}

// ---------- GET /api/profiles/:id ----------
async function getProfileById(req, res, next) {
  try {
    const { id } = req.params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) return res.status(400).json({ error: 'Invalid profile ID format' });
    const profile = await Profile.findById(id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    return res.status(200).json(profile.toJSON());
  } catch (error) {
    if (error.name === 'CastError') return res.status(400).json({ error: 'Invalid profile ID format' });
    next(error);
  }
}

// ---------- GET /api/profiles (enhanced with filters, sort, pagination, and updated shape) ----------
async function getAllProfiles(req, res, next) {
  try {
    const { gender, age_group, country_id, min_age, max_age, min_gender_probability, min_country_probability, sort_by, order, page, limit } = req.query;

    // Build filter
    const filter = {};
    if (gender) filter.gender = gender.toLowerCase();
    if (age_group) filter.ageGroup = age_group.toLowerCase();
    if (country_id) filter.countryId = country_id.toUpperCase();
    if (min_age) filter.age = { $gte: parseInt(min_age) };
    if (max_age) filter.age = { ...filter.age, $lte: parseInt(max_age) };
    if (min_gender_probability) filter.genderProbability = { $gte: parseFloat(min_gender_probability) };
    if (min_country_probability) filter.countryProbability = { $gte: parseFloat(min_country_probability) };

    // Build sort
    let sortObj = { createdAt: -1 };
    if (sort_by) {
      const fieldMap = { age: 'age', created_at: 'createdAt', gender_probability: 'genderProbability' };
      const sortField = fieldMap[sort_by];
      if (sortField) sortObj = { [sortField]: order === 'asc' ? 1 : -1 };
    }

    // Pagination
    const pageNum = parseInt(page) || 1;
    let limitNum = parseInt(limit) || 10;
    if (limitNum > 50) limitNum = 50;
    const skip = (pageNum - 1) * limitNum;

    // Execute queries
    const total = await Profile.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);
    const profiles = await Profile.find(filter)
      .sort(sortObj)
      .skip(skip)
      .limit(limitNum)
      .select('-normalizedName');

    // Build pagination links
    const baseUrl = req.protocol + '://' + req.get('host') + req.baseUrl + req.path;
    const queryParams = new URLSearchParams(req.query);
    queryParams.set('page', pageNum);
    queryParams.set('limit', limitNum);

    const links = {
      self: `${baseUrl}?${queryParams.toString()}`,
      next: pageNum < totalPages ? `${baseUrl}?${new URLSearchParams({ ...req.query, page: pageNum + 1, limit: limitNum }).toString()}` : null,
      prev: pageNum > 1 ? `${baseUrl}?${new URLSearchParams({ ...req.query, page: pageNum - 1, limit: limitNum }).toString()}` : null
    };

    const data = profiles.map(p => p.toJSON());
    return res.status(200).json({
      status: 'success',
      page: pageNum,
      limit: limitNum,
      total,
      total_pages: totalPages,
      links,
      data
    });
  } catch (error) {
    next(error);
  }
}

// ---------- DELETE /api/profiles/:id ----------
async function deleteProfile(req, res, next) {
  try {
    const { id } = req.params;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) return res.status(400).json({ error: 'Invalid profile ID format' });
    const deletedProfile = await Profile.findByIdAndDelete(id);
    if (!deletedProfile) return res.status(404).json({ error: 'Profile not found' });
    return res.status(204).send();
  } catch (error) {
    if (error.name === 'CastError') return res.status(400). json({ error: 'Invalid profile ID format' });
    next(error);
  }
}

// ---------- NATURAL LANGUAGE SEARCH: GET /api/profiles/search ----------
const parseNaturalQuery = (q) => {
  if (!q || typeof q !== 'string') return null;
  const queryLower = q.toLowerCase();
  const filters = {};

  if (queryLower.includes('male')) filters.gender = 'male';
  else if (queryLower.includes('female')) filters.gender = 'female';

  if (queryLower.includes('teenager') || queryLower.includes('teens') || (queryLower.includes('young') && !queryLower.includes('teenager'))) {
    if (queryLower.includes('young') && !queryLower.includes('teenager')) {
      filters.min_age = 16;
      filters.max_age = 24;
    } else {
      filters.age_group = 'teenager';
    }
  }
  if (queryLower.includes('adult')) filters.age_group = 'adult';
  if (queryLower.includes('senior') || queryLower.includes('old')) filters.age_group = 'senior';
  if (queryLower.includes('child') || queryLower.includes('kid')) filters.age_group = 'child';

  const aboveMatch = queryLower.match(/above\s+(\d+)/);
  if (aboveMatch) filters.min_age = parseInt(aboveMatch[1]);
  const belowMatch = queryLower.match(/below\s+(\d+)/);
  if (belowMatch) filters.max_age = parseInt(belowMatch[1]);

  const countryMatch = queryLower.match(/from\s+([a-z]+)/);
  if (countryMatch) {
    const countryMap = {
      nigeria: 'NG', angola: 'AO', kenya: 'KE', ghana: 'GH', southafrica: 'ZA',
      egypt: 'EG', morocco: 'MA', algeria: 'DZ', tunisia: 'TN', senegal: 'SN'
    };
    const countryName = countryMatch[1];
    filters.country_id = countryMap[countryName] || countryName.toUpperCase();
  }

  if (Object.keys(filters).length === 0) return null;
  return filters;
};

async function searchProfiles(req, res, next) {
  try {
    const { q, page, limit } = req.query;
    if (!q) {
      return res.status(400).json({ status: 'error', message: 'Missing query parameter q' });
    }
    const parsed = parseNaturalQuery(q);
    if (!parsed) {
      return res.status(400).json({ status: 'error', message: 'Unable to interpret query' });
    }

    const filter = {};
    if (parsed.gender) filter.gender = parsed.gender;
    if (parsed.age_group) filter.ageGroup = parsed.age_group;
    if (parsed.country_id) filter.countryId = parsed.country_id.toUpperCase();
    if (parsed.min_age || parsed.max_age) {
      filter.age = {};
      if (parsed.min_age) filter.age.$gte = parsed.min_age;
      if (parsed.max_age) filter.age.$lte = parsed.max_age;
    }

    const pageNum = parseInt(page) || 1;
    let limitNum = parseInt(limit) || 10;
    if (limitNum > 50) limitNum = 50;
    const skip = (pageNum - 1) * limitNum;

    const total = await Profile.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum);
    const profiles = await Profile.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .select('-normalizedName');

    const baseUrl = req.protocol + '://' + req.get('host') + req.baseUrl + req.path;
    const queryParams = new URLSearchParams(req.query);
    queryParams.set('page', pageNum);
    queryParams.set('limit', limitNum);

    const links = {
      self: `${baseUrl}?${queryParams.toString()}`,
      next: pageNum < totalPages ? `${baseUrl}?${new URLSearchParams({ ...req.query, page: pageNum + 1, limit: limitNum }).toString()}` : null,
      prev: pageNum > 1 ? `${baseUrl}?${new URLSearchParams({ ...req.query, page: pageNum - 1, limit: limitNum }).toString()}` : null
    };

    const data = profiles.map(p => p.toJSON());
    return res.status(200).json({
      status: 'success',
      page: pageNum,
      limit: limitNum,
      total,
      total_pages: totalPages,
      links,
      data
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { createProfile, getProfileById, getAllProfiles, deleteProfile, searchProfiles };