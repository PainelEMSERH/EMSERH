"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import ThemeToggle from "@/components/components/ThemeToggle";
import { UserButton } from '@clerk/nextjs';
import ThemeSwitcherGeist from '@/components/components/ThemeSwitcherGeist';
import { LayoutDashboard, Table2, PackageCheck, Boxes, ClipboardList, BarChart3, Settings, AlertTriangle, Flame, FileText, ShieldCog, UploadCloud, Users } from "lucide-react";

const NAV_GROUPS = [
  {
    label: "Gestão de EPI",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Alterdata (Completa)", href: "/colaboradores/alterdata", icon: Table2 },
      { label: "Entregas", href: "/entregas", icon: PackageCheck },
      { label: "Estoque", href: "/estoque", icon: Boxes },
      { label: "Kits", href: "/kifunction Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="w-72 shrink-0 border-r border-border bg-bg/50">
      <div className="px-4 py-5 text-sm font-semibold tracking-wide text-text">
        EMSERH • Gestão SSMA
      </div>
      <nav className="flex flex-col px-2 pb-6 gap-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-2 pb-1 text-[10px] uppercase tracking-wider text-muted">
              {group.label}
            </div>
            <div className="flex flex-col">
              {group.items.map((item) => {
                const active =
                  (item.href === "/dashboard" && pathname === "/dashboard") ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-panel text-text ring-1 ring-inset ring-border"
                        : "text-muted hover:bg-panel hover:text-text"
                    )}
                  >
                    {Icon && <Icon className="w-4 h-4 shrink-0" />}
                    <span className="truncate">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

="w-64 shrink-0 border-r border-border bg-bg/50">
      <div className="px-4 py-5 text-sm font-semibold tracking-wide text-text">
        EMSERH • EPI
      </div>
      <div className="px-4 pb-2 text-[10px] uppercase tracking-wider text-muted">
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
                  ? "bg-panel text-text ring-1 ring-inset ring-border"
                  : "text-muted hover:bg-panel hover:text-text"
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
      <main className="flex-1 overflow-x-hidden">
        <header className="sticky top-0 z-10 w-full border-b border-border bg-panel/80 backdrop-blur px-5 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-emerald-400">● Conectado</span>
            <div className="flex items-center gap-3"><ThemeSwitcherGeist /><UserButton afterSignOutUrl="/" /></div>
          </div>
        </header>
        <div className="p-6 max-w-full overflow-x-hidden">{children}</div>
      </main>
    </div>
  );
}
