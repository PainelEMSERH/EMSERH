export const dynamic = "force-dynamic";
export default async function Page() {
  return (
    <div className="p-6">
      <div className="rounded-xl border border-white/10 bg-slate-900 p-6 shadow">
        <h1 className="text-2xl font-semibold mb-2">Pendências</h1>
        <p className="text-sm text-white/80">Pendências por colaborador, prazos e situação.</p>
      </div>
    </div>
  );
}