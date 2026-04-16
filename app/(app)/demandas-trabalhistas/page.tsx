'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, RefreshCw, Download, ChevronLeft, ChevronRight, Edit2, Plus, Columns2 } from 'lucide-react';

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

/** Ano de chegada padrão: só muda se o usuário selecionar outro ano no filtro. */
const ANO_CHEGADA_PADRAO = '2026';

/** Tipos oficiais exibidos no painel (comparação ignora maiúsculas/acentos). */
const TIPOS_DEMANDA_ORDEM = [
  'Fiscalização',
  'Ouvidoria',
  'Parecer Insalubridade',
  'Parecer Periculosidade',
  'Pericia Trabalhista',
  'PPP',
  'Processo Trabalhista',
] as const;

function normTipoDemandaKey(s: string) {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}
type ColId =
  | 'numeroSei'
  | 'demandante'
  | 'tipoDemanda'
  | 'origem'
  | 'unidade'
  | 'regional'
  | 'dataChegada'
  | 'mesChegada'
  | 'anoChegada'
  | 'responsavel'
  | 'status'
  | 'prazoDias'
  | 'dataLimite'
  | 'dataConclusao'
  | 'mesConclusao'
  | 'destino'
  | 'statusFinal'
  | 'tempoRespostaDias';

const COLS_LS = 'emserh-demandas-cols-v1';
const MATRIX_MONTH_LS = 'emserh-demandas-matrix-months-v1';

function defaultMatrixMonthVis(): Record<number, boolean> {
  const v: Record<number, boolean> = {};
  for (let i = 1; i <= 12; i += 1) v[i] = true;
  return v;
}

function loadMatrixMonthVis(): Record<number, boolean> {
  const base = defaultMatrixMonthVis();
  if (typeof window === 'undefined') return base;
  try {
    const raw = localStorage.getItem(MATRIX_MONTH_LS);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    for (let i = 1; i <= 12; i += 1) {
      if (parsed[String(i)] !== undefined) base[i] = Boolean(parsed[String(i)]);
    }
    return base;
  } catch {
    return base;
  }
}
const COL_DEFS: { id: ColId; label: string }[] = [
  { id: 'numeroSei', label: 'Nº SEI' },
  { id: 'demandante', label: 'Demandante' },
  { id: 'tipoDemanda', label: 'Tipo de demanda' },
  { id: 'origem', label: 'Origem' },
  { id: 'unidade', label: 'Unidade' },
  { id: 'regional', label: 'Regional' },
  { id: 'dataChegada', label: 'Data chegada' },
  { id: 'mesChegada', label: 'Mês Chegada' },
  { id: 'anoChegada', label: 'Ano Chegada' },
  { id: 'responsavel', label: 'Responsável' },
  { id: 'status', label: 'Status' },
  { id: 'prazoDias', label: 'Prazo (dias)' },
  { id: 'dataLimite', label: 'Data limite' },
  { id: 'dataConclusao', label: 'Data conclusão' },
  { id: 'mesConclusao', label: 'Mês Conclusão' },
  { id: 'destino', label: 'Destino' },
  { id: 'statusFinal', label: 'Status Final' },
  { id: 'tempoRespostaDias', label: 'Tempo Resp. (dias)' },
];

function defaultColVisibility(): Record<ColId, boolean> {
  const v = {} as Record<ColId, boolean>;
  for (const c of COL_DEFS) v[c.id] = true;
  return v;
}

function loadColVisibility(): Record<ColId, boolean> {
  const base = defaultColVisibility();
  if (typeof window === 'undefined') return base;
  try {
    const raw = localStorage.getItem(COLS_LS);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Record<ColId, boolean>>;
    return { ...base, ...parsed };
  } catch {
    return base;
  }
}

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
  if (value === null || value === undefined) return '—';
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(1);
}

