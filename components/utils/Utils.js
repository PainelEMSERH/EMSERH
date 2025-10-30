// Utils.js — patched to avoid const reassignment and normalize CSS vars/triplets safely

/**
 * Reads a CSS custom property from :root.
 * Falls back to a provided value when running on the server or when the var is empty.
 */
export const getCssVariable = (variable, fallback = '') => {
  try {
    if (typeof window === 'undefined' || !window.getComputedStyle) return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
};

/**
 * Convert "r g b" or "r g b / a" into a valid css rgb(...) string.
 * Also accepts "r, g, b" and returns "rgb(r, g, b)". If it doesn't match, returns null.
 */
const normalizeColorTriplet = (value) => {
  if (typeof value !== 'string') return null;
  const s = value.trim();

  // Matches: "r g b" or "r g b / a"
  let m = s.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})(?:\s*\/\s*([\d.]+%?))?$/);
  if (m) {
    const [, r, g, b, a] = m;
    if (a) return `rgba(${r}, ${g}, ${b}, ${a})`;
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Matches: "r, g, b"
  m = s.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
  if (m) {
    const [, r, g, b] = m;
    return `rgb(${r}, ${g}, ${b})`;
  }

  return null;
};

/**
 * Convert any CSS color string to an rgba(r,g,b,a) string with the desired opacity.
 * Accepts: hex (#rgb/#rrggbb), rgb/rgba, hsl/hsla, oklch, lab, lch, and CSS variables via var(--x)
 * Uses getCssVariable for var(...) and normalizes "r g b" triplets often used with Tailwind.
 */
export const adjustColorOpacity = (color, alpha = 1) => {
  if (!color) return `rgba(0, 0, 0, ${alpha})`;

  let c = color;

  // Resolve CSS variables if present (at most one var for our use case)
  const varMatch = c.match(/var\((--[a-zA-Z0-9_-]+)\)/);
  if (varMatch) {
    const raw = getCssVariable(varMatch[1], '');
    const normalized = normalizeColorTriplet(raw);
    c = normalized || raw || c; // fall back to original if nothing resolved
  }

  // Normalize plain "r g b" or "r, g, b" into rgb(...)
  const directNormalized = normalizeColorTriplet(c);
  if (directNormalized) c = directNormalized;

  // Already rgba -> just replace alpha
  const rgbaMatch = c.match(/^rgba\((\s*\d+\s*),(\s*\d+\s*),(\s*\d+\s*),(\s*[^)]+)\)$/i);
  if (rgbaMatch) {
    const [, r, g, b] = rgbaMatch;
    return `rgba(${r.trim()}, ${g.trim()}, ${b.trim()}, ${alpha})`;
  }

  // rgb -> convert to rgba
  const rgbMatch = c.match(/^rgb\((\s*\d+\s*),(\s*\d+\s*),(\s*\d+\s*)\)$/i);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `rgba(${r.trim()}, ${g.trim()}, ${b.trim()}, ${alpha})`;
  }

  // Hex -> convert to rgba
  const hexMatch = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex.split('').map(x => x + x).join('');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // For any other spec (hsl/hsla/oklch/lab/lch/...)
  // Let the browser compute it to rgb and then add our alpha
  return toRGBA(c, alpha);
};

/**
 * Convert a CSS color (hsl/hsla/oklch/lab/lch/rgb/hex/keyword) to rgba(...) with given alpha
 * using the browser's computed style. Works client-side only.
 */
export const toRGBA = (cssColor, alpha = 1) => {
  try {
    if (typeof document === 'undefined') {
      // Server-side: give up and return a safe default
      return `rgba(0, 0, 0, ${alpha})`;
    }
    const el = document.createElement('div');
    el.style.color = cssColor;
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);

    const computed = window.getComputedStyle(el).color; // -> "rgb(r, g, b)" or "rgba(r, g, b, a)"
    document.body.removeChild(el);

    // Extract numbers from rgb/rgba string
    const m = computed.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\)/i);
    if (m) {
      const r = parseInt(m[1], 10);
      const g = parseInt(m[2], 10);
      const b = parseInt(m[3], 10);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    // Fallback
    return `rgba(0, 0, 0, ${alpha})`;
  } catch {
    return `rgba(0, 0, 0, ${alpha})`;
  }
};

/**
 * Backward-compatible alias for external calls that used to expect "oklchToRGBA".
 */
export const oklchToRGBA = (oklchColor, alpha = 1) => {
  return toRGBA(oklchColor, alpha);
};
