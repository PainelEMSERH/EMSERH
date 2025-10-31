// app/(app)/kits/page.tsx
// Esta página herda o AppShell do grupo de rotas (app).
// Mantém o layout igual ao Dashboard e exibe placeholder até definirmos a UI.
export default function KitsPage() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[#0E1420] border border-white/5 p-6">
        <h1 className="text-2xl font-semibold">Kits</h1>
        <p className="text-sm text-white/60 mt-2">
          Conteúdo em desenvolvimento.
        </p>
      </div>
    </div>
  );
}
