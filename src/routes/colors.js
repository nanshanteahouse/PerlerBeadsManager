const express = require('express');
const router = express.Router();
const colorService = require('../services/colorService');
const validator = require('../utils/validator');

// GET /api/colors - Get all colors with optional filters
router.get('/', function(req, res) {
  try {
    const filters = {};
    if (req.query.series) {
      filters.series = req.query.series;
    }
    if (req.query.q) {
      filters.query = req.query.q;
    }
    const colors = colorService.getColors(filters);
    res.json(colors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/colors/:code - Get single color detail
router.get('/:code', function(req, res) {
  try {
    const code = req.params.code;
    if (!validator.isValidColorCode(code)) {
      return res.status(400).json({ message: 'Invalid color code format' });
    }
    const color = colorService.getColorByCode(code);
    if (!color) {
      return res.status(404).json({ message: 'Color not found' });
    }
    res.json(color);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/colors/:code - Update color name fields
router.put('/:code', function(req, res) {
  try {
    const code = req.params.code;
    if (!validator.isValidColorCode(code)) {
      return res.status(400).json({ message: 'Invalid color code format' });
    }
    const { name, nameEn } = req.body;
    if (name !== undefined && !validator.isValidString(name, 100)) {
      return res.status(400).json({ message: 'Invalid name' });
    }
    if (nameEn !== undefined && !validator.isValidString(nameEn, 100)) {
      return res.status(400).json({ message: 'Invalid nameEn' });
    }
    const result = colorService.updateColorName(code, name, nameEn);
    if (!result.success) {
      return res.status(404).json({ message: result.error });
    }
    res.json(result.color);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;