'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Download, ChevronLeft, ChevronRight, Edit2, Plus } from 'lucide-react';

type Row = {
  id: number;
  numeroSei: string;
  demandante: string;
  tipoDemanda: string;
  origem: string;
  unidade: string;
  setor: string;
  funcao: string;
  insalIadvh: string;
  insalEmserh: string;
  regional: string;
  dataChegada: string | null;
  mesChegada: string;
  anoChegada: number | null;
  responsavel: string;
  status: string;
  prazoDias: number | null;
  dataLimite: string | null;
  dataConclusao: string | null;
  mesConclusao: string;
  destino: string;
  statusFinal: string;
  tempoRespostaDias: number | null;
  observacoes: string;
};

type OptionsData = {
  regionais: string[];
  unidades: string[];
  unidadesDetalhadas: Array<{ unidade: string; regional: string }>;
  anosChegada: number[];
  tipos: string[];
  responsaveis: string[];
  status: string[];
  statusFinal: string[];
};

const MONTH_LABELS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

function getStatusClasses(value: string) {
  if (!value) return 'bg-slate-200 text-slate-700 border-slate-300';
  const v = value.toUpperCase();
  if (v.includes('CONCLU') || v.includes('ENCERR')) {
    return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  }
  if (v.includes('PEND') || v.includes('AGUARD')) {
    return 'bg-amber-100 text-amber-800 border-amber-300';
  }
  if (v.includes('ANDAMENTO') || v.includes('TRAMIT')) {
    return 'bg-sky-100 text-sky-800 border-sky-300';
  }
  return 'bg-slate-200 text-slate-700 border-slate-300';
}

async function fetchJSON<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json && (json.error || json.message)) || 'Erro ao carregar dados');
  return json as T;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
  }
  return value;
}

function formatAvgDays(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return Number(value).toFixed(1);
}

