'use client';

export default function Page() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-panel p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-1">SPCI / Extintores</h1>
        <p className="text-sm text-muted">Controle de equipamentos de combate a incêndio, inspeções e vencimentos.</p>
      </div>
      <div className="rounded-xl border border-dashed border-border/60 bg-bg/30 p-4 text-xs text-muted">
        Estrutura básica pronta. Em seguida podemos conectar esta tela às tabelas do Neon
        e às rotinas do SESMT (registros, relatórios, dashboards).
      </div>
    </div>
  );
}
