// Utility helpers used across charts and UI

export const formatValue = (value) => Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumSignificantDigits: 3,
  notation: 'compact',
}).format(value);

export const formatThousands = (value) => Intl.NumberFormat('en-US', {
  maximumSignificantDigits: 3,
  notation: 'compact',
}).format(value);

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
 * Convert any CSS color string to an rgba(r,g,b,a) string with the desired opacity.
 * Accepts: hex (#rgb/#rrggbb), rgb/rgba, hsl/hsla, oklch, lab, lch, and even CSS variables
 * resolved beforehand with getCssVariable.
 */
export const adjustColorOpacity = (color, alpha = 1) => {
  if (!color) return `rgba(0, 0, 0, ${alpha})`;

  // Already rgba -> just replace alpha
  const rgbaMatch = color.match(/^rgba\((\s*\d+\s*),(\s*\d+\s*),(\s*\d+\s*),(\s*[^)]+)\)$/i);
  if (rgbaMatch) {
    const [_, r, g, b] = rgbaMatch;
    return `rgba(${r.trim()}, ${g.trim()}, ${b.trim()}, ${alpha})`;
  }

  // rgb -> convert to rgba
  const rgbMatch = color.match(/^rgb\((\s*\d+\s*),(\s*\d+\s*),(\s*\d+\s*)\)$/i);
  if (rgbMatch) {
    const [_, r, g, b] = rgbMatch;
    return `rgba(${r.trim()}, ${g.trim()}, ${b.trim()}, ${alpha})`;
  }

  // Hex -> convert to rgba
  const hexMatch = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) {
      hex = hex.split('').map(x => x + x).join('');
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // For any other spec (hsl/hsla/oklch/lab/lch/...)
  // Let the browser compute it to rgb and then add our alpha
  return toRGBA(color, alpha);
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


// --- Patched: normalize CSS variable color triples and provide fallback ---
const __orig_getCssVariable = getCssVariable;
getCssVariable = function(name, defaultValue) {
  try {
    const v = __orig_getCssVariable ? __orig_getCssVariable(name, defaultValue) : undefined;
    if (typeof v === 'string') {
      const val = v.trim();
      // if value is like "123 45 67" convert to rgb(123,45,67)
      if (/^\d+\s+\d+\s+\d+$/.test(val)) {
        return `rgb(${val.replace(/\s+/g, ',')})`;
      }
      return val || (typeof defaultValue !== 'undefined' ? defaultValue : '#4f46e5');
    }
    return (typeof defaultValue !== 'undefined' ? defaultValue : '#4f46e5');
  } catch (e) {
    return (typeof defaultValue !== 'undefined' ? defaultValue : '#4f46e5');
  }
};
// --- End patch ---
