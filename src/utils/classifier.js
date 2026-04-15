/**
 * Determine age group based on age in years.
 * @param {number|null|undefined} age - Age in years.
 * @returns {string|null} - One of 'child', 'teenager', 'adult', 'senior', or null if invalid.
 */
function getAgeGroup(age) {
  // Convert to number if possible
  const numAge = Number(age);
  
  // Check for invalid cases: NaN, null, undefined, negative, or non-integer (optional)
  if (isNaN(numAge) || numAge < 0) {
    return null;
  }
  
  if (numAge <= 12) {
    return 'child';
  } else if (numAge <= 19) {
    return 'teenager';
  } else if (numAge <= 59) {
    return 'adult';
  } else {
    return 'senior';
  }
}

module.exports = { getAgeGroup };