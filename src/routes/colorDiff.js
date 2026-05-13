const express = require('express');
const router = express.Router();
const colorDiffService = require('../services/colorDiffService');
const { isValidHex, sanitizeLimit } = require('../utils/validator');

router.get('/', (req, res) => {
  try {
    const { hex, limit, inStockOnly } = req.query;

    if (!hex) {
      return res.status(400).json({ error: 'hex parameter is required' });
    }

    const normalizedHex = hex.startsWith('#') ? hex : `#${hex}`;
    if (!isValidHex(normalizedHex)) {
      return res.status(400).json({ error: 'Invalid hex color format' });
    }

    const limitNum = sanitizeLimit(limit, 20, 500);
    const inStockOnlyBool = inStockOnly === 'true';

    const result = colorDiffService.calculateDiff(normalizedHex, {
      limit: limitNum,
      inStockOnly: inStockOnlyBool,
    });

    res.json(result);
  } catch (error) {
    console.error('[colorDiff router]', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

module.exports = router;