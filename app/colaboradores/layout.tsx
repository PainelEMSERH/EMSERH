import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default function Layout({ children }: { children: React.ReactNode }) {
  // Lateral fixa (cola) + conteúdo principal. Mantém o topo já fornecido pelo layout raiz.
  return (
    <div className="w-full">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex gap-6">
          {/* Aside (desk) */}
          <aside
            className="hidden md:block w-64 shrink-0 border-r border-white/10"
            aria-label="Menu lateral"
          >
            <div className="sticky top-20 py-6 pr-4">
              <p className="text-xs uppercase tracking-wider text-zinc-400 mb-3">
                Geral
              </p>
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
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 py-6">{children}</main>
        </div>
      </div>
    </div>
  )
}

// Componente simples para links do menu
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="block rounded-lg px-3 py-2 text-sm text-zinc-300 hover:text-white hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
    >
      {children}
    </Link>
  )
}
