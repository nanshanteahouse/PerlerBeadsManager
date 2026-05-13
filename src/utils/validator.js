/**
 * Validate color code format (e.g., "A01", "B12", "M15")
 */
function isValidColorCode(code) {
  if (typeof code !== 'string') return false;
  return /^[A-HM]\d{2}$/.test(code);
}

/**
 * Validate hex color string
 */
function isValidHex(hex) {
  if (typeof hex !== 'string') return false;
  return /^#?[0-9A-Fa-f]{6}$/.test(hex);
}

/**
 * Validate quantity is a safe integer
 */
function isValidQuantity(qty) {
  return Number.isSafeInteger(qty);
}

/**
 * Validate ISO date string (YYYY-MM-DD)
 */
function isValidDate(dateStr) {
  if (typeof dateStr !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && !isNaN(Date.parse(dateStr));
}

/**
 * Validate transaction type
 */
function isValidTransactionType(type) {
  return ['purchase', 'consumption', 'adjustment'].includes(type);
}

/**
 * Validate non-empty string within length limit
 */
function isValidString(str, maxLen = 200) {
  return typeof str === 'string' && str.trim().length > 0 && str.length <= maxLen;
}

/**
 * Validate board size object
 */
function isValidBoardSize(size) {
  if (!size || typeof size !== 'object') return false;
  return Number.isSafeInteger(size.width) && size.width > 0 && size.width <= 200
    && Number.isSafeInteger(size.height) && size.height > 0 && size.height <= 200;
}

/**
 * Validate beads array for a pattern
 */
function isValidBeadsArray(beads) {
  if (!Array.isArray(beads) || beads.length === 0) return false;
  return beads.every(b =>
    b && isValidColorCode(b.colorCode) && Number.isSafeInteger(b.quantity) && b.quantity > 0
  );
}

/**
 * Validate pagination / limit params
 */
function sanitizeLimit(val, defaultVal = 20, maxVal = 500) {
  const n = parseInt(val, 10);
  if (isNaN(n) || n < 1) return defaultVal;
  return Math.min(n, maxVal);
}

module.exports = {
  isValidColorCode,
  isValidHex,
  isValidQuantity,
  isValidDate,
  isValidTransactionType,
  isValidString,
  isValidBoardSize,
  isValidBeadsArray,
  sanitizeLimit,
};
