const fs = require('fs');
const path = require('path');
const colorDiff = require('color-diff');

const CSV_PATH = path.join(__dirname, '..', 'colors.csv');
const DATA_DIR = path.join(__dirname, '..', 'data');
const COLORS_JSON = path.join(DATA_DIR, 'colors.json');
const INVENTORY_JSON = path.join(DATA_DIR, 'inventory.json');
const TRANSACTIONS_JSON = path.join(DATA_DIR, 'transactions.json');
const PATTERNS_JSON = path.join(DATA_DIR, 'patterns.json');
const CART_JSON = path.join(DATA_DIR, 'cart.json');
const STORES_JSON = path.join(DATA_DIR, 'stores.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

console.log('[init] Reading colors.csv...');
const csvRaw = fs.readFileSync(CSV_PATH, 'utf-8');
const lines = csvRaw.trim().split('\n');

const colors = [];
for (let i = 1; i < lines.length; i++) {
  const line = lines[i].trim();
  if (!line) continue;

  const [code, hex, name] = line.split(',');
  const cleanHex = hex.trim();
  const series = code.trim().charAt(0);

  const rgbObj = {
    r: parseInt(cleanHex.substring(1, 3), 16),
    g: parseInt(cleanHex.substring(3, 5), 16),
    b: parseInt(cleanHex.substring(5, 7), 16),
  };
  const lab = colorDiff.rgb_to_lab({ R: rgbObj.r, G: rgbObj.g, B: rgbObj.b });

  colors.push({
    code: code.trim(),
    hex: cleanHex,
    name: (name || '').trim(),
    nameEn: '',
    series,
    rgb: [rgbObj.r, rgbObj.g, rgbObj.b],
    lab: [lab.L, lab.a, lab.b],
  });
}

console.log(`[init] Parsed ${colors.length} colors from CSV`);
fs.writeFileSync(COLORS_JSON, JSON.stringify(colors, null, 2), 'utf-8');
console.log(`[init] Wrote ${COLORS_JSON}`);

if (fs.existsSync(INVENTORY_JSON)) {
  console.log(`[init] ${INVENTORY_JSON} already exists, skipping`);
} else {
  const inventory = {};
  for (const c of colors) {
    inventory[c.code] = 0;
  }
  fs.writeFileSync(INVENTORY_JSON, JSON.stringify(inventory, null, 2), 'utf-8');
  console.log(`[init] Wrote ${INVENTORY_JSON}`);
}

const emptyFiles = {
  [TRANSACTIONS_JSON]: [],
  [PATTERNS_JSON]: [],
  [CART_JSON]: [],
  [STORES_JSON]: [],
};

for (const [filePath, defaultData] of Object.entries(emptyFiles)) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf-8');
    console.log(`[init] Wrote ${filePath}`);
  } else {
    console.log(`[init] ${filePath} already exists, skipping`);
  }
}

console.log('[init] Initialization complete.');
