'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = { href: string; label: string };

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/colaboradores', label: 'Colaboradores' },
  { href: '/entregas', label: 'Entregas' },
  { href: '/pendencias', label: 'Pendências' },
  { href: '/estoque', label: 'Estoque' },
  { href: '/kits', label: 'Kits' },
  { href: '/relatorios', label: 'Relatórios' },
  { href: '/admin', label: 'Admin' },
  { href: '/configuracoes', label: 'Configurações' },
];

function SideNav() {
  const pathname = usePathname() || '';
  return (
    <aside className="w-64 shrink-0 border-r border-white/5 bg-[#0f1623] text-sm text-white/80">
      <div className="px-5 py-4 text-white font-semibold">EMSERH • EPI</div>
      <div className="px-5 pb-2 text-xs uppercase tracking-wide text-white/50">Geral</div>
      <nav className="flex flex-col gap-1 px-2 pb-6">
        {NAV.map(item => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'rounded-md px-3 py-2 transition-colors',
                active ? 'bg-indigo-600/20 text-indigo-300' : 'hover:bg-white/5'
              ].join(' ')}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0b1220] text-white">
      <header className="sticky top-0 z-10 border-b border-white/5 bg-[#0f1623]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <div className="text-white/80">Painel</div>
          <div className="flex items-center gap-3 text-white/60">
            <span className="h-2 w-2 rounded-full bg-rose-500" />
            <span>Conectado</span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-6">
        <SideNav />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
