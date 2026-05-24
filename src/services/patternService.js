/**
 * Pattern Service — CRUD + import/export + stock check
 */
const { v4: uuidv4 } = require('uuid');
const dataStore = require('../utils/dataStore');
const validator = require('../utils/validator');

const PATTERNS_FILE = 'patterns.json';
const INVENTORY_FILE = 'inventory.json';

/**
 * Read all patterns, sorted by createdAt descending
 */
function getPatterns() {
  const patterns = dataStore.readJSON(PATTERNS_FILE) || [];
  return patterns.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Get a single pattern by id
 */
function getPatternById(id) {
  const patterns = dataStore.readJSON(PATTERNS_FILE) || [];
  return patterns.find(p => p.id === id) || null;
}

/**
 * Calculate totalBeads from beads array
 */
function calcTotalBeads(beads) {
  return beads.reduce((sum, b) => sum + b.quantity, 0);
}

/**
 * Create a new pattern
 */
function createPattern(data) {
  const errors = [];
  if (!validator.isValidString(data.name, 100)) {
    errors.push('图纸名称必填，最多100字符');
  }
  if (data.boardSize && !validator.isValidBoardSize(data.boardSize)) {
    errors.push('底板尺寸无效（宽高1-200）');
  }
  if (!data.beads || !validator.isValidBeadsArray(data.beads)) {
    errors.push('色号用度无效，至少需要一种色号且用量>0');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('；'));
  }

  const now = new Date().toISOString();
  const pattern = {
    id: 'pat_' + uuidv4().replace(/-/g, '').slice(0, 12),
    name: data.name.trim(),
    description: (data.description || '').trim(),
    boardSize: data.boardSize || null,
    beads: data.beads.map(b => ({
      colorCode: b.colorCode.toUpperCase(),
      quantity: parseInt(b.quantity, 10)
    })),
    totalBeads: calcTotalBeads(data.beads),
    createdAt: now,
    updatedAt: now
  };

  const patterns = dataStore.readJSON(PATTERNS_FILE) || [];
  patterns.push(pattern);
  dataStore.writeJSON(PATTERNS_FILE, patterns);

  return pattern;
}

/**
 * Update an existing pattern
 */
function updatePattern(id, data) {
  const patterns = dataStore.readJSON(PATTERNS_FILE) || [];
  const idx = patterns.findIndex(p => p.id === id);
  if (idx === -1) {
    throw new Error('图纸不存在');
  }

  const errors = [];
  if (data.name !== undefined && !validator.isValidString(data.name, 100)) {
    errors.push('图纸名称必填，最多100字符');
  }
  if (data.boardSize !== undefined && data.boardSize !== null && !validator.isValidBoardSize(data.boardSize)) {
    errors.push('底板尺寸无效（宽高1-200）');
  }
  if (data.beads !== undefined && !validator.isValidBeadsArray(data.beads)) {
    errors.push('色号用度无效，至少需要一种色号且用量>0');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('；'));
  }

  const existing = patterns[idx];
  const updated = {
    ...existing,
    name: data.name !== undefined ? data.name.trim() : existing.name,
    description: data.description !== undefined ? data.description.trim() : existing.description,
    boardSize: data.boardSize !== undefined ? (data.boardSize || null) : existing.boardSize,
    beads: data.beads !== undefined ? data.beads.map(b => ({
      colorCode: b.colorCode.toUpperCase(),
      quantity: parseInt(b.quantity, 10)
    })) : existing.beads,
    totalBeads: data.beads !== undefined ? calcTotalBeads(data.beads) : existing.totalBeads,
    updatedAt: new Date().toISOString()
  };

  patterns[idx] = updated;
  dataStore.writeJSON(PATTERNS_FILE, patterns);

  return updated;
}

/**
 * Delete a pattern
 */
function deletePattern(id) {
  const patterns = dataStore.readJSON(PATTERNS_FILE) || [];
  const idx = patterns.findIndex(p => p.id === id);
  if (idx === -1) {
    throw new Error('图纸不存在');
  }

  patterns.splice(idx, 1);
  dataStore.writeJSON(PATTERNS_FILE, patterns);
  return { success: true };
}

/**
 * Check stock for a pattern
 * Returns {sufficient: bool, items: [{colorCode, needed, stock, shortfall}]}
 */
function checkStock(id) {
  const pattern = getPatternById(id);
  if (!pattern) {
    throw new Error('图纸不存在');
  }

  const inventory = dataStore.readJSON(INVENTORY_FILE) || {};
  const items = [];
  let sufficient = true;

  for (const bead of pattern.beads) {
    const stock = inventory[bead.colorCode] || 0;
    const shortfall = bead.quantity - stock;
    if (shortfall > 0) sufficient = false;
    items.push({
      colorCode: bead.colorCode,
      needed: bead.quantity,
      stock: stock,
      shortfall: Math.max(0, shortfall)
    });
  }

  return { sufficient, items };
}

/**
 * Import a pattern from JSON data
 */
function importPattern(jsonData) {
  let data;
  if (typeof jsonData === 'string') {
    try {
      data = JSON.parse(jsonData);
    } catch (e) {
      throw new Error('无效的JSON格式');
    }
  } else {
    data = jsonData;
  }

  const errors = [];
  if (!validator.isValidString(data.name, 100)) {
    errors.push('图纸名称必填');
  }
  if (data.boardSize && !validator.isValidBoardSize(data.boardSize)) {
    errors.push('底板尺寸无效');
  }
  if (!data.beads || !validator.isValidBeadsArray(data.beads)) {
    errors.push('色号用度无效');
  }
  if (errors.length > 0) {
    throw new Error(errors.join('；'));
  }

  return createPattern(data);
}

/**
 * Batch delete patterns by ids
 */
function batchDelete(ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new Error('请提供要删除的图纸ID列表');
  }
  const patterns = dataStore.readJSON(PATTERNS_FILE) || [];
  const remaining = patterns.filter(p => !ids.includes(p.id));
  const deleted = patterns.length - remaining.length;
  dataStore.writeJSON(PATTERNS_FILE, remaining);
  return { deleted };
}

module.exports = {
  getPatterns,
  getPatternById,
  createPattern,
  updatePattern,
  deletePattern,
  batchDelete,
  checkStock,
  importPattern
};