// components/utils/Utils.js

export const getCssVariable = (variable, fallback = '') => {
  try {
    if (typeof window === 'undefined' || !window.getComputedStyle) return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    return v || fallback;
  } catch {
    return fallback;
  }
};

export const toRGBA = (cssColor, alpha = 1) => {
  try {
    if (typeof document === 'undefined') return `rgba(0, 0, 0, ${alpha})`;
    const el = document.createElement('div');
    el.style.color = cssColor;
    el.style.position = 'absolute';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    const computed = window.getComputedStyle(el).color;
    document.body.removeChild(el);
    const m = computed.match(/rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\)/i);
    if (m) {
      const r = parseInt(m[1], 10);
      const g = parseInt(m[2], 10);
      const b = parseInt(m[3], 10);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return `rgba(0, 0, 0, ${alpha})`;
  } catch {
    return `rgba(0, 0, 0, ${alpha})`;
  }
};

export const adjustColorOpacity = (color, alpha = 1) => {
  if (!color) return `rgba(0, 0, 0, ${alpha})`;

  const rgbaMatch = color.match(/^rgba\((\s*\d+\s*),(\s*\d+\s*),(\s*\d+\s*),(\s*[^)]+)\)$/i);
  if (rgbaMatch) {
    const [_, r, g, b] = rgbaMatch;
    return `rgba(${r.trim()}, ${g.trim()}, ${b.trim()}, ${alpha})`;
  }

  const rgbMatch = color.match(/^rgb\((\s*\d+\s*),(\s*\d+\s*),(\s*\d+\s*)\)$/i);
  if (rgbMatch) {
    const [_, r, g, b] = rgbMatch;
    return `rgba(${r.trim()}, ${g.trim()}, ${b.trim()}, ${alpha})`;
  }

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

  return toRGBA(color, alpha);
};

export const formatValue = (value) => {
  const n = Number(value);
  if (!isFinite(n)) return '0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const format = (v, suffix) => (v % 1 === 0 ? v.toString() : v.toFixed(1)).replace(/\.0$/, '') + suffix;
  if (abs >= 1_000_000_000) return sign + format(abs / 1_000_000_000, 'B');
  if (abs >= 1_000_000)     return sign + format(abs / 1_000_000, 'M');
  if (abs >= 1_000)         return sign + format(abs / 1_000, 'K');
  return String(n);
};

export default {
  getCssVariable,
  adjustColorOpacity,
  toRGBA,
  formatValue,
};
