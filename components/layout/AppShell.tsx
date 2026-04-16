"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { UserButton } from "@clerk/nextjs";
import ThemeSwitcherGeist from "@/components/components/ThemeSwitcherGeist";
import {
  LayoutDashboard,
  PackageCheck,
  Boxes,
  BarChart3,
  Settings,
  AlertTriangle,
  Flame,
  FileText,
  ClipboardList,
  Shield,
  Users,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";

const SIDEBAR_STORAGE_KEY = "emserh-sidebar-open";

type NavItem = {
  label: string;
  href: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    label: "VISÃO GERAL",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Relatórios", href: "/relatorios", icon: BarChart3 },
      { label: "Estoque SESMT", href: "/estoque", icon: Boxes },
    ],
  },
  {
    label: "Indicadores",
    items: [
      { label: "Acidentes", href: "/acidentes", icon: AlertTriangle },
      { label: "Extintores", href: "/spci-extintores", icon: Flame },
      { label: "Entregas", href: "/entregas", icon: PackageCheck },
      { label: "Ordens de Serviço", href: "/ordens-de-servico", icon: FileText },
      { label: "CIPA", href: "/cipa", icon: Users },
      { label: "Central de Ações GST", href: "/central-acoes-gst", icon: ClipboardList },
    ],
  },
  {
    label: "ADMINISTRAÇÃO",
    items: [
      { label: "Admin", href: "/admin", icon: Shield },
      { label: "Configurações", href: "/configuracoes", icon: Settings },
    ],
  },
];

function Sidebar() {
  const pathname = usePathname();

  return (
    <aside id="app-sidebar" className="w-72 min-w-72 shrink-0 bg-bg/50">
      <div className="px-4 py-5 text-sm font-semibold tracking-wide text-text">
        Menu
      </div>
      <nav className="flex flex-col px-2 pb-6 gap-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-2 pb-1 text-[10px] uppercase tracking-wider text-muted">
              {group.label}
            </div>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active =
                  (item.href === "/dashboard" && pathname === "/dashboard") ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={true}
                    className={clsx(
                      "flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer select-none outline-none",
                      "transition-[background-color,color,box-shadow] duration-100 ease-out",
                      active
                        ? "bg-panel text-text ring-1 ring-inset ring-border"
                        : "text-muted hover:bg-panel hover:text-text hover:shadow-sm active:bg-panel/90 active:opacity-95"
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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    try {
      const v = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (v === "0") setSidebarOpen(false);
    } catch {
      /* ignore */
    }
  }, []);

  /** Escala ~75% no <html> só com o app logado — inclui portais (Clerk/modais). Removido ao sair. */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("app-shell-zoom");
    return () => root.classList.remove("app-shell-zoom");
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen((o) => {
      const next = !o;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <div className="flex min-h-screen bg-bg text-text">
      <div
        className={clsx(
          "shrink-0 overflow-hidden border-r border-border bg-bg/50 transition-[width] duration-200 ease-out",
          sidebarOpen ? "w-72 border-border" : "w-0 border-transparent"
        )}
        aria-hidden={!sidebarOpen}
      >
        {sidebarOpen ? <Sidebar /> : null}
      </div>
      <main className="min-w-0 flex-1 overflow-x-hidden">
        <header className="sticky top-0 z-10 w-full border-b border-border bg-panel/80 backdrop-blur px-5 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={toggleSidebar}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-panel text-text hover:bg-bg focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                aria-expanded={sidebarOpen}
                aria-controls="app-sidebar"
                aria-label={sidebarOpen ? "Recolher menu lateral" : "Mostrar menu lateral"}
                title={sidebarOpen ? "Recolher menu" : "Mostrar menu"}
              >
                {sidebarOpen ? (
                  <PanelLeftClose className="h-4 w-4" aria-hidden />
                ) : (
                  <PanelLeft className="h-4 w-4" aria-hidden />
                )}
              </button>
              <span className="truncate text-sm text-emerald-400">● Conectado</span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <ThemeSwitcherGeist />
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </header>
        <div className="max-w-full overflow-x-hidden p-6">{children}</div>
      </main>
    </div>
  );
}
