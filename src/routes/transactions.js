const express = require('express');
const router = express.Router();
const transactionService = require('../services/transactionService');

router.get('/', (req, res) => {
  try {
    const { code, type, from, to } = req.query;
    const transactions = transactionService.getTransactions({ code, type, from, to });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { type, colorCode, quantity, store, date, note } = req.body;
    const transaction = transactionService.createTransaction({ type, colorCode, quantity, store, date, note });
    res.status(201).json(transaction);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { type, colorCode, quantity, store, date, note } = req.body;
    const updated = transactionService.updateTransaction(id, { type, colorCode, quantity, store, date, note });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const deleted = transactionService.deleteTransaction(id);
    res.json(deleted);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/batch', (req, res) => {
  try {
    const { purchases, sharedStore, sharedDate } = req.body;

    if (!Array.isArray(purchases)) {
      return res.status(400).json({ message: 'purchases 必须是数组' });
    }
    if (purchases.length === 0) {
      return res.status(400).json({ message: 'purchases 不能为空' });
    }
    if (purchases.length > 50) {
      return res.status(400).json({ message: '单次最多添加 50 条记录' });
    }

    const result = transactionService.createBatchTransactions({ purchases, sharedStore, sharedDate });

    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;