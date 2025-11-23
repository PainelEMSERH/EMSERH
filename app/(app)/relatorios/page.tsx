'use client';

import React, { useEffect, useMemo, useState } from 'react';

type UnidadeResumo = {
  regional: string;
  unidade: string;
  colaboradores: number;
  itens_entregues: number;
  media_itens: number;
};

type ItemResumo = {
  item: string;
  total_itens: number;
  colaboradores: number;
  unidades: number;
};

type RelatorioResponse = {
  ok: boolean;
  periodo: { de: string; ate: string };
  filtros: { regional: string | null; unidade: string | null };
  porUnidade: UnidadeResumo[];
  porItem: ItemResumo[];
};

type EstoqueOptions = {
  regionais: string[];
  unidades: { unidade: string; regional: string }[];
};

function formatDatePtBR(iso: string | null | undefined): string {
  if (!iso) return '-';
  const s = iso.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const [yyyy, mm, dd] = s.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

async function fetchJSON<T = any>(url: string): Promise<{ ok: boolean; json: T | any }> {
  const res = await fetch(url, { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

export default function RelatoriosPage() {
  const [tab, setTab] = useState<'resumo' | 'unidade' | 'item'>('resumo');

  const [opts, setOpts] = useState<EstoqueOptions>({ regionais: [], unidades: [] });
  const [optsLoading, setOptsLoading] = useState(false);

  const [filters, setFilters] = useState(() => {
    const now = new Date();
    const ate = now.toISOString().slice(0, 10);
    const deDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const de = deDate.toISOString().slice(0, 10);
    return {
      regional: '',
      unidade: '',
      de,
      ate,
    };
  });

  const [data, setData] = useState<RelatorioResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadOpts() {
      setOptsLoading(true);
      try {
        const { ok, json } = await fetchJSON<EstoqueOptions>('/api/estoque/options');
        if (!ok) return;
        if (cancelled) return;
        const regionais = Array.isArray(json?.regionais) ? json.regionais : [];
        const unidades = Array.isArray(json?.unidades) ? json.unidades : [];
        setOpts({ regionais, unidades });
      } finally {
        if (!cancelled) setOptsLoading(false);
      }
    }
    loadOpts();
    return () => {
      cancelled = true;
    };
  }, []);

  const unidadesFiltradas = useMemo(() => {
    if (!filters.regional) return opts.unidades || [];
    return (opts.unidades || []).filter((u) => {
      return (u.regional || '').toString().toUpperCase() === filters.regional.toUpperCase();
    });
  }, [opts.unidades, filters.regional]);

  const resumo = useMemo(() => {
    if (!data) return null;
    const unidades = data.porUnidade || [];
    const itens = data.porItem || [];

    const totalUnidades = unidades.length;
    const totalColaboradores = unidades.reduce((acc, u) => acc + (u.colaboradores || 0), 0);
    const totalItens = unidades.reduce((acc, u) => acc + (u.itens_entregues || 0), 0);
    const mediaItens =
      totalColaboradores > 0 ? Number((totalItens / totalColaboradores).toFixed(2)) : 0;

    const ordenadasUnidades = [...unidades].sort(
      (a, b) => (b.itens_entregues || 0) - (a.itens_entregues || 0),
    );
    const topUnidade = ordenadasUnidades[0] || null;

    const ordenadosItens = [...itens].sort(
      (a, b) => (b.total_itens || 0) - (a.total_itens || 0),
    );
    const topItem = ordenadosItens[0] || null;

    return {
      totalUnidades,
      totalColaboradores,
      totalItens,
      mediaItens,
      topUnidade,
      topItem,
    };
  }, [data]);

  async function handleGerar() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.regional) params.set('regional', filters.regional);
      if (filters.unidade) params.set('unidade', filters.unidade);
      if (filters.de) params.set('de', filters.de);
      if (filters.ate) params.set('ate', filters.ate);

      const url = `/api/relatorios/entregas?${params.toString()}`;
      const { ok, json } = await fetchJSON<RelatorioResponse>(url);
      if (!ok || json?.ok === false) {
        setData(null);
        setError(json?.error || 'Não foi possível gerar o relatório. Tente novamente.');
        return;
      }
      setData(json as RelatorioResponse);
    } catch (e: any) {
      setData(null);
      setError(e?.message || 'Erro inesperado ao gerar relatório.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Relatórios</h1>
          <p className="text-xs text-muted">
            Análises operacionais e gerenciais das entregas de EPI por Regional e Unidade. Filtre o
            período, gere o relatório e navegue pelas abas para ver os detalhes.
          </p>
        </div>
      </div>

      <div className="border-b border-border">
        <nav className="-mb-px flex gap-4 text-xs">
          <button
            type="button"
            onClick={() => setTab('resumo')}
            className={`border-b-2 px-3 py-2 ${
              tab === 'resumo'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            Resumo
          </button>
          <button
            type="button"
            onClick={() => setTab('unidade')}
            className={`border-b-2 px-3 py-2 ${
              tab === 'unidade'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            Por unidade
          </button>
          <button
            type="button"
            onClick={() => setTab('item')}
            className={`border-b-2 px-3 py-2 ${
              tab === 'item'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            Por item
          </button>
        </nav>
      </div>

      {/* Filtros principais do relatório */}
      <div className="rounded-xl border border-border bg-panel p-4 flex flex-wrap items-end gap-3 text-xs">
        <div className="flex flex-col gap-1">
          <span className="font-medium">Regional</span>
          <select
            className="w-48 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
            value={filters.regional}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                regional: e.target.value,
                unidade: '',
              }))
            }
          >
            <option value="">Todas</option>
            {opts.regionais.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {optsLoading && (
            <span className="text-[11px] text-muted">Carregando lista de Regionais...</span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <span className="font-medium">Unidade</span>
          <select
            className="w-72 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
            value={filters.unidade}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                unidade: e.target.value,
              }))
            }
          >
            <option value="">Todas</option>
            {unidadesFiltradas.map((u) => (
              <option key={u.unidade} value={u.unidade}>
                {u.unidade}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span className="font-medium">Data inicial</span>
          <input
            type="date"
            className="w-40 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
            value={filters.de}
            max={filters.ate || undefined}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                de: e.target.value,
              }))
            }
          />
        </div>

        <div className="flex flex-col gap-1">
          <span className="font-medium">Data final</span>
          <input
            type="date"
            className="w-40 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
            value={filters.ate}
            min={filters.de || undefined}
            onChange={(e) =>
              setFilters((prev) => ({
                ...prev,
                ate: e.target.value,
              }))
            }
          />
        </div>

        <div className="ml-auto flex flex-col gap-1">
          <span className="text-[11px] text-muted"> </span>
          <button
            type="button"
            onClick={handleGerar}
            disabled={loading}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
          >
            {loading ? 'Gerando…' : 'Gerar relatório'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/5 px-4 py-3 text-xs text-red-500">
          {error}
        </div>
      )}

      {/* Conteúdo das abas */}
      {tab === 'resumo' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-panel p-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Resumo do período</h2>
                <p className="text-[11px] text-muted">
                  {data
                    ? `Período de ${formatDatePtBR(data.periodo.de)} a ${formatDatePtBR(
                        data.periodo.ate,
                      )}.`
                    : 'Selecione os filtros acima e clique em "Gerar relatório".'}
                </p>
              </div>
              {data && (
                <div className="text-[11px] text-muted">
                  Filtros aplicados:{' '}
                  <span className="font-medium text-text">
                    {data.filtros.regional ? data.filtros.regional : 'Todas as Regionais'}
                  </span>
                  {' · '}
                  <span className="font-medium text-text">
                    {data.filtros.unidade ? data.filtros.unidade : 'Todas as unidades'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {!data && !loading && (
            <div className="rounded-xl border border-border bg-panel p-6 text-xs text-muted">
              Nenhum relatório gerado ainda. Ajuste os filtros e clique em{' '}
              <span className="font-semibold text-text">Gerar relatório</span> para visualizar os
              dados.
            </div>
          )}

          {loading && (
            <div className="grid gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-28 animate-pulse rounded-xl border border-border bg-panel/60"
                />
              ))}
            </div>
          )}

          {data && resumo && !loading && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <div className="rounded-xl border border-border bg-panel p-4">
                  <p className="text-[11px] text-muted">Unidades com entrega</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-300">
                    {resumo.totalUnidades}
                  </p>
                  <p className="mt-1 text-[10px] text-muted">
                    Número de unidades que registraram entrega de EPI no período.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-panel p-4">
                  <p className="text-[11px] text-muted">Colaboradores com entrega</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {resumo.totalColaboradores.toLocaleString('pt-BR')}
                  </p>
                  <p className="mt-1 text-[10px] text-muted">
                    Soma de colaboradores com pelo menos uma entrega registrada.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-panel p-4">
                  <p className="text-[11px] text-muted">EPIs entregues</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {resumo.totalItens.toLocaleString('pt-BR')}
                  </p>
                  <p className="mt-1 text-[10px] text-muted">
                    Quantidade total de itens entregues (todas as unidades filtradas).
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-panel p-4">
                  <p className="text-[11px] text-muted">Média de itens por colaborador</p>
                  <p className="mt-1 text-2xl font-semibold">
                    {resumo.mediaItens.toLocaleString('pt-BR', {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  <p className="mt-1 text-[10px] text-muted">
                    Indicador médio de consumo de EPI por colaborador no período.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-panel p-4 text-xs">
                  <p className="text-[11px] font-semibold">Unidade com maior volume de entrega</p>
                  {resumo.topUnidade ? (
                    <>
                      <p className="mt-1 text-sm font-medium">
                        {resumo.topUnidade.unidade}{' '}
                        <span className="text-[11px] text-muted">
                          ({resumo.topUnidade.regional || '—'})
                        </span>
                      </p>
                      <p className="mt-1 text-[11px] text-muted">
                        {resumo.topUnidade.itens_entregues.toLocaleString('pt-BR')} itens entregues
                        no período, atendendo{' '}
                        {resumo.topUnidade.colaboradores.toLocaleString('pt-BR')} colaboradores.
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-[11px] text-muted">
                      Nenhuma entrega encontrada com os filtros atuais.
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-panel p-4 text-xs">
                  <p className="text-[11px] font-semibold">EPI mais utilizado</p>
                  {resumo.topItem ? (
                    <>
                      <p className="mt-1 text-sm font-medium">{resumo.topItem.item}</p>
                      <p className="mt-1 text-[11px] text-muted">
                        {resumo.topItem.total_itens.toLocaleString('pt-BR')} unidades entregues para{' '}
                        {resumo.topItem.colaboradores.toLocaleString('pt-BR')} colaboradores em{' '}
                        {resumo.topItem.unidades.toLocaleString('pt-BR')} unidades diferentes.
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-[11px] text-muted">
                      Ainda não há dados de entregas para calcular o EPI mais utilizado.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'unidade' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-panel p-4 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Entregas consolidadas por unidade</h2>
                <p className="text-[11px] text-muted">
                  Cada linha representa uma unidade com o total de colaboradores atendidos e de EPIs
                  entregues no período selecionado.
                </p>
              </div>
              {data && (
                <div className="text-[11px] text-muted">
                  {data.porUnidade.length}{' '}
                  {data.porUnidade.length === 1 ? 'unidade encontrada' : 'unidades encontradas'}.
                </div>
              )}
            </div>
          </div>

          {!data && !loading && (
            <div className="rounded-xl border border-border bg-panel p-6 text-xs text-muted">
              Gere o relatório primeiro para visualizar a tabela consolidada por unidade.
            </div>
          )}

          {loading && (
            <div className="rounded-xl border border-border bg-panel p-6 text-xs text-muted">
              Carregando dados das unidades...
            </div>
          )}

          {data && !loading && (
            <div className="rounded-xl border border-border bg-panel p-0 text-xs">
              <div className="max-h-[440px] overflow-auto rounded-xl">
                <table className="min-w-full border-collapse text-[11px]">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="sticky top-0 z-10 border-b border-border px-3 py-2 text-left">
                        Regional
                      </th>
                      <th className="sticky top-0 z-10 border-b border-border px-3 py-2 text-left">
                        Unidade
                      </th>
                      <th className="sticky top-0 z-10 border-b border-border px-3 py-2 text-right">
                        Colaboradores com entrega
                      </th>
                      <th className="sticky top-0 z-10 border-b border-border px-3 py-2 text-right">
                        EPIs entregues
                      </th>
                      <th className="sticky top-0 z-10 border-b border-border px-3 py-2 text-right">
                        Média de itens por colaborador
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.porUnidade.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-3 py-4 text-center text-[11px] text-muted border-t border-border"
                        >
                          Nenhuma unidade com entrega encontrada para os filtros aplicados.
                        </td>
                      </tr>
                    )}
                    {data.porUnidade.map((row) => (
                      <tr key={`${row.regional || '—'}::${row.unidade || '—'}`} className="border-t border-border/60">
                        <td className="px-3 py-2 align-top">{row.regional || '—'}</td>
                        <td className="px-3 py-2 align-top">{row.unidade || '—'}</td>
                        <td className="px-3 py-2 text-right align-top">
                          {row.colaboradores.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          {row.itens_entregues.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          {row.media_itens.toLocaleString('pt-BR', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'item' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-panel p-4 text-xs">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Consumo consolidado por item de EPI</h2>
                <p className="text-[11px] text-muted">
                  Lista dos EPIs mais utilizados no período, com total de unidades entregues, número
                  de colaboradores atendidos e quantidade de unidades diferentes que receberam o
                  item.
                </p>
              </div>
              {data && (
                <div className="text-[11px] text-muted">
                  {data.porItem.length}{' '}
                  {data.porItem.length === 1 ? 'item encontrado' : 'itens encontrados'}.
                </div>
              )}
            </div>
          </div>

          {!data && !loading && (
            <div className="rounded-xl border border-border bg-panel p-6 text-xs text-muted">
              Gere o relatório primeiro para visualizar a tabela consolidada por item de EPI.
            </div>
          )}

          {loading && (
            <div className="rounded-xl border border-border bg-panel p-6 text-xs text-muted">
              Carregando dados de consumo por item...
            </div>
          )}

          {data && !loading && (
            <div className="rounded-xl border border-border bg-panel p-0 text-xs">
              <div className="max-h-[440px] overflow-auto rounded-xl">
                <table className="min-w-full border-collapse text-[11px]">
                  <thead className="bg-muted/40">
                    <tr>
                      <th className="sticky top-0 z-10 border-b border-border px-3 py-2 text-left">
                        EPI / Item
                      </th>
                      <th className="sticky top-0 z-10 border-b border-border px-3 py-2 text-right">
                        EPIs entregues
                      </th>
                      <th className="sticky top-0 z-10 border-b border-border px-3 py-2 text-right">
                        Colaboradores atendidos
                      </th>
                      <th className="sticky top-0 z-10 border-b border-border px-3 py-2 text-right">
                        Unidades atendidas
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.porItem.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-3 py-4 text-center text-[11px] text-muted border-t border-border"
                        >
                          Nenhum consumo de EPI encontrado para os filtros aplicados.
                        </td>
                      </tr>
                    )}
                    {data.porItem.map((row) => (
                      <tr key={row.item || '—'} className="border-t border-border/60">
                        <td className="px-3 py-2 align-top">{row.item || '—'}</td>
                        <td className="px-3 py-2 text-right align-top">
                          {row.total_itens.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          {row.colaboradores.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-3 py-2 text-right align-top">
                          {row.unidades.toLocaleString('pt-BR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
