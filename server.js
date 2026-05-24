const express = require('express');
const path = require('path');
const fs = require('fs');

const { ensureDataDir, readJSON, writeJSON, fileExists } = require('./src/utils/dataStore');
const { errorHandler } = require('./src/middleware/errorHandler');

const app = express();

const LISTEN = process.env.LISTEN || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '3000', 10);

// ── Middleware ──────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ── View engine ────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Wrap page renders with layout, inject real cart count
const _render = app.response.render;
app.response.render = function (view, options, callback) {
  const res = this;
  if (view === 'layout' || view === 'error' || (options && options._raw)) {
    return _render.call(res, view, options, callback);
  }
  // Provide actual cart item count from the data file
  var cartData = readJSON('cart.json') || [];
  var opts = Object.assign({}, options, { cartCount: cartData.length });
  _render.call(res, view, opts, function (err, html) {
    if (err) return callback ? callback(err) : undefined;
    _render.call(res, 'layout', Object.assign({}, opts, { body: html }), callback);
  });
};

// ── Initialization ─────────────────────────────────────
function initializeData() {
  ensureDataDir();

  if (!fileExists('colors.json')) {
    console.log('[init] colors.json not found, running init-colors.js...');
    require('./scripts/init-colors');
  }

  if (!fileExists('inventory.json')) {
    console.log('[init] Creating empty inventory.json...');
    const colors = readJSON('colors.json') || [];
    const inventory = {};
    for (const c of colors) {
      inventory[c.code] = 0;
    }
    writeJSON('inventory.json', inventory);
  }

  if (!fileExists('transactions.json')) {
    writeJSON('transactions.json', []);
  }
  if (!fileExists('patterns.json')) {
    writeJSON('patterns.json', []);
  }
  if (!fileExists('cart.json')) {
    writeJSON('cart.json', []);
  }
  if (!fileExists('stores.json')) {
    writeJSON('stores.json', []);
  }
}

initializeData();

// ── Routes ────────────────────────────────────────────
const colorsRouter = require('./src/routes/colors');
const inventoryRouter = require('./src/routes/inventory');
const transactionsRouter = require('./src/routes/transactions');
const patternsRouter = require('./src/routes/patterns');
const cartRouter = require('./src/routes/cart');
const colorDiffRouter = require('./src/routes/colorDiff');

app.use('/api/colors', colorsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/patterns', patternsRouter);
app.use('/api/cart', cartRouter);
app.use('/api/color-diff', colorDiffRouter);

// ── Page routes ───────────────────────────────────────
app.get('/', (req, res) => {
  const colors = readJSON('colors.json') || [];
  const inventory = readJSON('inventory.json') || {};
  const patterns = readJSON('patterns.json') || [];
  const cart = readJSON('cart.json') || [];

  const lowStockThreshold = 50;
  const totalBeads = Object.values(inventory).reduce((sum, v) => sum + (v > 0 ? v : 0), 0);
  const lowStockCount = Object.entries(inventory).filter(([, qty]) => qty <= lowStockThreshold && qty >= 0).length;
  const outOfStockCount = Object.entries(inventory).filter(([, qty]) => qty <= 0).length;

  const lowStockItems = Object.entries(inventory)
    .filter(([, qty]) => qty <= lowStockThreshold)
    .map(([code, qty]) => {
      const color = colors.find(c => c.code === code);
      return { code, name: color ? color.name : '', hex: color ? color.hex : '#ccc', stock: qty };
    })
    .sort((a, b) => a.stock - b.stock)
    .slice(0, 10);

  const recentPatterns = [...patterns]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);

  recentPatterns.forEach(p => {
    let sufficient = true;
    const insufficient = [];
    (p.beads || []).forEach(b => {
      const stock = inventory[b.colorCode] || 0;
      const shortfall = b.quantity - stock;
      if (shortfall > 0) {
        sufficient = false;
        insufficient.push({ code: b.colorCode, shortfall });
      }
    });
    p._stock = { sufficient, insufficient };
  });

  res.render('index', {
    title: '仪表盘',
    currentPage: 'home',
    stats: {
      totalColors: colors.length,
      totalBeads,
      lowStockCount,
      outOfStockCount,
      totalPatterns: patterns.length,
    },
    lowStockItems,
    recentPatterns,
    cartCount: cart.length,
  });
});

app.get('/colors', (req, res) => {
  res.render('colors', { title: '色号管理', currentPage: 'colors', cartCount: 0 });
});

app.get('/inventory', (req, res) => {
  res.render('inventory', { title: '库存管理', currentPage: 'inventory', cartCount: 0 });
});

app.get('/patterns', (req, res) => {
  res.render('patterns', { title: '图纸管理', currentPage: 'patterns', cartCount: 0 });
});

app.get('/patterns/new', (req, res) => {
  res.render('pattern-editor', { title: '创建图纸', currentPage: 'patterns', cartCount: 0, pattern: null });
});

app.get('/patterns/:id/edit', (req, res) => {
  const patterns = readJSON('patterns.json') || [];
  const pattern = patterns.find(p => p.id === req.params.id);
  if (!pattern) return res.status(404).render('error', { title: '未找到', message: '图纸不存在', status: 404, path: req.path });
  res.render('pattern-editor', { title: '编辑图纸', currentPage: 'patterns', cartCount: 0, pattern });
});

app.get('/cart', (req, res) => {
  res.render('cart', { title: '购物车', currentPage: 'cart', cartCount: 0 });
});

app.get('/color-diff', (req, res) => {
  res.render('color-diff', { title: '色差计算器', currentPage: 'color-diff', cartCount: 0, preselectedHex: req.query.hex || '' });
});

// ── Error handler ─────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────
app.listen(PORT, LISTEN, () => {
  console.log(`拼豆管理器已启动: http://${LISTEN}:${PORT}`);
});

module.exports = app;
