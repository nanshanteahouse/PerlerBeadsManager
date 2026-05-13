/**
 * Color Diff Service
 * Handles CIEDE2000 color difference calculations
 */

const colorDiff = require('color-diff');
const dataStore = require('../utils/dataStore');
const colorConverter = require('../utils/colorConverter');

const COLORS_FILE = 'colors.json';
const INVENTORY_FILE = 'inventory.json';

/**
 * Calculate color difference between a target hex and all colors in the library
 * @param {string} hex - Target color hex (with or without #)
 * @param {Object} options - { limit: number, inStockOnly: boolean }
 * @returns {Object} { targetHex, targetLab, results: [{rank, colorCode, hex, name, deltaE, perceptualLevel, stock}] }
 */
function calculateDiff(hex, options = {}) {
  const { limit = 20, inStockOnly = true } = options;

  // Normalize hex - ensure it has #
  const cleanHex = hex.startsWith('#') ? hex.toUpperCase() : '#' + hex.toUpperCase();

  // Convert target hex to LAB using colorConverter
  const rawLab = colorConverter.hexToLab(cleanHex);
  const targetLab = {
    L: rawLab.L != null ? rawLab.L : rawLab[0],
    a: rawLab.a != null ? rawLab.a : rawLab[1],
    b: rawLab.b != null ? rawLab.b : rawLab[2],
  };
  if (targetLab.a === 0 && targetLab.b === 0) {
    targetLab.a = 0.0001;
    targetLab.b = 0.0001;
  }

  // Read all colors from colors.json
  const colors = dataStore.readJSON(COLORS_FILE) || [];

  // Read inventory from inventory.json
  const inventory = dataStore.readJSON(INVENTORY_FILE) || {};

  // Build array of colors with deltaE calculations
  const results = [];

  for (const color of colors) {
    // Get stock for this color
    const stock = inventory[color.code] || 0;

    // If inStockOnly, filter to colors with stock > 0
    if (inStockOnly && stock <= 0) {
      continue;
    }

    // Calculate deltaE between target and this color's lab
    // color-diff's diff() expects {L, a, b} objects
    // colors.json stores lab as array like [98.2, -1.5, 18.3]
    const colorLabObj = {
      L: color.lab.L || color.lab[0],
      a: color.lab.a || color.lab[1],
      b: color.lab.b || color.lab[2],
    };
    if (colorLabObj.a === 0 && colorLabObj.b === 0) {
      colorLabObj.a = 0.0001;
      colorLabObj.b = 0.0001;
    }

    const deltaE = colorDiff.diff(targetLab, colorLabObj);

    // Determine perceptual level
    const perceptualLevel = getPerceptualLevel(deltaE);

    results.push({
      colorCode: color.code,
      hex: color.hex,
      name: color.name || '',
      deltaE: Math.round(deltaE * 100) / 100, // Round to 2 decimals
      perceptualLevel,
      stock,
    });
  }

  // Sort by deltaE ascending
  results.sort((a, b) => a.deltaE - b.deltaE);

  // Slice to limit
  const limitedResults = results.slice(0, limit);

  // Add rank
  const rankedResults = limitedResults.map((item, index) => ({
    rank: index + 1,
    ...item,
  }));

  return {
    targetHex: cleanHex,
    targetLab: [Math.round(targetLab.L * 100) / 100, Math.round(targetLab.a * 100) / 100, Math.round(targetLab.b * 100) / 100],
    results: rankedResults,
  };
}

/**
 * Get perceptual level label based on deltaE value
 * @param {number} deltaE - DeltaE value
 * @returns {string} Perceptual level label
 */
function getPerceptualLevel(deltaE) {
  if (deltaE <= 1) return 'imperceptible';
  if (deltaE <= 3) return 'close';
  if (deltaE <= 5) return 'acceptable';
  if (deltaE <= 7) return 'noticeable';
  return 'different';
}

module.exports = {
  calculateDiff,
  getPerceptualLevel,
};