export default function DemandasTrabalhistasPage() {
  const [regional, setRegional] = useState('');
  const [unidade, setUnidade] = useState('');
  const [status, setStatus] = useState('');
  const [statusFinal, setStatusFinal] = useState('');
  // filtros simplificados (sem tipoDemanda e responsável)
  const [ano, setAno] = useState<string>('2026');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('dataChegada');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<{
    perRegional: { regional: string; total: number; avgTempoResposta: number | null }[];
    perMonth: { mesNumero: number; mes: string; total: number }[];
  } | null>(null);
  const [options, setOptions] = useState<OptionsData>({
    regionais: [],
    unidades: [],
    unidadesDetalhadas: [],
    anosChegada: [],
    tipos: [],
    responsaveis: [],
    status: [],
    statusFinal: [],
  });

  const [modalDemanda, setModalDemanda] = useState<{
    open: boolean;
    row: Row | null;
    saving: boolean;
  }>({
    open: false,
    row: null,
    saving: false,
  });

  useEffect(() => {
    fetchJSON<OptionsData & { ok: boolean }>('/api/demandas-trabalhistas/options')
      .then((data) =>
        setOptions({
          regionais: data.regionais || [],
          unidades: data.unidades || [],
          unidadesDetalhadas: data.unidadesDetalhadas || [],
          anosChegada: data.anosChegada || [],
          tipos: data.tipos || [],
          responsaveis: data.responsaveis || [],
          status: data.status || [],
          statusFinal: data.statusFinal || [],
        })
      )
      .catch(() =>
        setOptions({
          regionais: [],
          unidades: [],
          unidadesDetalhadas: [],
          anosChegada: [],
          tipos: [],
          responsaveis: [],
          status: [],
          statusFinal: [],
        })
      );
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (regional) params.set('regional', regional);
      if (unidade) params.set('unidade', unidade);
      if (status) params.set('status', status);
      if (statusFinal) params.set('statusFinal', statusFinal);
      if (search) params.set('search', search);
      if (ano) params.set('ano', ano);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      params.set('sortBy', sortBy);
      params.set('sortDir', sortDir);

      const data = await fetchJSON<{ rows: Row[]; totalCount: number }>(
        `/api/demandas-trabalhistas/list?${params.toString()}`
      );
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setTotal(Number(data.totalCount || 0));
    } catch (error) {
      console.error('Erro ao carregar demandas trabalhistas:', error);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams();
      if (regional) params.set('regional', regional);
      if (unidade) params.set('unidade', unidade);
      if (status) params.set('status', status);
      if (statusFinal) params.set('statusFinal', statusFinal);
      if (search) params.set('search', search);
      if (ano) params.set('ano', ano);

      const data = await fetchJSON<{
        perRegional: { regional: string; total: number; avgTempoResposta: number | null }[];
        perMonth: { mesNumero: number; mesLabel?: string; total: number }[];
      }>(`/api/demandas-trabalhistas/summary?${params.toString()}`);

      setSummary({
        perRegional: Array.isArray(data.perRegional) ? data.perRegional : [],
        perMonth: Array.isArray(data.perMonth)
          ? data.perMonth.map((item) => ({
              mesNumero: Number(item.mesNumero),
              mes: MONTH_LABELS[Math.max(0, Number(item.mesNumero) - 1)] || '',
              total: Number(item.total || 0),
            }))
          : [],
      });
    } catch (error) {
      console.error('Erro ao carregar resumo das demandas trabalhistas:', error);
      setSummary({
        perRegional: [],
        perMonth: [],
      });
    } finally {
      setSummaryLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [regional, unidade, status, statusFinal, search, ano, page, pageSize, sortBy, sortDir]);

  useEffect(() => {
    loadSummary();
  }, [regional, unidade, status, statusFinal, search, ano]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const monthlySummary = useMemo(
    () =>
      MONTH_LABELS.map((label, index) => {
        const found = summary?.perMonth.find((item) => item.mesNumero === index + 1);
        return {
          mes: label,
          total: found?.total ?? 0,
        };
      }),
    [summary]
  );
  const totalDemandasAno = useMemo(
    () => (summary?.perRegional || []).reduce((acc, item) => acc + Number(item.total || 0), 0),
    [summary]
  );
  const tempoMedioGeral = useMemo(() => {
    const valid = (summary?.perRegional || []).filter((item) => item.avgTempoResposta !== null);
    if (!valid.length) return null;
    const total = valid.reduce((acc, item) => acc + Number(item.avgTempoResposta || 0), 0);
    return total / valid.length;
  }, [summary]);
  const regionalLider = useMemo(() => {
    const list = summary?.perRegional || [];
    if (!list.length) return null;
    return [...list].sort((a, b) => Number(b.total || 0) - Number(a.total || 0))[0];
  }, [summary]);
  const maxMonthlyTotal = useMemo(
    () => Math.max(1, ...monthlySummary.map((item) => Number(item.total || 0))),
    [monthlySummary]
  );

  const unidadesFiltradas = useMemo(() => {
    if (!regional) return options.unidades;
    return options.unidadesDetalhadas
      .filter((item) => item.regional === regional)
      .map((item) => item.unidade)
      .filter((value, index, arr) => value && arr.indexOf(value) === index)
      .sort();
  }, [regional, options.unidades, options.unidadesDetalhadas]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
    setPage(1);
  };

  const limparFiltros = () => {
    setRegional('');
    setUnidade('');
    setStatus('');
    setStatusFinal('');
    setSearch('');
    setAno('2026');
    setPage(1);
    setSortBy('dataChegada');
    setSortDir('desc');
  };

  const exportarExcel = async () => {
    if (!rows.length) return;
    const { utils, writeFile } = await import('xlsx');
    const headers = [
      'Nº SEI',
      'Demandante',
      'Tipo de demanda',
      'Origem',
      'Unidade',
      'Regional',
      'Data chegada',
      'Mês Chegada',
      'Ano Chegada',
      'Responsável',
      'Status',
      'Prazo (dias)',
      'Data limite',
      'Data de conclusão',
      'Mês Conclusão',
      'Destino',
      'Status Final',
      'Tempo de Resposta (dias)',
      'Observações',
    ];

    const data = rows.map((row) => [
      row.numeroSei,
      row.demandante,
      row.tipoDemanda,
      row.origem,
      row.unidade,
      row.regional,
      formatDate(row.dataChegada),
      row.mesChegada,
      row.anoChegada ?? '',
      row.responsavel,
      row.status,
      row.prazoDias ?? '',
      formatDate(row.dataLimite),
      formatDate(row.dataConclusao),
      row.mesConclusao,
      row.destino,
      row.statusFinal,
      row.tempoRespostaDias ?? '',
      row.observacoes,
    ]);

    const ws = utils.aoa_to_sheet([headers, ...data]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'DemandasTrabalhistas');
    writeFile(wb, `demandas-trabalhistas-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">Jurídico • Demandas</p>
          <h1 className="mt-1 text-lg font-semibold">Demandas Trabalhistas</h1>
          <p className="mt-1 text-xs text-muted">
            Controle das demandas recebidas, responsáveis, prazos, conclusão e tempo de resposta.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              setModalDemanda({
                open: true,
                saving: false,
                row: {
                  id: 0,
                  numeroSei: '',
                  demandante: '',
                  tipoDemanda: '',
                  origem: '',
                  unidade: '',
                  setor: '',
                  funcao: '',
                  insalIadvh: '',
                  insalEmserh: '',
                  regional: '',
                  dataChegada: null,
                  mesChegada: '',
                  anoChegada: null,
                  responsavel: '',
                  status: '',
                  prazoDias: null,
                  dataLimite: null,
                  dataConclusao: null,
                  mesConclusao: '',
                  destino: '',
                  statusFinal: '',
                  tempoRespostaDias: null,
                  observacoes: '',
                },
              })
            }
            className="px-4 py-2 rounded-lg border border-border bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nova demanda
          </button>
          <button
            onClick={exportarExcel}
            className="p-2 rounded-lg border border-border bg-panel hover:bg-bg text-sm font-medium transition-colors flex items-center"
            title="Exportar para Excel"
            aria-label="Exportar para Excel"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-border bg-panel hover:bg-bg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-panel p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold text-muted uppercase tracking-wide px-2">
            Filtros (padrão ano 2026)
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="lg:col-span-2">
            <label className="block text-xs text-muted mb-1">Buscar (Nº SEI ou Demandante)</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Digite Nº SEI ou Demandante..."
                className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Regional</label>
            <select
              value={regional}
              onChange={(e) => {
                setRegional(e.target.value);
                setUnidade('');
                setPage(1);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todas</option>
              {options.regionais.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Ano Chegada</label>
            <select
              value={ano}
              onChange={(e) => {
                setAno(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todos</option>
              {options.anosChegada.map((item) => (
                <option key={item} value={String(item)}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Unidade</label>
            <select
              value={unidade}
              onChange={(e) => {
                setUnidade(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todas</option>
              {unidadesFiltradas.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todos</option>
              {options.status.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-muted mb-1">Status Final</label>
            <select
              value={statusFinal}
              onChange={(e) => {
                setStatusFinal(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todos</option>
              {options.statusFinal.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>


        </div>

        {(regional || unidade || status || statusFinal || search || ano !== '2026') && (
          <div className="flex justify-end">
            <button
              onClick={limparFiltros}
              className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
            >
              Limpar filtros
            </button>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-cyan-600 px-5 py-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-100">
                Painel Executivo
              </p>
              <h2 className="mt-1 text-2xl font-semibold">Indicadores de Demandas Trabalhistas</h2>
              <p className="mt-1 text-sm text-emerald-50/90">
                Visao consolidada do ano {ano}, com volume por regional, sazonalidade mensal e tempo medio de resposta.
              </p>
            </div>
            <div className="rounded-2xl bg-white/12 px-4 py-3 backdrop-blur-sm">
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-100">Ano em exibicao</div>
              <div className="mt-1 text-3xl font-bold">{ano}</div>
            </div>
          </div>
        </div>

        <div className="p-5">
          {summaryLoading ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-600">
              Carregando indicadores...
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-emerald-50 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Total de demandas</div>
                  <div className="mt-2 text-4xl font-bold text-slate-900">{totalDemandasAno}</div>
                  <div className="mt-2 text-xs text-slate-600">Total consolidado para o ano selecionado.</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-cyan-50 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tempo medio geral</div>
                  <div className="mt-2 text-4xl font-bold text-slate-900">{formatAvgDays(tempoMedioGeral)}</div>
                  <div className="mt-2 text-xs text-slate-600">Dias medios de resposta considerando as regionais com conclusao.</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-amber-50 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Regional com maior volume</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{regionalLider?.regional || 'SEM DADOS'}</div>
                  <div className="mt-2 text-sm font-semibold text-amber-700">
                    {regionalLider ? `${regionalLider.total} demandas` : 'Sem registros no ano'}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Processos por mes</h3>
                    <p className="text-xs text-slate-500">Leitura mensal de janeiro a dezembro.</p>
                  </div>
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Base {ano}</div>
                </div>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-12">
                  {monthlySummary.map((item) => {
                    const height = `${Math.max(14, Math.round((item.total / maxMonthlyTotal) * 100))}%`;
                    return (
                      <div key={item.mes} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="flex h-24 items-end justify-center">
                          <div className="flex w-10 items-end justify-center rounded-t-xl bg-gradient-to-t from-emerald-600 to-cyan-500" style={{ height }} />
                        </div>
                        <div className="mt-3 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                          {item.mes}
                        </div>
                        <div className="mt-1 text-center text-xl font-bold text-slate-900">{item.total}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Demandas por regional</h3>
                      <p className="text-xs text-slate-500">Ranking de volume no ano selecionado.</p>
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {summary?.perRegional.length || 0} regionais
                    </div>
                  </div>
                  <div className="space-y-3">
                    {(summary?.perRegional || [])
                      .slice()
                      .sort((a, b) => Number(b.total || 0) - Number(a.total || 0))
                      .map((item) => {
                        const width = `${Math.max(8, Math.round((Number(item.total || 0) / Math.max(1, totalDemandasAno)) * 100))}%`;
                        return (
                          <div key={item.regional || 'SEM-REGIONAL'} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <div className="mb-2 flex items-center justify-between gap-3 text-[11px] uppercase">
                              <span className="font-semibold text-slate-700">{item.regional || 'Sem regional'}</span>
                              <span className="font-bold text-emerald-700">{item.total}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                              <div className="h-full rounded-full bg-gradient-to-r from-emerald-600 to-cyan-500" style={{ width }} />
                            </div>
                          </div>
                        );
                      })}
                    {!(summary?.perRegional || []).length && (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                        Nenhum indicador encontrado para {ano}.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="mb-4 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Tempo medio de resposta por regional</h3>
                      <p className="text-xs text-slate-500">Media em dias, calculada pelo campo salvo ou pela diferenca entre chegada e conclusao.</p>
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Em dias</div>
                  </div>
                  <div className="space-y-3">
                    {(summary?.perRegional || [])
                      .slice()
                      .sort((a, b) => Number(b.avgTempoResposta ?? -1) - Number(a.avgTempoResposta ?? -1))
                      .map((item) => {
                        const value = Number(item.avgTempoResposta ?? 0);
                        const max = Math.max(
                          1,
                          ...(summary?.perRegional || []).map((entry) => Number(entry.avgTempoResposta ?? 0))
                        );
                        const width = item.avgTempoResposta === null ? '0%' : `${Math.max(8, Math.round((value / max) * 100))}%`;
                        return (
                          <div key={`${item.regional || 'SEM-REGIONAL'}-tempo`} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                            <div className="mb-2 flex items-center justify-between gap-3 text-[11px] uppercase">
                              <span className="font-semibold text-slate-700">{item.regional || 'Sem regional'}</span>
                              <span className="font-bold text-cyan-700">{formatAvgDays(item.avgTempoResposta)}</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                              <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-sky-600" style={{ width }} />
                            </div>
                          </div>
                        );
                      })}
                    {!(summary?.perRegional || []).length && (
                      <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                        Nenhum indicador encontrado para {ano}.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {!loading && rows.length > 0 && (
        <div className="rounded-xl border border-border bg-panel p-3 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <div className="text-muted">
              Mostrando <span className="font-semibold text-text">{rows.length}</span> de{' '}
              <span className="font-semibold text-text">{total.toLocaleString()}</span> demandas
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-panel shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-8 text-muted">
              <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
              <div>Carregando demandas trabalhistas...</div>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-muted">Nenhum registro encontrado</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="bg-bg/50 border-b border-border">
                <tr>
                  {[
                    ['numeroSei', 'Nº SEI'],
                    ['demandante', 'Demandante'],
                    ['tipoDemanda', 'Tipo de demanda'],
                    ['origem', 'Origem'],
                    ['unidade', 'Unidade'],
                    ['regional', 'Regional'],
                    ['dataChegada', 'Data chegada'],
                    ['mesChegada', 'Mês Chegada'],
                    ['anoChegada', 'Ano Chegada'],
                    ['responsavel', 'Responsável'],
                    ['status', 'Status'],
                    ['prazoDias', 'Prazo (dias)'],
                    ['dataLimite', 'Data limite'],
                    ['dataConclusao', 'Data conclusão'],
                    ['mesConclusao', 'Mês Conclusão'],
                    ['destino', 'Destino'],
                    ['statusFinal', 'Status Final'],
                    ['tempoRespostaDias', 'Tempo Resp. (dias)'],
                    ['acoes', 'Ações'],
                  ].map(([key, label]) => (
                    <th
                      key={key}
                      className={`px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase whitespace-nowrap ${
                        key === 'acoes' ? 'cursor-default' : 'cursor-pointer hover:bg-bg/70'
                      }`}
                      onClick={() => key !== 'acoes' && handleSort(key)}
                    >
                      {label} {key !== 'acoes' && sortBy === key && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-bg/30 text-[11px] uppercase">
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {row.numeroSei || '-'}
                    </td>
                    <td className="px-4 py-3 text-center min-w-[220px]">{row.demandante || '-'}</td>
                    <td className="px-4 py-3 text-center min-w-[180px]">{row.tipoDemanda || '-'}</td>
                    <td className="px-4 py-3 text-center">{row.origem || '-'}</td>
                    <td className="px-4 py-3 text-center min-w-[180px]">{row.unidade || '-'}</td>
                    <td className="px-4 py-3 text-center">{row.regional || '-'}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">{formatDate(row.dataChegada)}</td>
                    <td className="px-4 py-3 text-center">{row.mesChegada || '-'}</td>
                    <td className="px-4 py-3 text-center">{row.anoChegada ?? '-'}</td>
                    <td className="px-4 py-3 text-center">{row.responsavel || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {row.status ? (
                        <span
                          className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${getStatusClasses(
                            row.status
                          )}`}
                        >
                          {row.status}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">{row.prazoDias ?? '-'}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">{formatDate(row.dataLimite)}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">{formatDate(row.dataConclusao)}</td>
                    <td className="px-4 py-3 text-center">{row.mesConclusao || '-'}</td>
                    <td className="px-4 py-3 text-center">{row.destino || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      {row.statusFinal ? (
                        <span
                          className={`inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide ${getStatusClasses(
                            row.statusFinal
                          )}`}
                        >
                          {row.statusFinal}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">{row.tempoRespostaDias ?? '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setModalDemanda({
                            open: true,
                            saving: false,
                            row,
                          })
                        }
                        className="inline-flex items-center justify-center rounded-full border border-border bg-panel px-2 py-1 text-[10px] font-medium text-text hover:bg-bg"
                        title="Editar demanda"
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        EDITAR
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-bg/30">
          <div className="text-sm text-muted">
            Total: {total.toLocaleString()} | Página {page} de {pageCount}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1 || loading}
              className="px-3 py-1.5 rounded-lg border border-border bg-panel hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <ChevronLeft className="w-4 h-4 inline" />
            </button>
            <span className="text-sm text-muted">
              {page} / {pageCount}
            </span>
            <button
              onClick={() => setPage(Math.min(pageCount, page + 1))}
              disabled={page >= pageCount || loading}
              className="px-3 py-1.5 rounded-lg border border-border bg-panel hover:bg-bg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              <ChevronRight className="w-4 h-4 inline" />
            </button>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1.5 rounded-lg border border-border bg-panel text-sm"
            >
              <option value={10}>10/página</option>
              <option value={25}>25/página</option>
              <option value={50}>50/página</option>
              <option value={100}>100/página</option>
            </select>
          </div>
        </div>
      </div>

      {modalDemanda.open && modalDemanda.row && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !modalDemanda.saving && setModalDemanda({ open: false, row: null, saving: false })}
        >
          <div
            className="w-full max-w-4xl rounded-2xl border border-border bg-panel shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {modalDemanda.row.id ? 'Editar Demanda Trabalhista' : 'Nova Demanda Trabalhista'}
                </h2>
                <p className="text-xs text-muted mt-1">
                  Preencha os campos principais da demanda. Datas são opcionais.
                </p>
              </div>
              <button
                onClick={() => !modalDemanda.saving && setModalDemanda({ open: false, row: null, saving: false })}
                className="p-2 rounded-lg hover:bg-bg transition-colors"
                title="Fechar"
                type="button"
              >
                <ChevronRight className="w-5 h-5 rotate-90" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted mb-1">Nº SEI</label>
                  <input
                    type="text"
                    value={modalDemanda.row.numeroSei}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, numeroSei: e.target.value.toUpperCase() } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Demandante</label>
                  <input
                    type="text"
                    value={modalDemanda.row.demandante}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, demandante: e.target.value.toUpperCase() } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Tipo de demanda</label>
                  <input
                    type="text"
                    value={modalDemanda.row.tipoDemanda}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, tipoDemanda: e.target.value.toUpperCase() } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Origem</label>
                  <input
                    type="text"
                    value={modalDemanda.row.origem}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, origem: e.target.value.toUpperCase() } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Unidade</label>
                  <input
                    type="text"
                    value={modalDemanda.row.unidade}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, unidade: e.target.value.toUpperCase() } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Regional</label>
                  <input
                    type="text"
                    value={modalDemanda.row.regional}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, regional: e.target.value.toUpperCase() } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Data chegada</label>
                  <input
                    type="date"
                    value={modalDemanda.row.dataChegada ? modalDemanda.row.dataChegada.slice(0, 10) : ''}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, dataChegada: e.target.value || null } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Data limite</label>
                  <input
                    type="date"
                    value={modalDemanda.row.dataLimite ? modalDemanda.row.dataLimite.slice(0, 10) : ''}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, dataLimite: e.target.value || null } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Data de conclusão</label>
                  <input
                    type="date"
                    value={modalDemanda.row.dataConclusao ? modalDemanda.row.dataConclusao.slice(0, 10) : ''}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, dataConclusao: e.target.value || null } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Responsável</label>
                  <input
                    type="text"
                    value={modalDemanda.row.responsavel}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, responsavel: e.target.value.toUpperCase() } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Status</label>
                  <input
                    type="text"
                    value={modalDemanda.row.status}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, status: e.target.value.toUpperCase() } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Status final</label>
                  <input
                    type="text"
                    value={modalDemanda.row.statusFinal}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, statusFinal: e.target.value.toUpperCase() } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Destino</label>
                  <input
                    type="text"
                    value={modalDemanda.row.destino}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, destino: e.target.value.toUpperCase() } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Prazo (dias)</label>
                  <input
                    type="number"
                    value={modalDemanda.row.prazoDias ?? ''}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : {
                              ...prev,
                              row: {
                                ...prev.row,
                                prazoDias: e.target.value ? Number(e.target.value) : null,
                              },
                            }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Tempo de resposta (dias)</label>
                  <input
                    type="number"
                    value={modalDemanda.row.tempoRespostaDias ?? ''}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : {
                              ...prev,
                              row: {
                                ...prev.row,
                                tempoRespostaDias: e.target.value ? Number(e.target.value) : null,
                              },
                            }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-muted mb-1">
                    Observações (só na edição — não aparece na lista)
                  </label>
                  <textarea
                    value={modalDemanda.row.observacoes}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, observacoes: e.target.value.toUpperCase() } }
                      )
                    }
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60 resize-y"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border bg-card px-6 py-4 flex items-center justify-between">
              <div className="text-xs text-muted">
                Campos em branco serão salvos como vazios (não obrigatórios).
              </div>
              <button
                type="button"
                disabled={modalDemanda.saving}
                onClick={async () => {
                  if (!modalDemanda.row) return;
                  setModalDemanda((prev) => ({ ...prev, saving: true }));
                  try {
                    await fetchJSON('/api/demandas-trabalhistas/save', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        id: modalDemanda.row.id || null,
                        numeroSei: modalDemanda.row.numeroSei,
                        demandante: modalDemanda.row.demandante,
                        tipoDemanda: modalDemanda.row.tipoDemanda,
                        origem: modalDemanda.row.origem,
                        unidade: modalDemanda.row.unidade,
                        regional: modalDemanda.row.regional,
                        dataChegada: modalDemanda.row.dataChegada,
                        dataLimite: modalDemanda.row.dataLimite,
                        dataConclusao: modalDemanda.row.dataConclusao,
                        responsavel: modalDemanda.row.responsavel,
                        status: modalDemanda.row.status,
                        statusFinal: modalDemanda.row.statusFinal,
                        destino: modalDemanda.row.destino,
                        prazoDias: modalDemanda.row.prazoDias,
                        tempoRespostaDias: modalDemanda.row.tempoRespostaDias,
                        observacoes: modalDemanda.row.observacoes,
                        mesConclusao: modalDemanda.row.mesConclusao,
                      }),
                    });
                    setModalDemanda({ open: false, row: null, saving: false });
                    await loadData();
                  } catch (e) {
                    console.error('Erro ao salvar demanda:', e);
                    setModalDemanda((prev) => ({ ...prev, saving: false }));
                  }
                }}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {modalDemanda.saving && (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
