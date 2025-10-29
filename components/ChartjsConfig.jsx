'use client';
import Chart from 'chart.js/auto';

/**
 * Drop-in replacement to prevent "Unsupported color format" from Chart.js
 * by normalizing CSS variables / OKLCH / other formats into standard rgba()/hex.
 * No app logic changed; only Chart.js defaults/colors.
 */

function normalizeColor(input) {
  try {
    if (!input) return 'rgba(0,0,0,0.1)';
    let c = String(input).trim();

    // Resolve CSS var(--x) if present
    if (c.startsWith('var(')) {
      const m = c.match(/var\((--[^,\s)]+)/);
      if (m && typeof window !== 'undefined') {
        const v = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim();
        if (v) return normalizeColor(v);
      }
    }

    // Accept hex directly
    if (/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(c)) return c;

    // If it's already rgb/rgba/hsl/hsla, keep it
    if (/^(rgb|hsl)a?\(/i.test(c)) return c;

    // Let the browser parse any other CSS color (e.g., oklch/oklab/tokens)
    if (typeof window !== 'undefined') {
      const el = document.createElement('span');
      el.style.color = c;
      document.body.appendChild(el);
      const parsed = getComputedStyle(el).color; // standardized 'rgb(a,b,c)' string if valid
      document.body.removeChild(el);
      if (parsed && parsed.startsWith('rgb')) return parsed;
    }
  } catch (_) {}
  return 'rgba(0,0,0,0.2)'; // safe fallback
}

export default function ChartjsConfig() {
  if (typeof window === 'undefined') return null;

  const root = getComputedStyle(document.documentElement);

  const textColor         = normalizeColor(root.getPropertyValue('--color-gray-700') || '#334155');
  const gridColor         = normalizeColor(root.getPropertyValue('--color-gray-200') || '#e5e7eb');
  const tooltipBg         = normalizeColor(root.getPropertyValue('--color-gray-900') || '#0f172a');
  const tooltipTitleColor = normalizeColor(root.getPropertyValue('--color-gray-100') || '#f3f4f6');
  const tooltipBodyColor  = normalizeColor(root.getPropertyValue('--color-gray-100') || '#f3f4f6');

  // Sensible Chart.js defaults
  Chart.defaults.color = textColor;
  Chart.defaults.font.family = 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial';
  Chart.defaults.font.weight = 500;

  Chart.defaults.borderColor = gridColor;

  // Grid lines
  if (Chart.defaults.scale && Chart.defaults.scale.grid) {
    Chart.defaults.scale.grid.color = gridColor;
    Chart.defaults.scale.ticks.color = textColor;
  }

  // Tooltip defaults
  if (Chart.defaults.plugins && Chart.defaults.plugins.tooltip) {
    Chart.defaults.plugins.tooltip.backgroundColor = tooltipBg;
    Chart.defaults.plugins.tooltip.titleColor = tooltipTitleColor;
    Chart.defaults.plugins.tooltip.bodyColor = tooltipBodyColor;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;
    Chart.defaults.plugins.tooltip.borderWidth = 1;
  }

  return null;
}
