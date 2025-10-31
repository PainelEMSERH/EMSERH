'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React from 'react';

const nav = [
  { href: '/', label: 'Dashboard' },
  { href: '/colaboradores', label: 'Colaboradores' },
  { href: '/entregas', label: 'Entregas' },
  { href: '/pendencias', label: 'Pendências' },
  { href: '/estoque', label: 'Estoque' },
  { href: '/kits', label: 'Kits' },
  { href: '/relatorios', label: 'Relatórios' },
  { href: '/admin', label: 'Admin' },
  { href: '/configuracoes', label: 'Configurações' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-[#0b1220] text-slate-100">
      <div className="flex min-h-screen">
        {/* Sidebar */}
        <aside className="w-64 bg-[#0d1526] border-r border-slate-800 hidden md:flex flex-col">
          <div className="px-5 py-5 text-lg font-semibold tracking-wide">
            <span className="text-slate-200">EMSERH • </span>
            <span className="text-indigo-400">EPI</span>
          </div>
          <div className="px-5 pb-2 text-[11px] uppercase tracking-wider text-slate-400">Geral</div>
          <nav className="flex-1 px-2 space-y-1">
            {nav.map((item) => {
              const active = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    'block rounded-md px-3 py-2 text-sm transition-colors ' +
                    (active
                      ? 'bg-indigo-950/60 text-indigo-300'
                      : 'text-slate-300 hover:bg-slate-800/40 hover:text-slate-100')
                  }>
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="p-4 text-[11px] text-slate-500">&copy; EMSERH</div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <header className="sticky top-0 z-10 h-14 bg-[#0d1526] border-b border-slate-800/80 flex items-center justify-between px-4">
            <div className="text-sm text-slate-400">Conectado</div>
            <div className="flex items-center gap-4">
              <div className="h-8 w-8 rounded-full bg-indigo-600/30 border border-indigo-500/30" />
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
