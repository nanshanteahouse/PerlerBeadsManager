const { readJSON, writeJSON } = require('../utils/dataStore');
const { isValidColorCode, isValidQuantity, isValidString } = require('../utils/validator');
const { getTextColor } = require('../utils/colorConverter');

const INVENTORY_FILE = 'inventory.json';
const COLORS_FILE = 'colors.json';
const TRANSACTIONS_FILE = 'transactions.json';
const STORES_FILE = 'stores.json';

const SERIES_NAMES = {
  A: '黄色系',
  B: '绿色系',
  C: '蓝色系',
  D: '紫色系',
  E: '粉红色系',
  F: '红色系',
  G: '棕色/橙色系',
  H: '黑白灰色系',
  M: '莫兰迪色系',
  X: '混豆',
};

/**
 * Get inventory with optional filters, merged with color data
 * @param {Object} filters - { series, sort, lowStock }
 * @returns {Array} Array of inventory items with color data
 */
function getInventory(filters = {}) {
  const { series, sort, lowStock } = filters;

  const colors = readJSON(COLORS_FILE) || {};
  const inventory = readJSON(INVENTORY_FILE) || {};

  let items = Object.keys(inventory).map((code) => {
    const colorData = colors[code] || {};
    return {
      code,
      name: colorData.name || '',
      hex: colorData.hex || '#cccccc',
      series: colorData.series || code.charAt(0),
      rgb: colorData.rgb || [204, 204, 204],
      lab: colorData.lab || [0, 0, 0],
      quantity: inventory[code] || 0,
    };
  });

  if (series && series !== 'all') {
    items = items.filter((item) => item.series === series);
  }

  if (lowStock !== undefined && lowStock !== null && lowStock !== '') {
    const threshold = parseInt(lowStock, 10);
    if (!isNaN(threshold)) {
      items = items.filter((item) => item.quantity <= threshold);
    }
  }

  const sortOrder = sort === 'asc' ? 1 : -1;
  items.sort((a, b) => {
    if (a.code < b.code) return -1 * sortOrder;
    if (a.code > b.code) return 1 * sortOrder;
    return 0;
  });

  return items;
}

/**
 * Get single inventory item by code
 * @param {string} code - Color code
 * @returns {Object|null} Inventory item with color data
 */
function getInventoryByCode(code) {
  if (!isValidColorCode(code)) {
    return null;
  }

  const colors = readJSON(COLORS_FILE) || {};
  const inventory = readJSON(INVENTORY_FILE) || {};

  const colorData = colors[code] || {};
  const quantity = inventory[code] || 0;

  return {
    code,
    name: colorData.name || '',
    hex: colorData.hex || '#cccccc',
    series: colorData.series || code.charAt(0),
    rgb: colorData.rgb || [204, 204, 204],
    lab: colorData.lab || [0, 0, 0],
    quantity,
  };
}

/**
 * Update inventory for a color code
 * @param {string} code - Color code
 * @param {number} quantity - Quantity to set or delta to apply
 * @param {string} reason - Reason for adjustment (required)
 * @param {string} store - Store name (optional)
 * @param {boolean} isDelta - If true, quantity is delta; if false, sets new value
 * @returns {Object} { success, inventory, transaction }
 */
function updateInventory(code, quantity, reason, store, isDelta = true) {
  if (!isValidColorCode(code)) {
    throw new Error('无效的色号');
  }

  if (!isValidQuantity(quantity)) {
    throw new Error('无效的数量');
  }

  if (!isValidString(reason)) {
    throw new Error('调整原因不能为空');
  }

  const inventory = readJSON(INVENTORY_FILE) || {};
  const transactions = readJSON(TRANSACTIONS_FILE) || [];

  const currentQty = inventory[code] || 0;
  let newQty;

  if (isDelta) {
    newQty = currentQty + quantity;
  } else {
    newQty = quantity;
  }

  inventory[code] = newQty;

  const transaction = {
    id: generateId(),
    type: quantity >= 0 ? 'purchase' : 'adjustment',
    colorCode: code,
    quantity: isDelta ? quantity : (newQty - currentQty),
    store: store || null,
    date: new Date().toISOString().split('T')[0],
    note: reason,
    createdAt: new Date().toISOString(),
  };

  transactions.unshift(transaction);

  writeJSON(INVENTORY_FILE, inventory);
  writeJSON(TRANSACTIONS_FILE, transactions);

  return {
    success: true,
    inventory: { code, quantity: newQty },
    transaction,
  };
}

