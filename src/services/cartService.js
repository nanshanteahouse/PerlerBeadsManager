const { v4: uuidv4 } = require('uuid');
const dataStore = require('../utils/dataStore');
const validator = require('../utils/validator');

/**
 * Read cart.json, enrich each item with pattern bead details
 */
function getCart() {
  const cart = dataStore.readJSON('cart.json') || [];
  const patterns = dataStore.readJSON('patterns.json') || [];

  return cart.map(item => {
    const pattern = patterns.find(p => p.id === item.patternId);
    if (!pattern) {
      // Scatter item (e.g., mixed beads) — use own beads if present
      if (item.beads && item.beads.length > 0) {
        const colorCount = item.beads.length;
        const totalBeads = item.beads.reduce((sum, b) => sum + (b.quantity || 0), 0);
        return { ...item, beads: item.beads, colorCount, totalBeads };
      }
      return { ...item, beads: [], colorCount: 0, totalBeads: 0 };
    }

    const colorCount = pattern.beads ? pattern.beads.length : 0;
    const totalBeads = pattern.totalBeads || 0;

    return {
      ...item,
      beads: pattern.beads || [],
      colorCount,
      totalBeads,
    };
  });
}

/**
 * Add pattern to cart or increment quantity if already exists
 */
function addToCart(patternId, patternName, quantity) {
  if (!validator.isValidString(patternId)) {
    throw new Error('Invalid pattern ID');
  }
  if (!validator.isValidString(patternName)) {
    throw new Error('Invalid pattern name');
  }
  if (!validator.isValidQuantity(quantity) || quantity < 1) {
    throw new Error('Invalid quantity');
  }

  const cart = dataStore.readJSON('cart.json') || [];

  const existing = cart.find(item => item.patternId === patternId);
  if (existing) {
    existing.quantity += quantity;
    dataStore.writeJSON('cart.json', cart);
    return existing;
  }

  const newItem = {
    id: `cart_${uuidv4().replace(/-/g, '').substring(0, 12)}`,
    patternId,
    patternName,
    quantity,
    addedAt: new Date().toISOString(),
  };

  cart.push(newItem);
  dataStore.writeJSON('cart.json', cart);
  return newItem;
}

/**
 * Update quantity for a cart item
 */
function updateCartItem(id, quantity) {
  if (!validator.isValidQuantity(quantity) || quantity < 1) {
    throw new Error('Invalid quantity');
  }

  const cart = dataStore.readJSON('cart.json') || [];
  const item = cart.find(i => i.id === id);

  if (!item) {
    throw new Error('Cart item not found');
  }

  item.quantity = quantity;
  dataStore.writeJSON('cart.json', cart);
  return item;
}

/**
 * Remove a single item from cart
 */
function removeCartItem(id) {
  const cart = dataStore.readJSON('cart.json') || [];
  const index = cart.findIndex(i => i.id === id);

  if (index === -1) {
    throw new Error('Cart item not found');
  }

  const removed = cart.splice(index, 1);
  dataStore.writeJSON('cart.json', cart);
  return removed[0];
}

/**
 * Clear entire cart
 */
function clearCart() {
  dataStore.writeJSON('cart.json', []);
}

/**
 * Add manual adjustment item to cart (replaces old addMixedBeads)
 * @param {Array} beads - Array of { colorCode, quantity } (quantity can be positive or negative)
 * @param {string} [note] - Optional note for the adjustment
 * @returns {Object} New cart item
 */
function addManualAdjustment(beads, note) {
  if (!Array.isArray(beads) || beads.length === 0) {
    throw new Error('At least one bead entry is required');
  }

  beads.forEach(b => {
    if (!validator.isValidColorCode(b.colorCode)) {
      throw new Error(`Invalid color code: ${b.colorCode}`);
    }
    if (!Number.isSafeInteger(b.quantity) || b.quantity === 0) {
      throw new Error(`Invalid quantity for ${b.colorCode}: must be non-zero integer`);
    }
  });

  const cart = dataStore.readJSON('cart.json') || [];

  const newItem = {
    id: `cart_adj_${uuidv4().replace(/-/g, '').substring(0, 12)}`,
    patternId: null,
    type: 'manual-adjustment',
    patternName: '用量调整',
    quantity: 1,
    beads,
    note: note || '',
    addedAt: new Date().toISOString(),
  };

  cart.push(newItem);
  dataStore.writeJSON('cart.json', cart);
  return newItem;
}

