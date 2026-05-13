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
  updateTransaction,
  deleteTransaction,
};