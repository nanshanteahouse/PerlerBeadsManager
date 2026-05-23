const express = require('express');
const router = express.Router();
const inventoryService = require('../services/inventoryService');
const { sanitizeLimit } = require('../utils/validator');

router.get('/', (req, res) => {
  try {
    const { series, sort, lowStock } = req.query;
    const inventory = inventoryService.getInventory({ series, sort, lowStock });
    res.json(inventory);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/stats', (req, res) => {
  try {
    const stats = inventoryService.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/stores', (req, res) => {
  try {
    const stores = inventoryService.getStores();
    res.json(stores);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/stores', (req, res) => {
  try {
    const { stores } = req.body;
    const updated = inventoryService.updateStores(stores);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/mix-transfer', (req, res) => {
  try {
    const { from, quantity } = req.body;
    const result = inventoryService.transferToMixed(from, quantity);
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:code', (req, res) => {
  try {
    const { code } = req.params;
    const item = inventoryService.getInventoryByCode(code);
    if (!item) {
      return res.status(404).json({ message: '色号不存在' });
    }
    res.json(item);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:code', (req, res) => {
  try {
    const { code } = req.params;
    const { quantity, reason, store, delta } = req.body;

    if (delta === true || delta === 'true') {
      const result = inventoryService.updateInventory(code, quantity, reason || '快速调整', store, true);
      return res.json(result);
    } else {
      const result = inventoryService.updateInventory(code, quantity, reason || '设置库存', store, false);
      return res.json(result);
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