/**
 * Calculate total demand for each color across all cart items
 * Returns summary with demand vs stock comparison
 */
function getDemandSummary() {
  const cart = getCart();
  const inventory = dataStore.readJSON('inventory.json') || {};
  const colors = dataStore.readJSON('colors.json') || [];

  const demandMap = {};

  cart.forEach(item => {
    if (!item.beads) return;

    item.beads.forEach(bead => {
      const needed = bead.quantity * item.quantity;
      if (demandMap[bead.colorCode]) {
        demandMap[bead.colorCode].demand += needed;
      } else {
        demandMap[bead.colorCode] = {
          colorCode: bead.colorCode,
          demand: needed,
          stock: inventory[bead.colorCode] || 0,
        };
      }
    });
  });

  const colorMap = {};
  colors.forEach(c => {
    colorMap[c.code] = c;
  });

  return Object.values(demandMap)
    .map(entry => {
      const colorInfo = colorMap[entry.colorCode] || {};
      const shortfall = Math.max(0, entry.demand - entry.stock);
      const sufficient = entry.stock >= entry.demand;
      const isMixed = entry.colorCode === 'MIX';

      return {
        colorCode: entry.colorCode,
        name: colorInfo.name || '',
        hex: colorInfo.hex || '#888888',
        demand: entry.demand,
        stock: entry.stock,
        shortfall: isMixed ? 0 : shortfall,
        sufficient: isMixed ? true : sufficient,
        isMixed,
      };
    })
    .sort((a, b) => a.colorCode.localeCompare(b.colorCode));
}

/**
 * Submit cart - validate stock, deduct inventory, create transactions, clear cart
 */
function submitCart() {
  const cart = getCart();
  const demandSummary = getDemandSummary();

  if (cart.length === 0) {
    throw new Error('Cart is empty');
  }

  const insufficient = demandSummary.filter(d => !d.sufficient);
  const inventory = dataStore.readJSON('inventory.json') || {};
  const transactions = dataStore.readJSON('transactions.json') || [];
  const today = new Date().toISOString().split('T')[0];

  // Deduct inventory and create transactions
  demandSummary.forEach(entry => {
    const newStock = (inventory[entry.colorCode] || 0) - entry.demand;
    inventory[entry.colorCode] = newStock;

    const hasManualAdjustment = cart.some(item =>
      item.type === 'manual-adjustment' && item.beads &&
      item.beads.some(b => b.colorCode === entry.colorCode)
    );

    const transaction = {
      id: `txn_${uuidv4().replace(/-/g, '').substring(0, 12)}`,
      type: hasManualAdjustment ? 'adjustment' : 'consumption',
      colorCode: entry.colorCode,
      quantity: -entry.demand,
      store: '',
      date: today,
      note: '',
      createdAt: new Date().toISOString(),
    };

    // Collect source names for the note
    const sourceNames = [];
    cart.forEach(item => {
      if (item.beads) {
        const bead = item.beads.find(b => b.colorCode === entry.colorCode);
        if (bead) {
          if (item.type === 'manual-adjustment') {
            sourceNames.push(`${item.patternName} (${bead.quantity >= 0 ? '+' : ''}${bead.quantity})`);
          } else {
            sourceNames.push(`${item.patternName} x${item.quantity}`);
          }
        }
      }
    });

    if (sourceNames.length > 0) {
      if (hasManualAdjustment) {
        transaction.note = `手动调整: ${sourceNames.join(', ')}`;
      } else {
        transaction.note = `图纸耗用: ${sourceNames.join(', ')}`;
      }
    }

    transactions.push(transaction);
  });

  // Write back inventory and transactions
  dataStore.writeJSON('inventory.json', inventory);
  dataStore.writeJSON('transactions.json', transactions);

  // Clear cart
  clearCart();

  return {
    success: true,
    insufficient,
    deductedColors: demandSummary.length,
  };
}

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
  addManualAdjustment,
  getDemandSummary,
  submitCart,
};