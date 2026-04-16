'use client';

import React, { useState } from 'react';

type ImportModule = {
  id: string;
  name: string;
  description: string;
  icon: string;
  endpoint: string;
};

const IMPORT_MODULES: ImportModule[] = [
  {
    id: 'spci',
    name: 'SPCI - Extintores',
    description: 'Importar base de extintores e inspeções SPCI',
    icon: '🔥',
    endpoint: '/api/import/spci',
  },
  {
    id: 'cipa',
    name: 'CIPA',
    description: 'Importar base de membros e atividades da CIPA',
    icon: '👥',
    endpoint: '/api/import/cipa',
  },
  {
    id: 'acidentes',
    name: 'Acidentes (stg_acidentes)',
    description: 'Apaga a base atual e sobe a nova. CSV (separador ;) ou Excel com colunas da planilha Alterdata.',
    icon: '⚠️',
    endpoint: '/api/acidentes/import-stg',
  },
  {
    id: 'ordens_servico',
    name: 'Ordens de Serviço',
    description: 'Importar base de ordens de serviço',
    icon: '🔧',
    endpoint: '/api/import/ordens-servico',
  },
  {
    id: 'epi_map',
    name: 'EPI Map (stg_epi_map)',
    description: 'Substitui o mapeamento de EPIs (Função x Setor x PCG x Kit).',
    icon: '🧩',
    endpoint: '/api/import/epi-map',
  },
  {
    id: 'plano_acao_indicadores',
    name: 'Plano de ação / Indicadores',
    description:
      'Tabela plano_acao_indicadores no Neon: planilha com Item, Empresa, Unidade, Prazo, Status, etc. Por padrão substitui toda a base.',
    icon: '📊',
    endpoint: '/api/import/plano-acao-indicadores',
  },
];

