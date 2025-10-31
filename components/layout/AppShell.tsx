import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Client wrapper only for active-link highlight
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      className={`block px-3 py-2 rounded-md text-sm ${active ? 'text-indigo-400' : 'text-zinc-300 hover:text-white'}`}
    >
      {children}
    </Link>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0B1320] text-zinc-100">
      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b border-zinc-800 bg-[#0E1627]/95 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 h-14 flex items-center justify-between">
          <div className="font-semibold">EMSERH • EPI</div>
          <div className="text-sm text-zinc-400">Conectado</div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 flex gap-6 py-6">
        {/* Sidebar */}
        <aside className="w-64 shrink-0">
          <div className="text-xs uppercase text-zinc-500 mb-2">Geral</div>
          <nav className="space-y-1">
            <NavLink href="/">Dashboard</NavLink>
            <NavLink href="/colaboradores">Colaboradores</NavLink>
            <NavLink href="/entregas">Entregas</NavLink>
            <NavLink href="/pendencias">Pendências</NavLink>
            <NavLink href="/estoque">Estoque</NavLink>
            <NavLink href="/kits">Kits</NavLink>
            <NavLink href="/relatorios">Relatórios</NavLink>
            <NavLink href="/admin">Admin</NavLink>
            <NavLink href="/configuracoes">Configurações</NavLink>
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
