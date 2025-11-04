'use client';
import React from 'react';
import { useTheme } from 'next-themes';

export default function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme();
  const current = theme === 'system' ? systemTheme : theme;

  return (
    <button
      aria-label="Alternar tema"
      onClick={() => setTheme(current === 'dark' ? 'light' : 'dark')}
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-panel px-3 py-2 text-sm text-text hover:opacity-90"
    >
      <span className="hidden dark:inline" aria-hidden>🌙</span>
      <span className="inline dark:hidden" aria-hidden>☀️</span>
      <span className="opacity-80">{current === 'dark' ? 'Escuro' : 'Claro'}</span>
    </button>
  );
}
