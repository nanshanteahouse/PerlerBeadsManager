const express = require('express');
const router = express.Router();
const cartService = require('../services/cartService');

router.get('/', (req, res) => {
  try {
    const cart = cartService.getCart();
    const demandSummary = cartService.getDemandSummary();
    res.json({ cart, demandSummary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { patternId, patternName, quantity } = req.body;
    const item = cartService.addToCart(patternId, patternName, quantity);
    const demandSummary = cartService.getDemandSummary();
    res.json({ item, demandSummary });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { quantity } = req.body;
    const item = cartService.updateCartItem(id, quantity);
    const demandSummary = cartService.getDemandSummary();
    res.json({ item, demandSummary });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const removed = cartService.removeCartItem(id);
    const demandSummary = cartService.getDemandSummary();
    res.json({ removed, demandSummary });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/manual-adjustment', (req, res) => {
  try {
    const { beads, note } = req.body;
    const item = cartService.addManualAdjustment(beads, note);
    const demandSummary = cartService.getDemandSummary();
    res.json({ item, demandSummary });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.post('/submit', (req, res) => {
  try {
    const result = cartService.submitCart();
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.delete('/', (req, res) => {
  try {
    cartService.clearCart();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;