export default function ImportarBasesPage() {
  const [selectedModule, setSelectedModule] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const currentModule = IMPORT_MODULES.find(m => m.id === selectedModule);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setStatus({ type: 'error', message: 'Escolha um arquivo .xlsx ou .csv' });
      return;
    }
    if (!selectedModule) {
      setStatus({ type: 'error', message: 'Selecione um módulo para importar' });
      return;
    }

    setBusy(true);
    setStatus({ type: 'info', message: 'Enviando e processando arquivo...' });

    try {
      const fd = new FormData();
      fd.append('file', file);
      
      const endpoint = currentModule?.endpoint || '';
      const r = await fetch(endpoint, {
        method: 'POST',
        body: fd,
      });
      
      const j = await r.json();
      
      if (!r.ok || !j?.ok) {
        setStatus({
          type: 'error',
          message: 'Erro ao importar: ' + (j?.error || 'verifique o arquivo e tente novamente.'),
        });
      } else {
        const count = j.imported ?? j.total_rows ?? 0;
        let successMsg =
          j.message || `✅ Importação concluída! ${count} registro(s) importado(s). A base anterior foi apagada.`;
        if (selectedModule === 'plano_acao_indicadores' && j.header_row_1based != null) {
          const sh = j.sheet_used ? `Aba "${j.sheet_used}". ` : '';
          successMsg += ` ${sh}Cabeçalho na linha ${j.header_row_1based} (${j.column_mapping?.length ?? 0} colunas mapeadas).`;
        }
        setStatus({
          type: 'success',
          message: successMsg,
        });
        // Limpa o formulário
        setFile(null);
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }
    } catch (e: any) {
      setStatus({
        type: 'error',
        message: 'Erro inesperado ao enviar o arquivo: ' + (e?.message || 'Tente novamente.'),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
          Admin • Importação
        </p>
        <h1 className="mt-1 text-lg font-semibold">Importar Bases de Dados</h1>
        <p className="mt-1 text-xs text-muted">
          Importe as bases de dados para os módulos SPCI, CIPA, Acidentes e Ordens de Serviço.
          Os arquivos podem ser Excel (.xlsx) ou CSV.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-panel p-6">
        <form onSubmit={onSubmit} className="space-y-6">
          {/* Seleção de Módulo */}
          <div>
            <label className="text-sm font-semibold block mb-3">
              Selecione o módulo para importar:
            </label>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {IMPORT_MODULES.map((module) => (
                <button
                  key={module.id}
                  type="button"
                  onClick={() => {
                    setSelectedModule(module.id);
                    setStatus(null);
                    setFile(null);
                  }}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedModule === module.id
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20'
                      : 'border-border bg-card hover:border-emerald-300'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{module.icon}</span>
                    <span className="text-sm font-semibold">{module.name}</span>
                  </div>
                  <p className="text-xs text-muted">{module.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Upload de Arquivo */}
          {selectedModule && (
            <div className="space-y-4 pt-4 border-t border-border">
              <div>
                <label className="text-sm font-semibold block mb-2">
                  Arquivo para importar:
                </label>
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    setStatus(null);
                  }}
                  className="block w-full text-sm rounded-xl border border-border bg-card px-4 py-3 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                />
                <p className="text-xs text-muted mt-2">
                  Formatos aceitos: Excel (.xlsx) ou CSV. Certifique-se de que o arquivo está no formato correto.
                </p>
              </div>

              {/* Instruções específicas por módulo */}
              {currentModule && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900/50 dark:bg-emerald-900/10">
                  <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 mb-2">
                    📋 Estrutura esperada para {currentModule.name}:
                  </div>
                  <div className="text-xs text-emerald-700 dark:text-emerald-300 space-y-1">
                    {selectedModule === 'spci' && (
                      <>
                        <p>Colunas esperadas: Unidade, Regional, Tipo de Extintor, Capacidade, Localização, Data Vencimento, Última Inspeção, Próxima Inspeção, Status</p>
                      </>
                    )}
                    {selectedModule === 'cipa' && (
                      <>
                        <p>Colunas esperadas: Nome, CPF, Função, Unidade, Cargo na CIPA, Data Eleição, Data Fim Mandato, Status</p>
                      </>
                    )}
                    {selectedModule === 'acidentes' && (
                      <>
                        <p><strong>Base de acidentes (stg_acidentes):</strong> ao importar, a base atual é apagada e substituída pela do arquivo.</p>
                        <p className="mt-1">CSV com separador <strong>;</strong> (ponto e vírgula) ou Excel, com as colunas da planilha Alterdata: CdChamada, NmFuncionario, nmdepartamento, data_acidente (DD/MM/YYYY), numero_cat, Regional, etc.</p>
                      </>
                    )}
                    {selectedModule === 'ordens_servico' && (
                      <>
                        <p>Colunas esperadas: Número OS, Data Abertura, Data Fechamento, Unidade, Regional, Tipo de Serviço, Descrição, Solicitante, Status, Prioridade</p>
                      </>
                    )}
                    {selectedModule === 'epi_map' && (
                      <>
                        <p><strong>Mapa EPI (stg_epi_map):</strong> Função (alterdata), Setor (unidade_hospitalar), Kit/EPI (epi_item), PCG/PGR e Qtd.</p>
                        <p className="mt-1">A importação detecta os cabeçalhos pelo nome (ex.: “SETOR”, “KIT”, “PCG/PGR”, “QTD”, “ALTERDATA/FUNÇÃO”).</p>
                      </>
                    )}
                    {selectedModule === 'plano_acao_indicadores' && (
                      <>
                        <p>
                          <strong>Neon · plano_acao_indicadores:</strong> o sistema procura a <strong>melhor linha de cabeçalho</strong> nas
                          primeiras linhas do Excel (pode haver título institucional acima). Sinônimos e nomes parecidos (ex.: Macro Regional,
                          Vencimento, Situação) são aceitos.
                        </p>
                        <p className="mt-1 font-mono text-[10px] leading-relaxed break-words">
                          Item · Empresa · Unidade · Diretoria · Gerência · Cod. Origem · Data de origem · Origem · Indicador ·
                          Auxiliar · Ação · Regional · Responsável · Prazo · Conclusão · Novo Prazo · Status · Evidência ·
                          Comentários · ORIGEM ANO · ORIGEM MES · MÊS PRAZO
                        </p>
                        <p className="mt-1">
                          Se a base no Neon ficou com campos vazios, <strong>importe de novo</strong> o mesmo Excel (substitui tudo). A mensagem
                          de sucesso indica qual linha foi usada como cabeçalho. SQL:{' '}
                          <code className="rounded bg-bg px-1">scripts/sql/neon_plano_acao_indicadores.sql</code>. Por padrão:{' '}
                          <strong>TRUNCATE</strong> e recarga completa.
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={busy || !file}
                className="w-full rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20"
              >
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Processando...
                  </span>
                ) : (
                  `📤 Importar ${currentModule?.name || 'Base'}`
                )}
              </button>
            </div>
          )}

          {/* Status */}
          {status && (
            <div
              className={`rounded-xl border p-4 ${
                status.type === 'success'
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-200'
                  : status.type === 'error'
                  ? 'border-red-300 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200'
                  : 'border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-200'
              }`}
            >
              <div className="text-sm font-medium">{status.message}</div>
            </div>
          )}
        </form>
      </div>

      {/* Informações gerais */}
      <div className="rounded-xl border border-border bg-panel p-5">
        <h3 className="text-sm font-semibold mb-3">ℹ️ Informações Importantes</h3>
        <ul className="text-xs text-muted space-y-2 list-disc list-inside">
          <li>Os arquivos devem ter a primeira linha como cabeçalho com os nomes das colunas</li>
          <li>As importações são incrementais - dados existentes serão atualizados se houver conflito</li>
          <li>Certifique-se de que as datas estão no formato correto (DD/MM/YYYY ou YYYY-MM-DD)</li>
          <li>CPFs devem estar apenas com números ou com formatação padrão (000.000.000-00)</li>
          <li>Após a importação, os dados estarão disponíveis nas respectivas páginas e relatórios</li>
        </ul>
      </div>
    </div>
  );
}
