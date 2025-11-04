'use client';
import * as React from 'react';
import { useTheme } from 'next-themes';
import { Monitor, Sun, Moon } from 'lucide-react';

type Mode = 'system' | 'light' | 'dark';

export default function ThemeSwitcherGeist(){
  const { theme, systemTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(()=> setMounted(true), []);

  const current: Mode = (theme === 'system' ? (systemTheme as Mode) : (theme as Mode)) || 'system';

  const Btn = ({mode, children}:{mode:Mode, children:React.ReactNode}) => {
    const active = (theme as Mode) === mode || (mode==='system' && theme==='system');
    return (
      <button
        type="button"
        aria-label={mode}
        onClick={()=> setTheme(mode)}
        className={
          'inline-flex items-center justify-center gap-2 h-9 w-10 rounded-md border ' +
          (active ? 'bg-card border-border shadow-inner' : 'bg-panel border-border hover:opacity-90')
        }
        title={mode[0].toUpperCase()+mode.slice(1)}
      >
        {children}
      </button>
    )
  };

  if(!mounted) return (
    <div className="inline-flex items-center gap-1 bg-panel/80 p-1 rounded-lg border border-border">
      <div className="h-9 w-10 rounded-md bg-card" />
      <div className="h-9 w-10 rounded-md" />
      <div className="h-9 w-10 rounded-md" />
    </div>
  );

  return (
    <div className="inline-flex items-center gap-1 bg-panel/80 p-1 rounded-lg border border-border">
      <Btn mode="system"><Monitor className="h-4 w-4" /></Btn>
      <Btn mode="light"><Sun className="h-4 w-4" /></Btn>
      <Btn mode="dark"><Moon className="h-4 w-4" /></Btn>
    </div>
  );
}
