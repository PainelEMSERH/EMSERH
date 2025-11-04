"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import ThemeToggle from "@/components/components/ThemeToggle";
import { UserButton } from "@clerk/nextjs";

const NAV = [
  { label: "Dashboard", href: "/" },
  { label: "Colaboradores", href: "/colaboradores" },
  { label: "Entregas", href: "/entregas" },
  { label: "Pendências", href: "/pendencias" },
  { label: "Estoque", href: "/estoque" },
  { label: "Kits", href: "/kits" },
  { label: "Relatórios", href: "/relatorios" },
  { label: "Admin", href: "/admin" },
  { label: "Configurações", href: "/configuracoes" },
];

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-64 shrink-0 border-r border-border bg-bg/50">
      <div className="px-4 py-5 text-sm font-semibold tracking-wide text-text">
        EMSERH • EPI
      </div>
      <div className="px-4 pb-2 text-[10px] uppercase tracking-wider text-slate-400">
        Geral
      </div>
      <nav className="flex flex-col px-2 pb-6">
        {NAV.map((n) => {
          const active =
            (n.href === "/" && pathname === "/") ||
            (n.href !== "/" && pathname.startsWith(n.href));
          return (
            <Link
              key={n.href}
              href={n.href}
              className={clsx(
                "rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-indigo-600/10 text-indigo-300 ring-1 ring-inset ring-indigo-500/30"
                  : "text-slate-300 hover:bg-slate-800/60 hover:text-text"
              )}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-bg text-text">
      <Sidebar />
      <main className="flex-1">
        <header className="sticky top-0 z-10 w-full border-b border-border bg-bg/80 backdrop-blur px-5 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-emerald-400">● Conectado</span>
            <div className="text-sm text-slate-300">Painel</div>
          </div>
        </header>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}
