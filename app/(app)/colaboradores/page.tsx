export const dynamic = "force-dynamic";
export default async function Page() {
  return (
    <div className="p-6">
      <div className="rounded-xl border border-white/10 bg-[#0f172a] p-6 shadow">
        <h1 className="text-2xl font-semibold mb-2">Colaboradores</h1>
        <p className="text-sm text-white/60">Tabela com busca, filtros, status e ações.</p>
      </div>
    </div>
  );
}