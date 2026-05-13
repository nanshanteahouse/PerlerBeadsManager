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

module.exports = router;