/** Reforço no client caso o JSON ainda traga string/Decimal em algum ambiente. */
function parseAvgFromApi(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function TableHorizontalScroll({ children, depsKey }: { children: React.ReactNode; depsKey: string }) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [innerW, setInnerW] = useState(0);
  const [showTopBar, setShowTopBar] = useState(false);

  const measure = useCallback(() => {
    const el = bottomRef.current;
    if (!el) return;
    const w = el.scrollWidth;
    setInnerW(w);
    setShowTopBar(w > el.clientWidth + 2);
  }, []);

  useEffect(() => {
    measure();
    const el = bottomRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure, depsKey]);

  const onBottomScroll = () => {
    const b = bottomRef.current;
    const t = topRef.current;
    if (!b || !t || t.scrollLeft === b.scrollLeft) return;
    t.scrollLeft = b.scrollLeft;
  };

  const onTopScroll = () => {
    const b = bottomRef.current;
    const t = topRef.current;
    if (!b || !t || b.scrollLeft === t.scrollLeft) return;
    b.scrollLeft = t.scrollLeft;
  };

  return (
    <div className="relative">
      {showTopBar ? (
        <div
          className="mb-0 overflow-x-auto overflow-y-hidden rounded-t-none border-b border-border/70 bg-muted/20 [scrollbar-color:rgba(0,0,0,0.35)_transparent] dark:[scrollbar-color:rgba(255,255,255,0.35)_transparent]"
          onScroll={onTopScroll}
          ref={topRef}
          role="presentation"
          aria-hidden
        >
          <div style={{ width: innerW, height: 1 }} />
        </div>
      ) : null}
      <p className="sr-only" id="demandas-table-hscroll-hint">
        A tabela é larga: use a barra de rolagem logo acima ou abaixo dela para ver todas as colunas.
      </p>
      <div
        ref={bottomRef}
        className="overflow-x-auto"
        onScroll={onBottomScroll}
        aria-describedby={showTopBar ? 'demandas-table-hscroll-hint' : undefined}
      >
        {children}
      </div>
    </div>
  );
}

