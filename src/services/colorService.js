const dataStore = require('../utils/dataStore');
const colorConverter = require('../utils/colorConverter');

/**
 * Get all colors with optional filters
 * @param {Object} filters - { series: 'A'|'B'|..., query: 'search term' }
 * @returns {Array} filtered colors
 */
function getColors(filters) {
  const colors = dataStore.readJSON('colors.json') || [];
  const inventory = dataStore.readJSON('inventory.json') || {};

  let result = colors.map(c => ({
    ...c,
    stock: inventory[c.code] !== undefined ? inventory[c.code] : 0,
  }));

  if (filters) {
    if (filters.series && filters.series !== 'all') {
      result = result.filter(c => c.series === filters.series);
    }

    if (filters.query && filters.query.trim()) {
      const q = filters.query.trim().toLowerCase();
      result = result.filter(c => {
        return c.code.toLowerCase().includes(q) ||
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.nameEn && c.nameEn.toLowerCase().includes(q));
      });
    }
  }

  return result;
}

/**
 * Get a single color by code
 * @param {string} code - color code like 'A01'
 * @returns {Object|null} color object or null
 */
function getColorByCode(code) {
  const colors = dataStore.readJSON('colors.json') || [];
  return colors.find(c => c.code === code) || null;
}

/**
 * Update color name fields
 * @param {string} code - color code
 * @param {string} name - Chinese name
 * @param {string} nameEn - English name
 * @returns {Object} { success: boolean, color?: Object, error?: string }
 */
function updateColorName(code, name, nameEn) {
  const colors = dataStore.readJSON('colors.json') || [];
  const index = colors.findIndex(c => c.code === code);

  if (index === -1) {
    return { success: false, error: 'Color not found' };
  }

  colors[index] = {
    ...colors[index],
    name: name || colors[index].name,
    nameEn: nameEn !== undefined ? nameEn : colors[index].nameEn,
  };

  dataStore.writeJSON('colors.json', colors);

  return { success: true, color: colors[index] };
}

module.exports = {
  getColors,
  getColorByCode,
  updateColorName,
};