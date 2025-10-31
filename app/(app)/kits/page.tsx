// app/(app)/kits/page.tsx
// Página colocada dentro do grupo de rotas (app) para herdar o AppShell do dashboard.
// Sem imports externos para evitar erros de build por módulos ausentes.
export default function KitsPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-[#0b1220] border border-white/10 p-6">
        <h1 className="text-2xl font-semibold">Kits</h1>
        <p className="mt-2 text-sm text-white/70">
          Conteúdo em desenvolvimento. Esta página já utiliza o mesmo layout do Dashboard
          (herdado pelo route group <code>(app)</code>).
        </p>
      </section>
    </div>
  );
}
