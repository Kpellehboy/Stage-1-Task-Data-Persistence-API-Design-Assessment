const Profile = require('../models/Profile');

async function exportProfilesCSV(req, res, next) {
  try {
    // Build filter exactly as in getAllProfiles (reuse logic)
    const { gender, age_group, country_id, min_age, max_age, min_gender_probability, min_country_probability, sort_by, order } = req.query;
    const filter = {};
    if (gender) filter.gender = gender.toLowerCase();
    if (age_group) filter.ageGroup = age_group.toLowerCase();
    if (country_id) filter.countryId = country_id.toUpperCase();
    if (min_age) filter.age = { $gte: parseInt(min_age) };
    if (max_age) filter.age = { ...filter.age, $lte: parseInt(max_age) };
    if (min_gender_probability) filter.genderProbability = { $gte: parseFloat(min_gender_probability) };
    if (min_country_probability) filter.countryProbability = { $gte: parseFloat(min_country_probability) };

    let sortObj = { createdAt: -1 };
    if (sort_by) {
      const fieldMap = { age: 'age', created_at: 'createdAt', gender_probability: 'genderProbability' };
      const sortField = fieldMap[sort_by];
      if (sortField) sortObj = { [sortField]: order === 'asc' ? 1 : -1 };
    }

    const profiles = await Profile.find(filter).sort(sortObj).select('-normalizedName');
    const data = profiles.map(p => p.toJSON());

    // CSV generation
    const headers = ['id', 'name', 'gender', 'gender_probability', 'age', 'age_group', 'country_id', 'country_name', 'country_probability', 'created_at'];
    const csvRows = [headers.join(',')];
    for (const row of data) {
      csvRows.push(headers.map(header => {
        let value = row[header] !== undefined ? row[header] : '';
        if (value && (typeof value === 'string' && value.includes(','))) value = `"${value}"`;
        return value;
      }).join(','));
    }

    const csvString = csvRows.join('\n');
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="profiles_${timestamp}.csv"`);
    res.status(200).send(csvString);
  } catch (error) {
    next(error);
  }
}

module.exports = { exportProfilesCSV };