'use client'

import { hexToRgba } from './utils/Utils'

// Static palette fallback (does not rely on CSS variables to avoid SSR/ISR issues)
const P = {
  slate100: '#e2e8f0',
  slate300: '#cbd5e1',
  slate500: '#64748b',
  slate700: '#334155',
  slate800: '#1f2937',

  blue500: '#3b82f6',
  indigo500: '#6366f1',
  sky500: '#0ea5e9',
  violet500: '#8b5cf6',
  cyan500: '#06b6d4',
  teal500: '#14b8a6',
  emerald500: '#10b981',
  lime500: '#84cc16',
  amber500: '#f59e0b',
  rose500: '#f43f5e',
  fuchsia500: '#d946ef',
};

export const chartColors = {
  textColor: {
    light: P.slate500,
    dark: P.slate300,
  },
  gridColor: {
    light: hexToRgba(P.slate300, 0.5),
    dark: hexToRgba(P.slate700, 0.5),
  },
  tooltipBgColor: {
    light: '#fff',
    dark: P.slate800,
  },
  tooltipBorderColor: {
    light: P.slate300,
    dark: P.slate700,
  },
  tooltipBodyColor: {
    light: P.slate800,
    dark: P.slate300,
  },
  blue: {
    light: P.blue500,
    dark: P.blue500,
  },
  indigo: {
    light: P.indigo500,
    dark: P.indigo500,
  },
  sky: {
    light: P.sky500,
    dark: P.sky500,
  },
  violet: {
    light: P.violet500,
    dark: P.violet500,
  },
  cyan: {
    light: P.cyan500,
    dark: P.cyan500,
  },
  teal: {
    light: P.teal500,
    dark: P.teal500,
  },
  emerald: {
    light: P.emerald500,
    dark: P.emerald500,
  },
  lime: {
    light: P.lime500,
    dark: P.lime500,
  },
  amber: {
    light: P.amber500,
    dark: P.amber500,
  },
  rose: {
    light: P.rose500,
    dark: P.rose500,
  },
  fuchsia: {
    light: P.fuchsia500,
    dark: P.fuchsia500,
  },
}

export default chartColors