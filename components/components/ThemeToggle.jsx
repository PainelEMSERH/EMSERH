'use client'
import React from "react";
import { useThemeProvider } from "../utils/ThemeContext";
import { Sun, Moon, Monitor } from '@geist-ui/icons';

export default function ThemeToggle() {
  const { currentTheme, changeCurrentTheme } = useThemeProvider();
  const active = (v) => currentTheme === v ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'text-gray-500 dark:text-gray-400';

  return (
    <div className="inline-flex rounded-2xl border border-gray-200 dark:border-gray-700/60 overflow-hidden">
      <button
        className={`p-2.5 ${active('system')}`}
        title="Usar tema do sistema"
        onClick={() => changeCurrentTheme('system')}
      >
        <Monitor size={16} />
      </button>
      <button
        className={`p-2.5 ${active('light')}`}
        title="Tema claro"
        onClick={() => changeCurrentTheme('light')}
      >
        <Sun size={16} />
      </button>
      <button
        className={`p-2.5 ${active('dark')}`}
        title="Tema escuro"
        onClick={() => changeCurrentTheme('dark')}
      >
        <Moon size={16} />
      </button>
    </div>
  );
}
