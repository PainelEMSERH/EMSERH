'use client';

import {
  Chart,
  LineElement,
  BarElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Tooltip,
  Filler,
  ArcElement,
  Legend,
} from 'chart.js';

Chart.register(LineElement, BarElement, PointElement, LinearScale, CategoryScale, Tooltip, Filler, ArcElement, Legend);

// ---------- Helpers to normalize/resolve colors ----------
function normalizeColor(color) {
  try {
    if (!color) return 'rgba(99,102,241,1)'; // fallback (indigo-500)
    // Resolve CSS variables like var(--color-*)
    const varMatch = typeof color === 'string' && color.trim().match(/^var\((--[^)]+)\)$/);
    if (varMatch) {
      const resolved = getComputedStyle(document.documentElement).getPropertyValue(varMatch[1]).trim();
      if (resolved) color = resolved;
    }

    // Use a DOM element to normalize to rgb()/rgba() when supported
    const el = document.createElement('div');
    el.style.color = '';
    el.style.color = String(color);
    const fromEl = el.style.color;
    if (fromEl) return fromEl;

    // Try canvas parser as a fallback
    const ctx = document.createElement('canvas').getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000';
      ctx.fillStyle = String(color);
      const fromCtx = ctx.fillStyle;
      if (fromCtx) return fromCtx;
    }
  } catch (e) {}
  return 'rgba(99,102,241,1)';
}

function normalizeAny(v) {
  if (Array.isArray(v)) return v.map(normalizeAny);
  if (typeof v === 'string') return normalizeColor(v);
  return v;
}

// Plugin that sanitizes dataset colors before Chart.js parses them
const sanitizeColors = {
  id: 'sanitizeColors',
  beforeUpdate(chart) {
    const datasets = chart?.config?.data?.datasets || [];
    for (const ds of datasets) {
      if (!ds || typeof ds !== 'object') continue;
      ds.backgroundColor = normalizeAny(ds.backgroundColor);
      ds.borderColor = normalizeAny(ds.borderColor);
      ds.pointBackgroundColor = normalizeAny(ds.pointBackgroundColor);
      ds.pointBorderColor = normalizeAny(ds.pointBorderColor);
      ds.pointHoverBackgroundColor = normalizeAny(ds.pointHoverBackgroundColor);
      ds.pointHoverBorderColor = normalizeAny(ds.pointHoverBorderColor);
    }
  },
};

Chart.register(sanitizeColors);

// Safe, explicit defaults (avoid CSS variables/oklch)
Chart.defaults.color = 'rgb(31,41,55)'; // gray-800
Chart.defaults.borderColor = 'rgba(0,0,0,0.1)';
Chart.defaults.plugins.legend.labels.color = 'rgb(55,65,81)'; // gray-700
Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(17,24,39,0.92)'; // gray-900 w/ alpha
Chart.defaults.plugins.tooltip.titleColor = 'rgb(255,255,255)';
Chart.defaults.plugins.tooltip.bodyColor = 'rgb(255,255,255)';

export default function ChartjsConfig() {
  // This module configures Chart.js globally; nothing to render.
  return null;
}
