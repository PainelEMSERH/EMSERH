export const dynamic = "force-dynamic";

export default async function Page() {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-panel p-6 shadow-sm">
        <h1 className="text-2xl font-semibold mb-1">Configurações do sistema</h1>
        <p className="text-sm text-muted">
          Central de ajustes da plataforma de Gestão de EPI, pronta para crescer com módulos de Acidentes,
          SPCI, CIPA e Ordens de Serviço.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <section className="rounded-xl border border-border bg-bg/40 p-4 space-y-3">
          <h2 className="text-sm font-semibold">Exibição e filtros</h2>
          <p className="text-xs text-muted">
            Padrões de regional, unidade e paginação utilizados nas telas de Alterdata, Entregas e Kits.
          </p>
          <div className="space-y-2 text-xs text-muted">
            <p>• Regional padrão do coordenador</p>
            <p>• Unidade padrão de trabalho</p>
            <p>• Itens por página (25 / 50 / 100)</p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-bg/40 p-4 space-y-3">
          <h2 className="text-sm font-semibold">Integrações</h2>
          <p className="text-xs text-muted">
            Área reservada para chaves e parâmetros técnicos (Neon, autenticação, ETL).
          </p>
          <div className="space-y-2 text-xs text-muted">
            <p>• Status da sincronização Alterdata → Neon</p>
            <p>• View de kits: vw_entregas_epi_unidade</p>
            <p>• Último REFRESH das views rápidas</p>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-bg/40 p-4 space-y-3">
          <h2 className="text-sm font-semibold">Módulos de SST</h2>
          <p className="text-xs text-muted">
            Resumo dos módulos que serão ativados em breve para acidentes, SPCI, CIPA e OS.
          </p>
          <div className="space-y-2 text-xs text-muted">
            <p>• Acidentes de trabalho (CAT, tipologia, causas)</p>
            <p>• SPCI / Extintores (inspeções, vencimentos)</p>
            <p>• CIPA (mandatos, reuniões, atas)</p>
            <p>• Ordens de Serviço (riscos, EPIs, assinatura)</p>
          </div>
        </section>
      </div>

      <div className="rounded-xl border border-dashed border-border/60 bg-bg/30 p-4 text-xs text-muted">
        Esta página já está com layout definitivo. Os campos acima podem ser ligados a tabelas
        e APIs específicas assim que as regras forem definidas, sem necessidade de refatorar o visual.
      </div>
    </div>
  );
}
