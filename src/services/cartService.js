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
      return {
        ...item,
        beads: [],
        colorCount: 0,
        totalBeads: 0,
      };
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

      return {
        colorCode: entry.colorCode,
        name: colorInfo.name || '',
        hex: colorInfo.hex || '#888888',
        demand: entry.demand,
        stock: entry.stock,
        shortfall,
        sufficient,
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

  // Deduct inventory and create consumption transactions
  demandSummary.forEach(entry => {
    const newStock = (inventory[entry.colorCode] || 0) - entry.demand;
    inventory[entry.colorCode] = newStock;

    const transaction = {
      id: `txn_${uuidv4().replace(/-/g, '').substring(0, 12)}`,
      type: 'consumption',
      colorCode: entry.colorCode,
      quantity: -entry.demand,
      store: '',
      date: today,
      note: '',
      createdAt: new Date().toISOString(),
    };

    // Find which pattern(s) this color was for
    const patternNames = [];
    cart.forEach(item => {
      if (item.beads) {
        const bead = item.beads.find(b => b.colorCode === entry.colorCode);
        if (bead) {
          patternNames.push(`${item.patternName} x${item.quantity}`);
        }
      }
    });

    if (patternNames.length > 0) {
      transaction.note = `图纸耗用: ${patternNames.join(', ')}`;
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
  getDemandSummary,
  submitCart,
};