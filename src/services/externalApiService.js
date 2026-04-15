const axios = require('axios');

// Optional: move these URLs to config later
const GENDERIZE_API = 'https://api.genderize.io';
const AGIFY_API = 'https://api.agify.io';
const NATIONALIZE_API = 'https://api.nationalize.io';

class ExternalApiError extends Error {
  constructor(message, apiName) {
    super(message);
    this.name = 'ExternalApiError';
    this.apiName = apiName;
    this.statusCode = 502; // Bad Gateway
  }
}

/**
 * Fetch profile data from genderize, agify, and nationalize APIs in parallel.
 * @param {string} name - The name to query.
 * @returns {Promise<Object>} - Returns an object with gender, genderProbability, sampleSize, age, countryId, countryProbability.
 * @throws {ExternalApiError} - If any API returns invalid data.
 */
async function fetchProfileData(name) {
  const encodedName = encodeURIComponent(name);
  
  const genderizeUrl = `${GENDERIZE_API}?name=${encodedName}`;
  const agifyUrl = `${AGIFY_API}?name=${encodedName}`;
  const nationalizeUrl = `${NATIONALIZE_API}?name=${encodedName}`;

  try {
    const [genderRes, ageRes, countryRes] = await Promise.all([
      axios.get(genderizeUrl),
      axios.get(agifyUrl),
      axios.get(nationalizeUrl)
    ]);

    // Validate Genderize response
    const genderData = genderRes.data;
    if (!genderData.gender || genderData.count === 0) {
      throw new ExternalApiError(
        `Invalid gender data: gender=${genderData.gender}, count=${genderData.count}`,
        'Genderize'
      );
    }

    // Validate Agify response
    const ageData = ageRes.data;
    if (ageData.age === null || ageData.age === undefined) {
      throw new ExternalApiError(
        `Invalid age data: age=${ageData.age}`,
        'Agify'
      );
    }

    // Validate Nationalize response
    const countryData = countryRes.data;
    if (!countryData.country || countryData.country.length === 0 || !countryData.country[0].country_id) {
      throw new ExternalApiError(
        `Invalid country data: no valid country found`,
        'Nationalize'
      );
    }

    // Extract highest probability country (first in array)
    const topCountry = countryData.country[0];

    return {
      gender: genderData.gender,
      genderProbability: genderData.probability,
      sampleSize: genderData.count,
      age: ageData.age,
      countryId: topCountry.country_id,
      countryProbability: topCountry.probability
    };
  } catch (error) {
    // If it's already our custom error, rethrow it
    if (error instanceof ExternalApiError) {
      throw error;
    }
    // Otherwise wrap network/other errors
    throw new ExternalApiError(
      `External API request failed: ${error.message}`,
      'Unknown'
    );
  }
}

module.exports = { fetchProfileData, ExternalApiError };