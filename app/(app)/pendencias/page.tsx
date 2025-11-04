export const dynamic = "force-dynamic";
export default async function Page() {
  return (
    <div className="p-6">
      <div className="rounded-xl border border-border bg-panel p-6 shadow">
        <h1 className="text-2xl font-semibold mb-2">Pendências</h1>
        <p className="text-sm text-text">Pendências por colaborador, prazos e situação.</p>
      </div>
    </div>
  );
}