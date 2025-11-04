
"use client";
import Link from "next/link";
import ModeToggle from "./mode-toggle";
import { usePathname } from "next/navigation";
import { UserButton, SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
const nav = [
  { href: "/", label: "Início", icon: "🏠" },
  { href: "/entregas", label: "Entregas", icon: "📦" },
  { href: "/colaboradores", label: "Colaboradores", icon: "👥" },
  { href: "/config", label: "Configurações", icon: "⚙️" },
];
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen grid grid-rows-[auto,1fr] bg-background text-foreground">
      <header className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="size-8 rounded-lg bg-brand" /><span className="font-semibold">EMSERH Painel</span>
        </div>
        <div className="flex items-center gap-3">
          <ModeToggle />
          <SignedIn><UserButton /></SignedIn>
          <SignedOut><SignInButton mode="modal" /></SignedOut>
        </div>
      </header>
      <div className="grid md:grid-cols-[220px,1fr]">
        <aside className="hidden md:block border-r p-3">
          <nav className="grid gap-1">
            {nav.map(item => (
              <Link key={item.href} href={item.href}
                className={"flex items-center gap-2 rounded-xl px-3 py-2 hover:bg-muted/60 transition " + (pathname === item.href ? "bg-muted font-medium" : "")}>
                <span>{item.icon}</span><span>{item.label}</span>
              </Link>
            ))}
          </nav>
        </aside>
        <main className="p-4">{children}</main>
      </div>
    </div>
  );
}
