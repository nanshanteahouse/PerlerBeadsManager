const { v4: uuidv4 } = require('uuid');
const { readJSON, writeJSON } = require('../utils/dataStore');
const { isValidColorCode, isValidQuantity, isValidDate, isValidTransactionType, isValidString } = require('../utils/validator');

const INVENTORY_FILE = 'inventory.json';
const TRANSACTIONS_FILE = 'transactions.json';

function getTransactions(filters = {}) {
  const { code, type, from, to } = filters;

  let transactions = readJSON(TRANSACTIONS_FILE) || [];

  if (code) {
    transactions = transactions.filter((t) => t.colorCode === code);
  }

  if (type) {
    transactions = transactions.filter((t) => t.type === type);
  }

  if (from) {
    const fromDate = new Date(from);
    transactions = transactions.filter((t) => new Date(t.date) >= fromDate);
  }

  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    transactions = transactions.filter((t) => new Date(t.date) <= toDate);
  }

  transactions.sort((a, b) => new Date(b.date) - new Date(a.date));

  return transactions;
}

function createTransaction(data) {
  const { type, colorCode, quantity, store, date, note } = data;

  if (!isValidTransactionType(type)) {
    throw new Error('无效的流水类型');
  }

  if (!isValidColorCode(colorCode)) {
    throw new Error('无效的色号');
  }

  if (!isValidQuantity(quantity)) {
    throw new Error('无效的数量');
  }

  if (date && !isValidDate(date)) {
    throw new Error('无效的日期格式');
  }

  if (type === 'purchase' && !isValidString(store)) {
    throw new Error('购买记录需要填写店家');
  }

  const inventory = readJSON(INVENTORY_FILE) || {};
  const transactions = readJSON(TRANSACTIONS_FILE) || [];

  const currentQty = inventory[colorCode] || 0;
  const newQty = currentQty + quantity;

  inventory[colorCode] = newQty;

  const transaction = {
    id: uuidv4(),
    type,
    colorCode,
    quantity,
    store: store || null,
    date: date || new Date().toISOString().split('T')[0],
    note: note || '',
    createdAt: new Date().toISOString(),
  };

  transactions.unshift(transaction);

  writeJSON(INVENTORY_FILE, inventory);
  writeJSON(TRANSACTIONS_FILE, transactions);

  return transaction;
}

function createBatchTransactions(data) {
  const { purchases, sharedStore, sharedDate } = data;
  const errors = [];
  const today = new Date().toISOString().split('T')[0];

  purchases.forEach((item, index) => {
    if (!item.colorCode && !item.quantity && !item.store) {
      return;
    }

    const finalStore = (item.store || sharedStore || '').trim();
    const finalDate = item.date || sharedDate || today;

    if (!item.colorCode) {
      errors.push({ index, field: 'colorCode', value: item.colorCode, reason: '色号不可为空' });
    } else if (!isValidColorCode(item.colorCode)) {
      errors.push({ index, field: 'colorCode', value: item.colorCode, reason: '无效的色号格式' });
    }

    if (item.quantity === undefined || item.quantity === null || item.quantity === '') {
      errors.push({ index, field: 'quantity', value: item.quantity, reason: '数量不可为空' });
    } else if (!isValidQuantity(item.quantity) || item.quantity <= 0) {
      errors.push({ index, field: 'quantity', value: item.quantity, reason: '数量必须为正整数' });
    }

    if (!finalStore) {
      errors.push({ index, field: 'store', value: item.store, reason: '店家不可为空' });
    } else if (!isValidString(finalStore)) {
      errors.push({ index, field: 'store', value: item.store, reason: '店家名称无效' });
    }

    if (finalDate && !isValidDate(finalDate)) {
      errors.push({ index, field: 'date', value: finalDate, reason: '日期格式无效（应为 YYYY-MM-DD）' });
    }
  });

  const validItems = purchases.filter(item => item.colorCode && item.quantity > 0);
  if (validItems.length === 0 && errors.length > 0) {
    return { success: false, message: '所有条目校验失败', errors };
  }

  if (errors.length > 0) {
    return { success: false, message: '部分条目校验失败', errors };
  }

  const inventory = readJSON(INVENTORY_FILE) || {};
  const transactions = readJSON(TRANSACTIONS_FILE) || [];
  const newTransactions = [];

  purchases.forEach((item) => {
    if (!item.colorCode || !item.quantity) return;

    const finalStore = (item.store || sharedStore || '').trim();
    const finalDate = item.date || sharedDate || today;

    inventory[item.colorCode] = (inventory[item.colorCode] || 0) + item.quantity;

    newTransactions.push({
      id: `txn_${uuidv4().replace(/-/g, '').substring(0, 12)}`,
      type: 'purchase',
      colorCode: item.colorCode,
      quantity: item.quantity,
      store: finalStore,
      date: finalDate,
      note: item.note || '',
      createdAt: new Date().toISOString(),
    });
  });

  transactions.unshift(...newTransactions);
  writeJSON(INVENTORY_FILE, inventory);
  writeJSON(TRANSACTIONS_FILE, transactions);

  return {
    success: true,
    created: newTransactions.length,
    totalQuantity: newTransactions.reduce((sum, t) => sum + t.quantity, 0),
    transactions: newTransactions,
  };
}

function updateTransaction(id, data) {
  const { type, colorCode, quantity, store, date, note } = data;

  const transactions = readJSON(TRANSACTIONS_FILE) || [];
  const inventory = readJSON(INVENTORY_FILE) || {};

  const txIndex = transactions.findIndex((t) => t.id === id);
  if (txIndex === -1) {
    throw new Error('流水记录不存在');
  }

  const oldTx = transactions[txIndex];

  if (type && !isValidTransactionType(type)) {
    throw new Error('无效的流水类型');
  }

  if (colorCode && !isValidColorCode(colorCode)) {
    throw new Error('无效的色号');
  }

  if (quantity !== undefined && !isValidQuantity(quantity)) {
    throw new Error('无效的数量');
  }

  if (date && !isValidDate(date)) {
    throw new Error('无效的日期格式');
  }

  const delta = quantity - oldTx.quantity;
  if (delta !== 0) {
    inventory[oldTx.colorCode] = (inventory[oldTx.colorCode] || 0) + delta;
  }

  const updatedTx = {
    ...oldTx,
    type: type || oldTx.type,
    colorCode: colorCode || oldTx.colorCode,
    quantity: quantity !== undefined ? quantity : oldTx.quantity,
    store: store !== undefined ? store : oldTx.store,
    date: date || oldTx.date,
    note: note !== undefined ? note : oldTx.note,
  };

  transactions[txIndex] = updatedTx;

  writeJSON(INVENTORY_FILE, inventory);
  writeJSON(TRANSACTIONS_FILE, transactions);

  return updatedTx;
}

function deleteTransaction(id) {
  const transactions = readJSON(TRANSACTIONS_FILE) || [];
  const inventory = readJSON(INVENTORY_FILE) || {};

  const txIndex = transactions.findIndex((t) => t.id === id);
  if (txIndex === -1) {
    throw new Error('流水记录不存在');
  }

  const deletedTx = transactions[txIndex];

  inventory[deletedTx.colorCode] = (inventory[deletedTx.colorCode] || 0) - deletedTx.quantity;

  transactions.splice(txIndex, 1);

  writeJSON(INVENTORY_FILE, inventory);
  writeJSON(TRANSACTIONS_FILE, transactions);

  return deletedTx;
}

module.exports = {
  getTransactions,
  createTransaction,
  createBatchTransactions,
  updateTransaction,
  deleteTransaction,
};