/**
 * Get inventory statistics
 * @returns {Object} { totalColors, totalBeads, lowStockCount, outOfStockCount }
 */
function getStats() {
  const colors = readJSON(COLORS_FILE) || [];
  const inventory = readJSON(INVENTORY_FILE) || {};

  let totalColors = 0;
  let totalBeads = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let mixedBeads = 0;

  const LOW_STOCK_THRESHOLD = 50;

  // colors.json is an array, need to handle both array and object cases
  const colorCodes = Array.isArray(colors) ? colors.map(c => c.code) : Object.keys(colors);

  colorCodes.forEach((code) => {
    const qty = inventory[code] || 0;

    if (code === 'MIX') {
      mixedBeads = qty;
      totalBeads += qty;
      return;
    }

    totalColors++;
    totalBeads += qty;

    if (qty === 0) {
      outOfStockCount++;
    } else if (qty <= LOW_STOCK_THRESHOLD) {
      lowStockCount++;
    }
  });

  return {
    totalColors,
    totalBeads,
    lowStockCount,
    outOfStockCount,
    mixedBeads,
  };
}

/**
 * Get all stores
 * @returns {Array} Array of store names
 */
function getStores() {
  const stores = readJSON(STORES_FILE) || [];
  return stores;
}

/**
 * Update stores list
 * @param {Array} stores - Array of store name strings
 */
function updateStores(stores) {
  if (!Array.isArray(stores)) {
    throw new Error('店家列表必须是数组');
  }

  // Ensure all items are non-empty strings
  stores = stores.filter((s) => isValidString(s));

  writeJSON(STORES_FILE, stores);
  return stores;
}

/**
 * Transfer beads from a source color to mixed beads
 * @param {string} sourceCode - Source color code
 * @param {number} quantity - Quantity to transfer
 * @returns {Object} { success, source: {code, quantity}, mixed: {quantity}, transactions }
 */
function transferToMixed(sourceCode, quantity) {
  if (!isValidColorCode(sourceCode)) {
    throw new Error('无效的色号');
  }

  if (sourceCode === 'MIX') {
    throw new Error('不能从混豆倒入混豆');
  }

  if (!isValidQuantity(quantity) || quantity <= 0) {
    throw new Error('无效的数量');
  }

  const inventory = readJSON(INVENTORY_FILE) || {};
  const transactions = readJSON(TRANSACTIONS_FILE) || [];

  const sourceCurrent = inventory[sourceCode] || 0;
  if (quantity > sourceCurrent) {
    throw new Error(`库存不足：${sourceCode} 当前库存为 ${sourceCurrent}`);
  }

  const mixedCurrent = inventory['MIX'] || 0;

  // Deduct source, add to MIX
  inventory[sourceCode] = sourceCurrent - quantity;
  inventory['MIX'] = mixedCurrent + quantity;

  const now = new Date().toISOString();

  const sourceTx = {
    id: generateId(),
    type: 'adjustment',
    colorCode: sourceCode,
    quantity: -quantity,
    store: null,
    date: now.split('T')[0],
    note: '倒入混豆',
    createdAt: now,
  };

  const mixTx = {
    id: generateId(),
    type: 'adjustment',
    colorCode: 'MIX',
    quantity: quantity,
    store: null,
    date: now.split('T')[0],
    note: `从 ${sourceCode} 混入`,
    createdAt: now,
  };

  transactions.unshift(mixTx);
  transactions.unshift(sourceTx);

  writeJSON(INVENTORY_FILE, inventory);
  writeJSON(TRANSACTIONS_FILE, transactions);

  return {
    success: true,
    source: { code: sourceCode, quantity: inventory[sourceCode] },
    mixed: { quantity: inventory['MIX'] },
    transactions: [sourceTx, mixTx],
  };
}

/**
 * Generate a simple unique ID
 * @returns {string} Unique ID
 */
function generateId() {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `txn_${timestamp}${random}`;
}

module.exports = {
  getInventory,
  getInventoryByCode,
  updateInventory,
  getStats,
  getStores,
  updateStores,
  transferToMixed,
  SERIES_NAMES,
};