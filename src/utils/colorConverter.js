const colorDiff = require('color-diff');

/**
 * Parse hex color string to {r,g,b} 0-255
 */
function hexToRgb(hex) {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return { r, g, b };
}

/**
 * Convert hex color to CIE L*a*b* via color-diff
 */
function hexToLab(hex) {
  const rgb = hexToRgb(hex);
  // color-diff uses {R, G, B} keys (uppercase) and 0-255 range
  return colorDiff.rgb_to_lab({ R: rgb.r, G: rgb.g, B: rgb.b });
}

/**
 * Convert hex to {R, G, B} in color-diff format (uppercase, 0-255)
 */
function hexToColorDiffRgb(hex) {
  const rgb = hexToRgb(hex);
  return { R: rgb.r, G: rgb.g, B: rgb.b };
}

/**
 * Convert LAB to RGB for display (approximate)
 */
function labToRgb(lab) {
  // Use color-diff's internal conversion
  // lab_to_rgb is available via require('color-diff')
  // But color-diff exports it differently; we compute manually if needed
  // For now, return the lab object — actual conversion needs full chain
  return lab;
}

/**
 * Calculate relative luminance (W3C WCAG 2.0)
 * Returns 0 (pure black) to 1 (pure white)
 */
function getLuminance(hex) {
  const clean = hex.replace('#', '');
  const vals = clean.match(/\w\w/g);
  if (!vals || vals.length < 3) return 0.5;
  const [r, g, b] = vals.map(x => {
    const c = parseInt(x, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Get best text color (black or white) for a given background hex color
 */
function getTextColor(hex) {
  return getLuminance(hex) > 0.179 ? '#000000' : '#ffffff';
}

/**
 * Convert hex to RGB array [r, g, b]
 */
function hexToRgbArray(hex) {
  const rgb = hexToRgb(hex);
  return [rgb.r, rgb.g, rgb.b];
}

module.exports = {
  hexToRgb,
  hexToLab,
  hexToColorDiffRgb,
  labToRgb,
  getLuminance,
  getTextColor,
  hexToRgbArray,
};