export default function DemandasTrabalhistasPage() {
  const [regional, setRegional] = useState('');
  const [unidade, setUnidade] = useState('');
  const [status, setStatus] = useState('');
  const [statusFinal, setStatusFinal] = useState('');
  // filtros simplificados (sem tipoDemanda e responsável)
  const [ano, setAno] = useState<string>(ANO_CHEGADA_PADRAO);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('dataChegada');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [colVis, setColVis] = useState<Record<ColId, boolean>>(() => defaultColVisibility());
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const [matrixMonthVis, setMatrixMonthVis] = useState<Record<number, boolean>>(() => defaultMatrixMonthVis());
  const [matrixMonthPickerOpen, setMatrixMonthPickerOpen] = useState(false);

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState<{
    perRegional: { regional: string; total: number; avgTempoResposta: number | null }[];
    perMonth: { mesNumero: number; mes: string; total: number }[];
    perRegionalMonth: { regional: string; mesNumero: number; total: number; avgTempoResposta: number | null }[];
    perTipoDemanda: { tipoDemanda: string; total: number }[];
    avgTempoRespostaGeral: number | null;
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
    setColVis(loadColVisibility());
    setMatrixMonthVis(loadMatrixMonthVis());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(COLS_LS, JSON.stringify(colVis));
    } catch {
      // ignore
    }
  }, [colVis]);

  useEffect(() => {
    try {
      localStorage.setItem(MATRIX_MONTH_LS, JSON.stringify(matrixMonthVis));
    } catch {
      // ignore
    }
  }, [matrixMonthVis]);

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
      params.set('ano', ano || ANO_CHEGADA_PADRAO);
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
      params.set('ano', ano || ANO_CHEGADA_PADRAO);

      const data = await fetchJSON<{
        perRegional: { regional: string; total: number; avgTempoResposta: number | null }[];
        perMonth: { mesNumero: number; mesLabel?: string; total: number }[];
        perRegionalMonth: { regional: string; mesNumero: number; total: number; avgTempoResposta: number | null }[];
        perTipoDemanda: { tipoDemanda: string; total: number }[];
        avgTempoRespostaGeral?: number | null;
      }>(`/api/demandas-trabalhistas/summary?${params.toString()}`);

      setSummary({
        perRegional: Array.isArray(data.perRegional)
          ? data.perRegional.map((r) => ({
              ...r,
              avgTempoResposta: parseAvgFromApi(r.avgTempoResposta),
            }))
          : [],
        perMonth: Array.isArray(data.perMonth)
          ? data.perMonth.map((item) => ({
              mesNumero: Number(item.mesNumero),
              mes: MONTH_LABELS[Math.max(0, Number(item.mesNumero) - 1)] || '',
              total: Number(item.total || 0),
            }))
          : [],
        perRegionalMonth: Array.isArray(data.perRegionalMonth)
          ? data.perRegionalMonth.map((item) => ({
              regional: item.regional,
              mesNumero: Number(item.mesNumero),
              total: Number(item.total || 0),
              avgTempoResposta: parseAvgFromApi(item.avgTempoResposta),
            }))
          : [],
        perTipoDemanda: Array.isArray(data.perTipoDemanda) ? data.perTipoDemanda : [],
        avgTempoRespostaGeral: parseAvgFromApi(data.avgTempoRespostaGeral),
      });
    } catch (error) {
      console.error('Erro ao carregar resumo das demandas trabalhistas:', error);
      setSummary({
        perRegional: [],
        perMonth: [],
        perRegionalMonth: [],
        perTipoDemanda: [],
        avgTempoRespostaGeral: null,
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
  const matrixRows = useMemo(() => {
    const cellMap = new Map<string, Map<number, { total: number; avgTempoResposta: number | null }>>();
    for (const item of summary?.perRegionalMonth || []) {
      const r = (item.regional || '').trim() || 'SEM REGIONAL';
      if (!cellMap.has(r)) cellMap.set(r, new Map());
      cellMap.get(r)!.set(Number(item.mesNumero), {
        total: Number(item.total || 0),
        avgTempoResposta:
          item.avgTempoResposta === null || item.avgTempoResposta === undefined
            ? null
            : Number(item.avgTempoResposta),
      });
    }
    const fromAgg = (summary?.perRegional || []).map((x) => (x.regional || '').trim() || 'SEM REGIONAL');
    const fromCells = Array.from(cellMap.keys());
    const regionals = Array.from(new Set([...fromAgg, ...fromCells])).sort((a, b) =>
      a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
    );
    return regionals.map((regional) => ({
      regional,
      months: MONTH_LABELS.map((_, i) => {
        const m = i + 1;
        const cell = cellMap.get(regional)?.get(m);
        return cell ?? { total: 0, avgTempoResposta: null };
      }),
    }));
  }, [summary]);

  const demandasPorTipoPainel = useMemo(() => {
    const porRotulo = new Map<string, number>();
    for (const t of TIPOS_DEMANDA_ORDEM) porRotulo.set(t, 0);
    const normParaRotulo = new Map<string, (typeof TIPOS_DEMANDA_ORDEM)[number]>();
    for (const t of TIPOS_DEMANDA_ORDEM) normParaRotulo.set(normTipoDemandaKey(t), t);

    let outros = 0;
    for (const row of summary?.perTipoDemanda || []) {
      const total = Number(row.total || 0);
      const n = normTipoDemandaKey(String(row.tipoDemanda ?? ''));
      if (!n) {
        outros += total;
        continue;
      }
      const rotulo = normParaRotulo.get(n);
      if (rotulo) porRotulo.set(rotulo, (porRotulo.get(rotulo) || 0) + total);
      else outros += total;
    }

    const lista = TIPOS_DEMANDA_ORDEM.map((label) => ({ label, total: porRotulo.get(label) ?? 0 }));
    return { lista, outros };
  }, [summary]);

  const totalDemandasAno = useMemo(
    () => (summary?.perRegional || []).reduce((acc, item) => acc + Number(item.total || 0), 0),
    [summary]
  );
  const tempoMedioGeral = summary?.avgTempoRespostaGeral ?? null;

  const anosChegadaSelect = useMemo(() => {
    const set = new Set<number>([Number(ANO_CHEGADA_PADRAO), ...(options.anosChegada || [])]);
    return Array.from(set)
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => b - a);
  }, [options.anosChegada]);
  const regionalLider = useMemo(() => {
    const list = summary?.perRegional || [];
    if (!list.length) return null;
    return [...list].sort((a, b) => Number(b.total || 0) - Number(a.total || 0))[0];
  }, [summary]);
  const summaryMatrixScrollDeps = useMemo(
    () =>
      JSON.stringify({
        matrixRows: matrixRows.length,
        months: matrixMonthVis,
      }),
    [matrixRows.length, matrixMonthVis]
  );
  const tableScrollDeps = useMemo(
    () =>
      JSON.stringify({
        loading,
        rows: rows.length,
        cols: COL_DEFS.filter((c) => colVis[c.id] !== false).map((c) => c.id),
      }),
    [loading, rows.length, colVis]
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
    setAno(ANO_CHEGADA_PADRAO);
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
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Quantidade de processos (total)
                  </div>
                  <div className="mt-2 text-4xl font-bold text-slate-900">{totalDemandasAno}</div>
                  <div className="mt-2 text-xs text-slate-600">
                    Soma das demandas no ano {ano} (mesmos filtros da lista), todas as regionais.
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-cyan-50 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Tempo medio de resposta geral
                  </div>
                  <div className="mt-2 text-4xl font-bold text-slate-900">{formatAvgDays(tempoMedioGeral)}</div>
                  <div className="mt-2 text-xs text-slate-600">
                    Media dos dias de todos os processos do recorte (coluna Tempo de Resposta ou chegada a conclusao).
                    Registros sem dias calculaveis nao entram na media.
                  </div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-amber-50 p-4">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Regional com maior volume</div>
                  <div className="mt-2 text-2xl font-bold text-slate-900">{regionalLider?.regional || 'SEM DADOS'}</div>
                  <div className="mt-2 text-sm font-semibold text-amber-700">
                    {regionalLider ? `${regionalLider.total} processos` : 'Sem registros no ano'}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-slate-900">Por regional</h3>
                {(summary?.perRegional || []).length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum registro para montar o resumo por regional.</p>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="w-full min-w-[420px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-left">
                          <th className="px-3 py-2 font-semibold text-slate-700">Regional</th>
                          <th className="px-3 py-2 font-semibold text-slate-700">Quantidade de processos</th>
                          <th className="px-3 py-2 font-semibold text-slate-700">Tempo medio de resposta (dias)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {[...(summary?.perRegional || [])]
                          .sort((a, b) =>
                            String(a.regional || '').localeCompare(String(b.regional || ''), 'pt-BR', {
                              sensitivity: 'base',
                            })
                          )
                          .map((row) => (
                            <tr key={String(row.regional)} className="hover:bg-slate-50/80">
                              <td className="px-3 py-2 font-medium text-slate-900">
                                {(row.regional || '').trim() || 'SEM REGIONAL'}
                              </td>
                              <td className="px-3 py-2 tabular-nums text-slate-800">{Number(row.total || 0)}</td>
                              <td className="px-3 py-2 tabular-nums text-slate-800">
                                {formatAvgDays(row.avgTempoResposta)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-slate-900">Demandas por tipo</h3>
                  <p className="mt-1 text-xs text-slate-600">
                    Quantidade no ano {ano}, conforme o campo <span className="font-medium">Tipo de demanda</span> na
                    base (mesmos filtros do painel).
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                  {demandasPorTipoPainel.lista.map((item) => (
                    <div
                      key={item.label}
                      className="flex flex-col rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white px-3 py-3 text-center shadow-sm"
                    >
                      <span className="text-[10px] font-semibold uppercase leading-tight text-slate-600 [word-break:break-word]">
                        {item.label}
                      </span>
                      <span className="mt-2 text-2xl font-bold tabular-nums text-emerald-700">{item.total}</span>
                      <span className="text-[9px] font-medium normal-case text-slate-500">demandas</span>
                    </div>
                  ))}
                </div>
                {demandasPorTipoPainel.outros > 0 ? (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                    <span className="font-semibold">Outros tipos ou sem tipo: </span>
                    <span className="tabular-nums font-bold">{demandasPorTipoPainel.outros}</span>
                    <span className="text-amber-900/90"> demandas</span>
                    <span className="mt-1 block text-xs font-normal text-amber-900/80">
                      Valores que não batem exatamente com os tipos listados acima (inclui variações de texto ou campo
                      vazio).
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Regional × mês (Jan a Dez)</h3>
                    <p className="mt-1 max-w-2xl text-xs text-slate-600">
                      O <span className="font-medium">mês</span> da coluna é o mês da{' '}
                      <span className="font-medium">data de chegada</span> (no ano filtrado). Para cada processo, o tempo
                      em dias usa primeiro a coluna <span className="font-medium">Tempo de Resposta (dias)</span>; se
                      estiver vazio, calcula pelos dias entre <span className="font-medium">chegada</span> e{' '}
                      <span className="font-medium">conclusão</span>. A{' '}
                      <span className="font-medium">média do mês</span> é a média aritmética desses dias entre os
                      processos da célula (só entram na média os que têm dias calculáveis). Sem média: &quot;—&quot;.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Base {ano}</span>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setMatrixMonthPickerOpen((o) => !o)}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 shadow-sm hover:bg-slate-50"
                      >
                        <Columns2 className="h-4 w-4" aria-hidden />
                        Meses visíveis
                      </button>
                      {matrixMonthPickerOpen ? (
                        <>
                          <button
                            type="button"
                            className="fixed inset-0 z-30 cursor-default bg-transparent"
                            aria-label="Fechar menu de meses"
                            onClick={() => setMatrixMonthPickerOpen(false)}
                          />
                          <div className="absolute right-0 z-40 mt-1 max-h-72 w-52 overflow-y-auto rounded-xl border border-slate-200 bg-white py-2 shadow-lg">
                            <p className="border-b border-slate-200 px-3 pb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                              Marque o mês
                            </p>
                            {MONTH_LABELS.map((label, i) => {
                              const m = i + 1;
                              return (
                                <label
                                  key={m}
                                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-slate-50"
                                >
                                  <input
                                    type="checkbox"
                                    checked={matrixMonthVis[m] !== false}
                                    onChange={() =>
                                      setMatrixMonthVis((prev) => ({
                                        ...prev,
                                        [m]: !(prev[m] !== false),
                                      }))
                                    }
                                  />
                                  {label}
                                </label>
                              );
                            })}
                            <div className="flex flex-col gap-1 border-t border-slate-200 px-3 pt-2">
                              <button
                                type="button"
                                className="text-left text-xs font-medium text-emerald-700 hover:underline"
                                onClick={() => setMatrixMonthVis(defaultMatrixMonthVis())}
                              >
                                Mostrar todos os meses
                              </button>
                            </div>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>

                {matrixRows.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500">
                    Nenhum dado para montar a matriz no ano {ano}.
                  </div>
                ) : (
                  <TableHorizontalScroll depsKey={summaryMatrixScrollDeps}>
                    <table className="w-full min-w-[900px] border-collapse text-[10px] uppercase">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="sticky left-0 z-20 min-w-[120px] max-w-[180px] border-r border-slate-200 bg-slate-50 px-2 py-2 text-left text-[10px] font-semibold tracking-wide text-slate-600 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.12)]">
                            Regional
                          </th>
                          {MONTH_LABELS.map((label, i) => {
                            const m = i + 1;
                            if (matrixMonthVis[m] === false) return null;
                            return (
                              <th
                                key={m}
                                className="min-w-[76px] border-l border-slate-200 px-1 py-2 text-center text-[10px] font-semibold tracking-wide text-slate-600"
                              >
                                {label}
                              </th>
                            );
                          })}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {matrixRows.map((row) => (
                          <tr key={row.regional} className="hover:bg-slate-50/90">
                            <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-2 py-1.5 align-middle text-left text-[10px] font-semibold leading-snug text-slate-800 shadow-[4px_0_12px_-4px_rgba(0,0,0,0.08)] [word-break:break-word] whitespace-normal">
                              {row.regional}
                            </td>
                            {row.months.map((cell, i) => {
                              const m = i + 1;
                              if (matrixMonthVis[m] === false) return null;
                              const semMedia =
                                cell.avgTempoResposta === null || cell.avgTempoResposta === undefined;
                              return (
                                <td
                                  key={m}
                                  className="border-l border-slate-100 px-1 py-1.5 align-middle text-center"
                                >
                                  <div
                                    className="mx-auto max-w-[5.5rem] rounded-md border border-slate-200 bg-slate-50/90 px-1 py-1 leading-tight"
                                    title={
                                      semMedia
                                        ? 'Sem tempo calculável: preencha data de conclusão ou tempo de resposta nos registros deste recorte.'
                                        : undefined
                                    }
                                  >
                                    <p className="tabular-nums">
                                      <span className="text-sm font-bold text-emerald-700">{cell.total}</span>
                                      <span className="text-slate-400"> · </span>
                                      <span className="text-xs font-semibold text-cyan-800">
                                        {formatAvgDays(cell.avgTempoResposta)}
                                      </span>
                                    </p>
                                    <p className="mt-0.5 text-[8px] font-medium normal-case leading-none text-slate-500">
                                      qtd · dias méd.
                                    </p>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableHorizontalScroll>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-panel p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold text-muted uppercase tracking-wide px-2">
            Filtros (padrao ano {ANO_CHEGADA_PADRAO})
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
              value={ano || ANO_CHEGADA_PADRAO}
              onChange={(e) => {
                setAno(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {anosChegadaSelect.map((item) => (
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

        {(regional || unidade || status || statusFinal || search || ano !== ANO_CHEGADA_PADRAO) && (
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
        <div className="flex flex-wrap items-center justify-end gap-3 border-b border-border bg-bg/40 px-4 py-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setColPickerOpen((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-text hover:bg-bg"
            >
              <Columns2 className="h-4 w-4" />
              Colunas visíveis
            </button>
            {colPickerOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-30 cursor-default bg-transparent"
                  aria-label="Fechar menu de colunas"
                  onClick={() => setColPickerOpen(false)}
                />
                <div className="absolute right-0 z-40 mt-1 max-h-80 w-56 overflow-y-auto rounded-xl border border-border bg-panel py-2 shadow-lg">
                  <p className="border-b border-border px-3 pb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Marque para exibir
                  </p>
                  {COL_DEFS.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/30">
                      <input
                        type="checkbox"
                        checked={colVis[c.id] !== false}
                        onChange={() => setColVis((prev) => ({ ...prev, [c.id]: !(prev[c.id] !== false) }))}
                      />
                      {c.label}
                    </label>
                  ))}
                  <div className="flex flex-col gap-1 border-t border-border px-3 pt-2">
                    <button
                      type="button"
                      className="text-left text-xs font-medium text-emerald-600 hover:underline"
                      onClick={() => setColVis(defaultColVisibility())}
                    >
                      Mostrar layout padrão
                    </button>
                    <button
                      type="button"
                      className="text-left text-xs font-medium text-muted hover:text-text"
                      onClick={() => {
                        const all = {} as Record<ColId, boolean>;
                        for (const c of COL_DEFS) all[c.id] = true;
                        setColVis(all);
                      }}
                    >
                      Mostrar todas as colunas
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
        <TableHorizontalScroll depsKey={tableScrollDeps}>
          {loading ? (
            <div className="text-center py-8 text-muted">
              <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
              <div>Carregando demandas trabalhistas...</div>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-muted">Nenhum registro encontrado</div>
          ) : (
            <table className="w-full min-w-[2350px] text-[11px]">
              <thead className="bg-bg/50 border-b border-border">
                <tr>
                  {COL_DEFS.filter((c) => colVis[c.id] !== false).map((col) => (
                    <th
                      key={col.id}
                      className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase whitespace-nowrap cursor-pointer hover:bg-bg/70"
                      onClick={() => handleSort(col.id)}
                    >
                      {col.label} {sortBy === col.id && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-bg/30 text-[11px] uppercase">
                    {colVis.numeroSei !== false && (
                      <td className="px-4 py-3 align-top text-center whitespace-nowrap min-w-[170px]">{row.numeroSei || '-'}</td>
                    )}
                    {colVis.demandante !== false && (
                      <td className="px-4 py-3 align-top text-center min-w-[220px] max-w-[22rem] whitespace-normal break-words leading-snug [word-break:break-word]">
                        {row.demandante || '-'}
                      </td>
                    )}
                    {colVis.tipoDemanda !== false && (
                      <td className="px-4 py-3 align-top text-center min-w-[200px] max-w-[20rem] whitespace-normal break-words leading-snug [word-break:break-word]">
                        {row.tipoDemanda || '-'}
                      </td>
                    )}
                    {colVis.origem !== false && (
                      <td className="px-4 py-3 align-top text-center min-w-[180px] max-w-[20rem] whitespace-normal break-words leading-snug [word-break:break-word]">
                        {row.origem || '-'}
                      </td>
                    )}
                    {colVis.unidade !== false && (
                      <td className="px-4 py-3 align-top text-center min-w-[240px] max-w-[24rem] whitespace-normal break-words leading-snug [word-break:break-word]">
                        {row.unidade || '-'}
                      </td>
                    )}
                    {colVis.regional !== false && (
                      <td className="px-4 py-3 align-top text-center min-w-[170px] max-w-[16rem] whitespace-normal break-words leading-snug [word-break:break-word]">
                        {row.regional || '-'}
                      </td>
                    )}
                    {colVis.dataChegada !== false && (
                      <td className="px-4 py-3 align-top text-center whitespace-nowrap min-w-[140px]">{formatDate(row.dataChegada)}</td>
                    )}
                    {colVis.mesChegada !== false && (
                      <td className="px-4 py-3 align-top text-center min-w-[150px] whitespace-nowrap">{row.mesChegada || '-'}</td>
                    )}
                    {colVis.anoChegada !== false && (
                      <td className="px-4 py-3 align-top text-center min-w-[140px] whitespace-nowrap">{row.anoChegada ?? '-'}</td>
                    )}
                    {colVis.responsavel !== false && (
                      <td className="px-4 py-3 align-top text-center min-w-[200px] max-w-[20rem] whitespace-normal break-words leading-snug [word-break:break-word]">
                        {row.responsavel || '-'}
                      </td>
                    )}
                    {colVis.status !== false && (
                      <td className="px-4 py-3 align-top text-center min-w-[140px] max-w-[16rem]">
                        {row.status ? (
                          <span
                            className={`inline-flex max-w-full flex-wrap items-center justify-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold tracking-wide [word-break:break-word] ${getStatusClasses(
                              row.status
                            )}`}
                          >
                            {row.status}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    )}
                    {colVis.prazoDias !== false && (
                      <td className="px-4 py-3 align-top text-center min-w-[140px] whitespace-nowrap">{row.prazoDias ?? '-'}</td>
                    )}
                    {colVis.dataLimite !== false && (
                      <td className="px-4 py-3 align-top text-center whitespace-nowrap min-w-[140px]">{formatDate(row.dataLimite)}</td>
                    )}
                    {colVis.dataConclusao !== false && (
                      <td className="px-4 py-3 align-top text-center whitespace-nowrap min-w-[160px]">{formatDate(row.dataConclusao)}</td>
                    )}
                    {colVis.mesConclusao !== false && (
                      <td className="px-4 py-3 align-top text-center min-w-[160px] whitespace-nowrap">{row.mesConclusao || '-'}</td>
                    )}
                    {colVis.destino !== false && (
                      <td className="px-4 py-3 align-top text-center min-w-[200px] max-w-[22rem] whitespace-normal break-words leading-snug [word-break:break-word]">
                        {row.destino || '-'}
                      </td>
                    )}
                    {colVis.statusFinal !== false && (
                      <td className="px-4 py-3 align-top text-center min-w-[140px] max-w-[16rem]">
                        {row.statusFinal ? (
                          <span
                            className={`inline-flex max-w-full flex-wrap items-center justify-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold tracking-wide [word-break:break-word] ${getStatusClasses(
                              row.statusFinal
                            )}`}
                          >
                            {row.statusFinal}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                    )}
                    {colVis.tempoRespostaDias !== false && (
                      <td className="px-4 py-3 align-top text-center min-w-[180px] whitespace-nowrap">{row.tempoRespostaDias ?? '-'}</td>
                    )}
                    <td className="px-4 py-3 align-middle text-center whitespace-nowrap">
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
        </TableHorizontalScroll>

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
