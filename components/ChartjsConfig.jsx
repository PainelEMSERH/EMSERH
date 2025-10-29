'use client';
import { Chart, LineElement, BarElement, PointElement, Tooltip, Legend, CategoryScale, LinearScale, Filler } from 'chart.js';

// Register core elements
Chart.register(LineElement, BarElement, PointElement, Tooltip, Legend, CategoryScale, LinearScale, Filler);

// Normalize any color string to a format Chart.js understands
function normalizeColor(input) {
  if (input == null) return 'rgba(99,102,241,1)'; // indigo-500 fallback
  if (Array.isArray(input)) return input.map(normalizeColor);
  if (typeof input !== 'string') return input;

  const str = input.trim();

  // Safe formats already understood by Chart.js
  const safe = /^(rgba?|hsla?)\(/i.test(str) || /^#([0-9a-f]{3,8})$/i.test(str) || /^[a-z]+$/i.test(str);
  if (safe) return str;

  // Resolve CSS variables, e.g., var(--color-gray-500)
  if (str.startsWith('var(')) {
    const m = str.match(/^var\((--[^,\s)]+)\)/);
    if (m) {
      try {
        const v = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim();
        if (v) return normalizeColor(v);
      } catch (e) {}
    }
  }

  // Let the browser try to normalize unknown formats (covers many cases)
  try {
    const el = document.createElement('div');
    el.style.color = '';
    el.style.color = str;
    const out = el.style.color;
    if (out) return out;
  } catch (e) {}

  // Last resort fallback (prevents "Unsupported color format" crashes)
  return 'rgba(99,102,241,1)';
}

// Plugin to sanitize all dataset colors before Chart.js touches them
const SanitizeColors = {
  id: 'sanitizeColors',
  beforeUpdate(chart) {
    const datasets = chart?.config?.data?.datasets || [];
    for (const d of datasets) {
      if (!d) continue;
      d.borderColor = normalizeColor(d.borderColor);
      d.backgroundColor = normalizeColor(d.backgroundColor);
      d.pointBackgroundColor = normalizeColor(d.pointBackgroundColor);
      d.pointBorderColor = normalizeColor(d.pointBorderColor);
      d.pointHoverBackgroundColor = normalizeColor(d.pointHoverBackgroundColor);
      d.pointHoverBorderColor = normalizeColor(d.pointHoverBorderColor);
    }
  }
};

Chart.register(SanitizeColors);

// Safe defaults
Chart.defaults.color = 'rgba(31,41,55,0.8)'; // gray-800
Chart.defaults.borderColor = 'rgba(229,231,235,1)'; // gray-200

Chart.defaults.plugins.legend.labels.color = 'rgba(31,41,55,0.8)';
Chart.defaults.plugins.tooltip.bodyColor = 'rgba(31,41,55,1)';
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(255,255,255,0.95)';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(229,231,235,1)';
Chart.defaults.plugins.tooltip.titleColor = 'rgba(31,41,55,0.8)';
Chart.defaults.plugins.tooltip.titleFont = { weight: '600' };

export default Chart;
