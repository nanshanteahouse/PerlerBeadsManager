const express = require('express');
const patternService = require('../services/patternService');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const patterns = patternService.getPatterns();
    res.json(patterns);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', (req, res) => {
  try {
    const pattern = patternService.createPattern(req.body);
    res.status(201).json(pattern);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const pattern = patternService.getPatternById(req.params.id);
    if (!pattern) {
      return res.status(404).json({ message: '图纸不存在' });
    }
    res.json(pattern);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const updated = patternService.updatePattern(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    if (err.message === '图纸不存在') {
      return res.status(404).json({ message: err.message });
    }
    res.status(400).json({ message: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    patternService.deletePattern(req.params.id);
    res.json({ success: true });
  } catch (err) {
    if (err.message === '图纸不存在') {
      return res.status(404).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/check', (req, res) => {
  try {
    const result = patternService.checkStock(req.params.id);
    res.json(result);
  } catch (err) {
    if (err.message === '图纸不存在') {
      return res.status(404).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/export', (req, res) => {
  try {
    const pattern = patternService.getPatternById(req.params.id);
    if (!pattern) {
      return res.status(404).json({ message: '图纸不存在' });
    }
    const filename = `pattern_${pattern.id}_${Date.now()}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(pattern, null, 2));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/import', (req, res) => {
  try {
    const pattern = patternService.importPattern(req.body);
    res.status(201).json(pattern);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

module.exports = router;