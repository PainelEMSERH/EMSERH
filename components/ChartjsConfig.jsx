// components/ChartjsConfig.jsx
// Patch: normaliza cores (CSS var/oklch/etc) para rgb/rgba aceitas pelo Chart.js
// e registra um plugin que converte cores dos datasets antes de renderizar.
// Substitua este arquivo pelo existente no mesmo caminho.

"use client";

import {
  Chart,
  Tooltip,
  Legend,
  Filler,
  LineElement,
  BarElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  TimeScale,
} from "chart.js";

// Registros básicos
Chart.register(
  Tooltip,
  Legend,
  Filler,
  LineElement,
  BarElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  TimeScale
);

// ---- Util: normalização de cores ----
function resolveCssVar(val) {
  try {
    const m = typeof val === "string" && val.trim().match(/^var\((--[^)]+)\)/);
    if (m) {
      const name = m[1];
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      if (v) return v;
    }
  } catch {}
  return val;
}

function toBrowserRgb(val) {
  // Converte qualquer cor suportada pelo navegador para 'rgb(...)' ou 'rgba(...)'
  try {
    const el = document.createElement("span");
    el.style.color = "";
    let candidate = resolveCssVar(val);
    // alguns temas usam valores vazios; evita crash
    if (!candidate || (typeof candidate === "string" && !candidate.trim())) return val;
    el.style.color = candidate;
    document.body.appendChild(el);
    const out = getComputedStyle(el).color;
    el.remove();
    // se o browser não entender, devolve original
    if (out && typeof out === "string" && out.trim()) return out;
  } catch {}
  return val;
}

function normalizeColor(c) {
  if (Array.isArray(c)) return c.map(normalizeColor);
  if (c && typeof c === "object") {
    // Gradientes/objetos: tenta normalizar subpropriedades conhecida(s)
    const copy = { ...c };
    for (const k of Object.keys(copy)) {
      copy[k] = normalizeColor(copy[k]);
    }
    return copy;
  }
  if (typeof c === "string") return toBrowserRgb(c);
  return c;
}

// Plugin: varre datasets e normaliza cores antes de atualizar
const ColorNormalizerPlugin = {
  id: "color-normalizer",
  beforeUpdate(chart) {
    const colorKeys = [
      "borderColor",
      "backgroundColor",
      "pointBackgroundColor",
      "pointBorderColor",
      "pointHoverBackgroundColor",
      "pointHoverBorderColor",
      "segment",
    ];

    const datasets = chart?.config?.data?.datasets || [];
    datasets.forEach((ds) => {
      colorKeys.forEach((key) => {
        if (key in ds) {
          if (key === "segment" && ds.segment && typeof ds.segment === "object") {
            // Segment options podem conter cores dentro de 'borderColor'/'backgroundColor'
            const seg = ds.segment;
            for (const segKey of Object.keys(seg)) {
              const segVal = seg[segKey];
              if (segVal && typeof segVal === "object") {
                if ("borderColor" in segVal) segVal.borderColor = normalizeColor(segVal.borderColor);
                if ("backgroundColor" in segVal) segVal.backgroundColor = normalizeColor(segVal.backgroundColor);
              }
            }
          } else {
            ds[key] = normalizeColor(ds[key]);
          }
        }
      });
    });

    // Também normaliza cores gerais do gráfico quando presentes
    const opts = chart?.options || {};
    if (opts.scales) {
      for (const sid of Object.keys(opts.scales)) {
        const s = opts.scales[sid];
        if (s.grid && "color" in s.grid) s.grid.color = normalizeColor(s.grid.color);
        if (s.border && "color" in s.border) s.border.color = normalizeColor(s.border.color);
        if (s.ticks && "color" in s.ticks) s.ticks.color = normalizeColor(s.ticks.color);
        if (s.title && "color" in s.title) s.title.color = normalizeColor(s.title.color);
      }
    }
    if (opts.plugins) {
      const p = opts.plugins;
      if (p.legend && p.legend.labels && "color" in p.legend.labels) {
        p.legend.labels.color = normalizeColor(p.legend.labels.color);
      }
      if (p.tooltip) {
        if ("backgroundColor" in p.tooltip) p.tooltip.backgroundColor = normalizeColor(p.tooltip.backgroundColor);
        if ("titleColor" in p.tooltip) p.tooltip.titleColor = normalizeColor(p.tooltip.titleColor);
        if ("bodyColor" in p.tooltip) p.tooltip.bodyColor = normalizeColor(p.tooltip.bodyColor);
        if ("borderColor" in p.tooltip) p.tooltip.borderColor = normalizeColor(p.tooltip.borderColor);
      }
    }
  },
};

Chart.register(ColorNormalizerPlugin);

// Defaults seguros (com fallback a partir de CSS vars)
function safe(varStr, fallback) {
  const v = toBrowserRgb(varStr);
  return (typeof v === "string" && v.trim()) ? v : fallback;
  }

const palette = {
  text: safe("var(--color-gray-400)", "rgba(148, 163, 184, 1)"),
  grid: safe("var(--color-gray-700)", "rgba(51, 65, 85, 0.2)"),
  backdrop: safe("var(--color-white)", "rgba(255, 255, 255, 0.8)"),
  tooltipTitle: safe("var(--color-gray-800)", "rgba(30, 41, 59, 1)"),
  tooltipBody: safe("var(--color-gray-700)", "rgba(51, 65, 85, 1)"),
  tooltipBorder: safe("var(--color-gray-200)", "rgba(229, 231, 235, 1)"),
  tooltipBg: safe("var(--color-white)", "rgba(255, 255, 255, 1)"),
};

// Aplica nos defaults globais
Chart.defaults.color = palette.text;
Chart.defaults.borderColor = palette.grid;
Chart.defaults.elements.line.borderColor = palette.grid;
Chart.defaults.elements.bar.borderColor = palette.grid;
Chart.defaults.elements.point.borderColor = palette.grid;
Chart.defaults.plugins.legend.labels.color = palette.text;

Chart.defaults.plugins.tooltip.enabled = true;
Chart.defaults.plugins.tooltip.intersect = false;
Chart.defaults.plugins.tooltip.mode = "nearest";
Chart.defaults.plugins.tooltip.displayColors = true;
Chart.defaults.plugins.tooltip.borderWidth = 1;
Chart.defaults.plugins.tooltip.backgroundColor = palette.tooltipBg;
Chart.defaults.plugins.tooltip.titleColor = palette.tooltipTitle;
Chart.defaults.plugins.tooltip.bodyColor = palette.tooltipBody;
Chart.defaults.plugins.tooltip.borderColor = palette.tooltipBorder;

// Padding padrão mais suave
Chart.defaults.layout = Chart.defaults.layout || {};
Chart.defaults.layout.padding = 8;

export default Chart;
