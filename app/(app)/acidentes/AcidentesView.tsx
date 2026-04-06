'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { REGIONALS } from '@/lib/unidReg';
import {
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ClipboardList,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Filter,
  FolderOpen,
  LayoutDashboard,
  Plus,
  Search,
  ShieldAlert,
  Table2,
  TrendingUp,
  X,
} from 'lucide-react';

type AcidenteRow = {
  id: string;
  nome: string;
  empresa: 'IADVH' | 'EMSERH';
  unidadeHospitalar: string;
  regional: string | null;
  tipo: string;
  comAfastamento: boolean;
  data: string;
  hora: string | null;
  mes: number;
  ano: number;
  numeroCAT: string | null;
  riat: string | null;
  sinan: string | null;
  status: string;
  descricao: string | null;
  setor?: string | null;
  funcaoTrabalhador?: string | null;
  tipoVinculo?: string | null;
  causaImediata?: string | null;
  causaRaiz?: string | null;
  fatoresContrib?: string | null;
  hasInvestigacao?: boolean;
};

type StatsData = {
  totalAno: number;
  totalMes: number;
  porRegional: Array<{ regional: string; quantidade: number }>;
  porTipo: Array<{ tipo: string; quantidade: number }>;
  porUnidade: Array<{ unidade: string; quantidade: number }>;
  porMes: Record<string, number>;
  porStatus: Array<{ status: string; quantidade: number }>;
  comAfastamento: number;
  semAfastamento: number;
  totalInvestigados?: number;
  porRegionalInvestigados?: Array<{ regional: string; quantidade: number }>;
  porTipoInvestigados?: Array<{ tipo: string; quantidade: number }>;
};

type MetaRealData = {
  meta: number;
  real: Record<string, number>;
  total: number;
  ano: number;
};

type PainelIndicadoresData = {
  ano: number;
  taxaFrequenciaAnualEmserh: number | null;
  totalAcidentesAno: number;
  acidentesPorRegional: Record<string, number>;
  investigadosNoAno: number;
  investigadosPorRegional: Record<string, number>;
  aderenciaPlanoAcaoPercent: number | null;
  aderenciaPorRegional: Record<string, number | null>;
  unidadesDivulgacaoProgramasLegaisPercent: number | null;
  divulgacaoProgramasLegaisPorRegional: Record<string, number | null>;
  notaAderencia?: string;
  notaDivulgacao?: string;
  fonteAtivosTF?: string;
};

async function fetchJSON<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { cache: 'no-store', ...init });
  const data = await r.json();
  if (!r.ok) {
    throw new Error((data && (data.error || data.message)) || 'Erro ao carregar dados');
  }
  return data as T;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('pt-BR');
}

function formatDateTime(iso: string | null | undefined, hora: string | null | undefined) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  const dateStr = d.toLocaleDateString('pt-BR');
  return hora ? `${dateStr} ${hora}` : dateStr;
}

function toInputDate(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const TIPOS_ACIDENTE = [
  { value: 'biologico', label: 'Exposição a material biológico / Perfurocortante' },
  { value: 'trajeto', label: 'Acidente de Trânsito / Trajeto' },
  { value: 'tipico', label: 'Acidente Típico' },
  { value: 'de_trabalho', label: 'Acidente de Trabalho' },
  { value: 'outros', label: 'Outros' },
];

const STATUS_ACIDENTE = [
  { value: 'aberto', label: 'Aberto' },
  { value: 'em_analise', label: 'Em Análise' },
  { value: 'concluido', label: 'Concluído' },
  { value: 'cancelado', label: 'Cancelado' },
];

const LS_REGIONAL_KEY = 'acidentes:regional';

/** Pasta do Google Drive onde as RIAT preenchidas são armazenadas */
const RIAT_GOOGLE_DRIVE_FOLDER_URL =
  'https://drive.google.com/drive/folders/1ULAaRsKcD0vXqMocTaITcBupLUD5kCse';

/** Chave estável do acidente (planilha) para vincular investigação */
function acidenteRef(row: AcidenteRow): string {
  const cat = (row.numeroCAT || '').trim();
  const data = (row.data || '').toString().replace(/T.*$/, '');
  const nome = (row.nome || '').trim();
  return `${cat}|${data}|${nome}`;
}

type InvestigacaoForm = {
  statusInvestigacao: string;
  riatUrl: string;
  riatNome: string;
  catUrl: string;
  catNome: string;
  sinanUrl: string;
  sinanNome: string;
  observacoes: string;
};

export default function AcidentesView() {
  // Filtros
  const [regional, setRegional] = useState<string>('');
  const [unidade, setUnidade] = useState<string>('');
  const [tipo, setTipo] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [empresa, setEmpresa] = useState<string>('');
  const [ano, setAno] = useState<string>('todos');
  const [mes, setMes] = useState<string>('');
  const [q, setQ] = useState<string>('');

  // Dados
  const [rows, setRows] = useState<AcidenteRow[]>([]);
  const [listKey, setListKey] = useState(0);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  // Opções
  const [opts, setOpts] = useState<{ regionais: string[]; unidades: Array<{ unidade: string; regional: string }> }>({
    regionais: [],
    unidades: [],
  });

  // Lançamento manual removido (agora é SOMENTE LEITURA via planilha no Neon).

  // Detalhes expandidos
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Investigação do acidente (RIAT, CAT, SINAN)
  const [investigacaoRow, setInvestigacaoRow] = useState<AcidenteRow | null>(null);
  const [investigacaoForm, setInvestigacaoForm] = useState<InvestigacaoForm>({
    statusInvestigacao: '',
    riatUrl: '',
    riatNome: '',
    catUrl: '',
    catNome: '',
    sinanUrl: '',
    sinanNome: '',
    observacoes: '',
  });
  const [investigacaoLoading, setInvestigacaoLoading] = useState(false);
  const [investigacaoSaving, setInvestigacaoSaving] = useState(false);
  const [investigacaoRiatDownloading, setInvestigacaoRiatDownloading] = useState(false);

  // Visão Geral
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const [painelAno, setPainelAno] = useState(String(new Date().getFullYear()));
  const [painelData, setPainelData] = useState<PainelIndicadoresData | null>(null);
  const [painelLoading, setPainelLoading] = useState(false);

  // Taxa de Frequência (TF) - edição anual (12 meses)
  const [tfAno, setTfAno] = useState<string>(String(new Date().getFullYear() - 1));
  const [tfAnosComDados, setTfAnosComDados] = useState<number[]>([]);
  const [tfLoading, setTfLoading] = useState(false);
  const [tfMeses, setTfMeses] = useState<Record<string, { ativos: string; accidentes: string; horas: string; tf: string }>>(() => {
    const base: any = {};
    ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].forEach((m) => {
      base[m] = { ativos: '', accidentes: '', horas: '', tf: '--' };
    });
    return base;
  });
  const [tfSavingAtivos, setTfSavingAtivos] = useState(false);
  const [tfFonteAtivos, setTfFonteAtivos] = useState<'alterdata' | 'manual' | null>(null);

  useEffect(() => {
    setTfLoading(true);
    const params = new URLSearchParams();
    params.set('ano', tfAno);
    if (regional) params.set('regional', regional);
    fetchJSON<{ registros: any[]; fonteAtivos?: 'alterdata' | 'manual'; anosComDados?: number[] }>('/api/acidentes/taxa-frequencia?' + params.toString())
      .then((d) => {
        setTfFonteAtivos(d.fonteAtivos ?? null);
        setTfAnosComDados(d.anosComDados ?? []);
        const base: any = {};
        ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].forEach((m) => {
          base[m] = { ativos: '', accidentes: '', horas: '', tf: '--' };
        });
        let totalAcidentesNoAno = 0;
        (d.registros || []).forEach((r: any) => {
          const mesKey = String(Number(r.mes)).padStart(2, '0');
          const ativos = r.ativos != null ? String(r.ativos) : '';
          const numAcidentes = r.numeroAcidentes ?? r.numero_acidentes ?? 0;
          const acidentes = String(numAcidentes);
          totalAcidentesNoAno += Number(numAcidentes) || 0;
          const horas =
            r.horasHomemTrabalhadas != null
              ? String(r.horasHomemTrabalhadas)
              : '';
          const tf =
            r.taxaFrequencia != null
              ? Number(r.taxaFrequencia).toFixed(2)
              : '--';
          base[mesKey] = { ativos, accidentes: acidentes, horas, tf };
        });
        setTfMeses(base);
        if (totalAcidentesNoAno === 0 && (d.anosComDados?.length ?? 0) > 0) {
          const anoComDados = Math.max(...d.anosComDados!);
          setTfAno(String(anoComDados));
        }
      })
      .catch(() => {
        setTfFonteAtivos(null);
        // Não limpa a tabela em erro: mantém dados anteriores visíveis
      })
      .finally(() => setTfLoading(false));
  }, [tfAno, regional]);

  // Carrega regional do localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(LS_REGIONAL_KEY);
    if (stored && REGIONALS.includes(stored as any)) {
      setRegional(stored);
    }
  }, []);

  // Salva regional no localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (regional) {
      window.localStorage.setItem(LS_REGIONAL_KEY, regional);
    }
  }, [regional]);

  // Carrega opções
  useEffect(() => {
    fetchJSON<{ regionais: string[]; unidades: Array<{ unidade: string; regional: string }> }>('/api/acidentes/options')
      .then((d) => setOpts(d))
      .catch(() => setOpts({ regionais: [], unidades: [] }));
  }, []);

  // Carrega lista de acidentes
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (regional) params.set('regional', regional);
    if (unidade) params.set('unidade', unidade);
    if (tipo) params.set('tipo', tipo);
    if (status) params.set('status', status);
    if (empresa) params.set('empresa', empresa);
    params.set('ano', ano || 'todos');
    if (mes) params.set('mes', mes);
    if (q) params.set('q', q);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));

    setListError(null);
    fetchJSON<{ rows: AcidenteRow[]; total: number }>(`/api/acidentes/list?${params.toString()}`)
      .then((d) => {
        const list = (d.rows || []).map((r: AcidenteRow) => ({ ...r, id: acidenteRef(r) }));
        setRows(list);
        setTotal(d.total || 0);
      })
      .catch((err) => {
        setRows([]);
        setTotal(0);
        setListError(err?.message || 'Erro ao carregar a lista. Tente recarregar a página.');
      })
      .finally(() => setLoading(false));
  }, [regional, unidade, tipo, status, empresa, ano, mes, q, page, listKey]);

  // Carrega estatísticas
  useEffect(() => {
    setStatsLoading(true);
    const params = new URLSearchParams();
    if (regional) params.set('regional', regional);
    params.set('ano', ano);

    fetchJSON<StatsData>(`/api/acidentes/stats?${params.toString()}`)
      .then((d) => setStats(d))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, [regional, ano]);

  useEffect(() => {
    setPainelLoading(true);
    const y = parseInt(painelAno, 10);
    if (Number.isNaN(y)) {
      setPainelData(null);
      setPainelLoading(false);
      return;
    }
    fetch(`/api/acidentes/painel-indicadores?ano=${y}`, { cache: 'no-store' })
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (r.ok && data && data.ano != null) setPainelData(data as PainelIndicadoresData);
        else setPainelData(null);
      })
      .catch(() => setPainelData(null))
      .finally(() => setPainelLoading(false));
  }, [painelAno]);

  const unidadesDaRegional = useMemo(() => {
    if (!regional) return opts.unidades;
    return opts.unidades.filter((u) => u.regional === regional);
  }, [opts.unidades, regional]);

  // Modal de edição/novo removido (página somente leitura).

  function toggleExpand(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const totalPages = useMemo(() => {
    return total > 0 ? Math.ceil(total / pageSize) : 1;
  }, [total]);

  const listRangeLabel = useMemo(() => {
    if (total === 0) return 'Nenhum registro nesta página';
    const from = (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);
    return `Exibindo ${from.toLocaleString('pt-BR')}–${to.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}`;
  }, [page, pageSize, total]);

  /** Modelo RIAT do repositório (public/templates/riat.xlsx), sem preenchimento automático. */
  async function downloadModeloRiat() {
    setInvestigacaoRiatDownloading(true);
    try {
      const res = await fetch('/api/acidentes/riat-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || `Erro ${res.status}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        res.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/)?.[1] || 'riat.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (e: any) {
      alert(e?.message || 'Erro ao baixar o modelo RIAT');
    } finally {
      setInvestigacaoRiatDownloading(false);
    }
  }

  async function openInvestigacao(row: AcidenteRow) {
    const shouldAutoRiat = !row.hasInvestigacao;
    setInvestigacaoRow(row);
    const ref = acidenteRef(row);
    setInvestigacaoLoading(true);
    setInvestigacaoForm({
      statusInvestigacao: '',
      riatUrl: '',
      riatNome: '',
      catUrl: '',
      catNome: '',
      sinanUrl: '',
      sinanNome: '',
      observacoes: '',
    });
    let obsCarregada = '';
    try {
      const res = await fetchJSON<{ ok: boolean; investigacao: any }>(
        `/api/acidentes/investigacao?ref=${encodeURIComponent(ref)}`
      );
      if (res.investigacao) {
        obsCarregada = res.investigacao.observacoes || '';
        setInvestigacaoForm({
          statusInvestigacao: res.investigacao.statusInvestigacao || '',
          riatUrl: res.investigacao.riatUrl || '',
          riatNome: res.investigacao.riatNome || '',
          catUrl: res.investigacao.catUrl || '',
          catNome: res.investigacao.catNome || '',
          sinanUrl: res.investigacao.sinanUrl || '',
          sinanNome: res.investigacao.sinanNome || '',
          observacoes: res.investigacao.observacoes || '',
        });
      }
    } catch {
      // mantém form vazio
    } finally {
      setInvestigacaoLoading(false);
    }
    if (shouldAutoRiat) {
      void downloadModeloRiat();
    }
  }

  function closeInvestigacao() {
    setInvestigacaoRow(null);
  }

  async function downloadRiatPreenchida() {
    await downloadModeloRiat();
  }

  const saveInvestigacao = async () => {
    if (!investigacaoRow) return;
    const ref = acidenteRef(investigacaoRow);
    setInvestigacaoSaving(true);
    try {
      await fetchJSON('/api/acidentes/investigacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acidenteRef: ref,
          numeroCAT: investigacaoRow.numeroCAT || null,
          regional: investigacaoRow.regional ?? null,
          tipo: investigacaoRow.tipo ?? null,
          statusInvestigacao: investigacaoForm.statusInvestigacao || null,
          riatUrl: investigacaoForm.riatUrl || null,
          riatNome: investigacaoForm.riatNome || null,
          catUrl: investigacaoForm.catUrl || null,
          catNome: investigacaoForm.catNome || null,
          sinanUrl: investigacaoForm.sinanUrl || null,
          sinanNome: investigacaoForm.sinanNome || null,
          observacoes: investigacaoForm.observacoes || null,
        }),
      });
      setListKey((k) => k + 1);
      closeInvestigacao();
    } catch (e: any) {
      alert(e?.message || 'Erro ao salvar investigação');
    } finally {
      setInvestigacaoSaving(false);
    }
  };

  const filtroSelectClass =
    'w-full rounded-lg border border-border/80 bg-background px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20';

  return (
    <div className="mx-auto max-w-[min(100%,90rem)] space-y-8 pb-14 pt-1">
      <header className="relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm ring-1 ring-black/[0.03] dark:ring-white/[0.05]">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_100%_-20%,rgba(245,158,11,0.12),transparent),radial-gradient(ellipse_80%_50%_at_0%_110%,rgba(16,185,129,0.07),transparent)]"
          aria-hidden
        />
        <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-start md:justify-between md:p-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-amber-950 dark:text-amber-200">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
              SST · Acidentes de trabalho
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                Painel de acidentes
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                Indicadores operacionais, taxa de frequência, registros importados e investigações (RIAT, CAT, SINAN). A lista é
                somente leitura — atualize os dados em <strong className="text-foreground">Admin → Importar bases</strong>.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row md:flex-col md:items-end">
            <span className="inline-flex items-center justify-center gap-2 rounded-xl border border-border/80 bg-background/90 px-4 py-2.5 text-center text-[11px] font-medium text-muted shadow-sm backdrop-blur-sm">
              <ClipboardList className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              Base da lista em modo leitura
            </span>
          </div>
        </div>
        <nav
          className="relative flex flex-wrap gap-2 border-t border-border/60 bg-muted/25 px-4 py-3 md:px-8"
          aria-label="Seções da página"
        >
          {[
            { href: '#painel-indicadores-acidentes', label: 'Indicadores', icon: LayoutDashboard },
            { href: '#filtros-acidentes', label: 'Filtros', icon: Filter },
            { href: '#visao-geral-acidentes', label: 'Resumo', icon: BarChart3 },
            { href: '#taxa-frequencia-acidentes', label: 'Taxa de frequência', icon: TrendingUp },
            { href: '#registros-acidentes', label: 'Registros', icon: Table2 },
          ].map(({ href, label, icon: Icon }) => (
            <a
              key={href}
              href={href}
              className="inline-flex items-center gap-1.5 rounded-lg border border-transparent bg-background/90 px-3 py-1.5 text-xs font-medium text-muted shadow-sm transition hover:border-border hover:text-foreground"
            >
              <Icon className="h-3.5 w-3.5 opacity-70" aria-hidden />
              {label}
            </a>
          ))}
        </nav>
      </header>

      <section
        id="painel-indicadores-acidentes"
        className="scroll-mt-24 space-y-6 rounded-2xl border border-border/80 bg-card p-6 shadow-sm ring-1 ring-black/[0.02] dark:ring-white/[0.04] md:p-8"
      >
        <div className="flex flex-col gap-4 border-b border-border/60 pb-6 md:flex-row md:items-end md:justify-between">
          <div className="flex gap-4">
            <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-300 sm:flex">
              <BarChart3 className="h-6 w-6" aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-foreground md:text-lg">
                Indicadores de acidentes — EMSERH
              </h2>
              <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted md:text-sm">
                <strong className="text-foreground">Taxa de frequência total EMSERH</strong> e{' '}
                <strong className="text-foreground">totais por regional</strong> (Norte, Leste, Centro, Sul) são calculados
                automaticamente a partir da base importada — não há digitação manual desses números nesta tela. Escolha o ano
                ao lado para consolidar o período.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <label htmlFor="painel-ano" className="text-xs font-semibold uppercase tracking-wide text-muted">
              Ano de referência
            </label>
            <select
              id="painel-ano"
              className="rounded-lg border border-border/80 bg-background px-3 py-2.5 text-sm font-semibold shadow-sm outline-none focus:ring-2 focus:ring-amber-500/30"
              value={painelAno}
              onChange={(e) => setPainelAno(e.target.value)}
              disabled={painelLoading}
            >
              {[
                ...new Set([
                  new Date().getFullYear(),
                  new Date().getFullYear() - 1,
                  new Date().getFullYear() - 2,
                  new Date().getFullYear() - 3,
                  new Date().getFullYear() - 4,
                  parseInt(painelAno, 10),
                ]),
              ]
                .filter((y) => !Number.isNaN(y))
                .sort((a, b) => b - a)
                .map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {painelLoading ? (
          <div className="flex items-center gap-3 py-10 text-sm font-medium text-muted">
            <span className="h-5 w-5 animate-pulse rounded-full bg-amber-500/40" aria-hidden />
            Carregando indicadores do painel…
          </div>
        ) : (
          <div className="space-y-8 text-xs">
            <div className="grid gap-4 lg:grid-cols-12 lg:items-stretch">
              <div className="flex flex-col justify-between rounded-xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] to-transparent p-5 lg:col-span-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-900 dark:text-emerald-200/90">
                    Taxa de frequência — total EMSERH
                  </p>
                  <p className="mt-3 text-4xl font-black tabular-nums tracking-tight text-emerald-700 dark:text-emerald-300">
                    {painelData?.taxaFrequenciaAnualEmserh != null
                      ? painelData.taxaFrequenciaAnualEmserh.toFixed(2)
                      : '—'}
                  </p>
                </div>
                <p className="mt-4 text-[11px] leading-relaxed text-muted">
                  {painelData != null
                    ? `${painelData.totalAcidentesAno} acidentes registrados no ano selecionado.`
                    : 'Dados indisponíveis — confira o deploy da rota /api/acidentes/painel-indicadores.'}
                  {painelData?.fonteAtivosTF === 'alterdata' ? (
                    <span className="mt-1 block font-medium text-foreground">Ativos (TF): Alterdata</span>
                  ) : null}
                </p>
              </div>
              <div className="lg:col-span-8">
                <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted">
                  Números de acidentes EMSERH — por regional
                </p>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {REGIONALS.map((r) => (
                    <div
                      key={`acc-${r}`}
                      className="rounded-xl border border-border/80 bg-muted/20 p-4 shadow-sm transition hover:border-amber-500/30"
                    >
                      <p className="text-[10px] font-bold uppercase leading-tight text-foreground">{r}</p>
                      <p className="mt-2 text-2xl font-black tabular-nums text-foreground">
                        {painelData?.acidentesPorRegional?.[r] ?? 0}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-wide text-muted">Acidentes investigados</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-xl border border-amber-500/35 bg-amber-500/[0.09] p-4 shadow-sm">
                  <p className="text-[10px] font-bold uppercase text-amber-950 dark:text-amber-100">Total EMSERH</p>
                  <p className="mt-2 text-3xl font-black tabular-nums">{painelData?.investigadosNoAno ?? 0}</p>
                </div>
                {REGIONALS.map((r) => (
                  <div key={`inv-${r}`} className="rounded-xl border border-border/80 bg-background p-4 shadow-sm">
                    <p className="text-[10px] font-bold uppercase text-muted">{r}</p>
                    <p className="mt-2 text-2xl font-black tabular-nums">{painelData?.investigadosPorRegional?.[r] ?? 0}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-muted/15 p-5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-foreground">
                % aderência ao plano de ação — investigações
              </p>
              {painelData?.notaAderencia ? (
                <p className="mt-2 text-[11px] leading-relaxed text-muted">{painelData.notaAderencia}</p>
              ) : null}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="text-[10px] font-bold uppercase text-emerald-900 dark:text-emerald-200">% P.A — EMSERH</p>
                  <p className="mt-2 text-2xl font-black tabular-nums">
                    {painelData?.aderenciaPlanoAcaoPercent != null
                      ? `${painelData.aderenciaPlanoAcaoPercent.toFixed(1)}%`
                      : '—'}
                  </p>
                </div>
                {REGIONALS.map((r) => {
                  const p = painelData?.aderenciaPorRegional?.[r];
                  return (
                    <div key={`pa-${r}`} className="rounded-lg border border-border/70 bg-background p-4">
                      <p className="text-[10px] font-bold uppercase text-muted">{r}</p>
                      <p className="mt-2 text-xl font-black tabular-nums">{p != null ? `${p.toFixed(0)}%` : '—'}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-dashed border-border/80 bg-background/50 p-5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-foreground">
                % unidades — divulgação programas legais
              </p>
              {painelData?.notaDivulgacao ? (
                <p className="mt-2 text-[11px] leading-relaxed text-muted">{painelData.notaDivulgacao}</p>
              ) : null}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-lg border border-dashed border-border bg-muted/25 p-4">
                  <p className="text-[10px] font-bold uppercase text-muted">Total EMSERH</p>
                  <p className="mt-2 text-2xl font-black tabular-nums">
                    {painelData?.unidadesDivulgacaoProgramasLegaisPercent != null
                      ? `${painelData.unidadesDivulgacaoProgramasLegaisPercent}%`
                      : '—'}
                  </p>
                </div>
                {REGIONALS.map((r) => {
                  const v = painelData?.divulgacaoProgramasLegaisPorRegional?.[r];
                  return (
                    <div key={`div-${r}`} className="rounded-lg border border-dashed border-border/70 bg-background p-4">
                      <p className="text-[10px] font-bold uppercase text-muted">{r}</p>
                      <p className="mt-2 text-xl font-black tabular-nums">{v != null ? `${v}%` : '—'}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      <section
        id="filtros-acidentes"
        className="scroll-mt-24 rounded-2xl border border-border/80 bg-card p-6 shadow-sm md:p-8"
      >
        <div className="mb-6 flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Filter className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Filtros da lista de registros</h2>
              <p className="mt-1 text-xs text-muted">
                Refinam os acidentes exibidos na tabela abaixo. O resumo estatístico usa regional e ano conforme seleção.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="shrink-0 rounded-lg border border-border bg-background px-4 py-2 text-xs font-semibold text-muted transition hover:border-amber-500/40 hover:text-foreground"
            onClick={() => {
              setRegional('');
              setUnidade('');
              setTipo('');
              setStatus('');
              setEmpresa('');
              setAno('todos');
              setMes('');
              setQ('');
              setPage(1);
            }}
          >
            Limpar filtros
          </button>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">Regional</label>
            <select
              className={filtroSelectClass}
              value={regional}
              onChange={(e) => {
                setRegional(e.target.value || '');
                setUnidade('');
                setPage(1);
              }}
            >
              <option value="">Todas as regionais</option>
              {REGIONALS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">Unidade hospitalar</label>
            <select
              className={filtroSelectClass}
              value={unidade}
              onChange={(e) => {
                setUnidade(e.target.value || '');
                setPage(1);
              }}
            >
              <option value="">Todas as unidades</option>
              {unidadesDaRegional.map((u) => (
                <option key={`${u.regional}-${u.unidade}`} value={u.unidade}>
                  {u.unidade}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">Tipo de acidente</label>
            <select
              className={filtroSelectClass}
              value={tipo}
              onChange={(e) => {
                setTipo(e.target.value || '');
                setPage(1);
              }}
            >
              <option value="">Todos os tipos</option>
              {TIPOS_ACIDENTE.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">Status</label>
            <select
              className={filtroSelectClass}
              value={status}
              onChange={(e) => {
                setStatus(e.target.value || '');
                setPage(1);
              }}
            >
              <option value="">Todos</option>
              {STATUS_ACIDENTE.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">Empresa</label>
            <select
              className={filtroSelectClass}
              value={empresa}
              onChange={(e) => {
                setEmpresa(e.target.value || '');
                setPage(1);
              }}
            >
              <option value="">Todas</option>
              <option value="IADVH">IADVH</option>
              <option value="EMSERH">EMSERH</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">Ano (lista)</label>
            <select
              className={filtroSelectClass}
              value={ano}
              onChange={(e) => {
                setAno(e.target.value);
                setPage(1);
              }}
            >
              <option value="todos">Todos os anos</option>
              {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">Mês</label>
            <select
              className={filtroSelectClass}
              value={mes}
              onChange={(e) => {
                setMes(e.target.value || '');
                setPage(1);
              }}
            >
              <option value="">Todos os meses</option>
              {[
                { value: '1', label: 'Janeiro' },
                { value: '2', label: 'Fevereiro' },
                { value: '3', label: 'Março' },
                { value: '4', label: 'Abril' },
                { value: '5', label: 'Maio' },
                { value: '6', label: 'Junho' },
                { value: '7', label: 'Julho' },
                { value: '8', label: 'Agosto' },
                { value: '9', label: 'Setembro' },
                { value: '10', label: 'Outubro' },
                { value: '11', label: 'Novembro' },
                { value: '12', label: 'Dezembro' },
              ].map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-1 xl:col-span-2">
            <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">Busca textual</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                type="search"
                className="w-full rounded-lg border border-border/80 bg-background py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none transition focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
                placeholder="Nome, unidade, CAT…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-8">
        <section
          id="visao-geral-acidentes"
          className="scroll-mt-24 rounded-2xl border border-border/80 bg-card p-6 shadow-sm md:p-8"
        >
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-border/60 pb-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-800 dark:text-amber-200">
                <BarChart3 className="h-5 w-5" aria-hidden />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Resumo do período filtrado</h2>
                <p className="mt-1 text-xs text-muted">
                  Totais alinhados à regional e ao ano selecionados nos filtros (exceto &quot;Todos os anos&quot;, que usa o ano do filtro de estatística).
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border/60 bg-muted/10 p-4 md:p-5">
          {statsLoading ? (
            <p className="text-sm text-muted">Carregando...</p>
          ) : stats ? (
            <>
            <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
              <div className="rounded-lg border border-border bg-bg px-3 py-2.5 min-w-[4.5rem] shrink-0 text-left">
                <p className="text-[11px] uppercase tracking-wide text-muted mb-0.5">Total no Ano</p>
                <p className="text-[18px] font-bold tabular-nums leading-tight">{stats.totalAno}</p>
              </div>
              <div className="rounded-lg border border-border bg-bg px-3 py-2.5 min-w-[4.5rem] shrink-0 text-left">
                <p className="text-[11px] uppercase tracking-wide text-muted mb-0.5">Total no Mês</p>
                <p className="text-[18px] font-bold tabular-nums leading-tight">{stats.totalMes}</p>
              </div>
              <div className="rounded-lg border border-border bg-bg px-3 py-2.5 min-w-[4.5rem] shrink-0 text-left">
                <p className="text-[11px] uppercase tracking-wide text-muted mb-0.5">Com Afast.</p>
                <p className="text-[18px] font-bold text-red-500 dark:text-red-400 tabular-nums leading-tight">{stats.comAfastamento}</p>
              </div>
              <div className="rounded-lg border border-border bg-bg px-3 py-2.5 min-w-[4.5rem] shrink-0 text-left">
                <p className="text-[11px] uppercase tracking-wide text-muted mb-0.5">Sem Afast.</p>
                <p className="text-[18px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums leading-tight">{stats.semAfastamento}</p>
              </div>
              <div className="rounded-lg border border-border bg-bg px-3 py-2.5 min-w-[4.5rem] shrink-0 text-left">
                <p className="text-[11px] uppercase tracking-wide text-muted mb-0.5">Investigados</p>
                <p className="text-[18px] font-bold tabular-nums leading-tight">{stats.totalInvestigados ?? 0}</p>
              </div>
              <div className="rounded-lg border border-border bg-bg px-3 py-2.5 min-w-0 flex-1 shrink min-w-[10rem]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1">Por Regional</p>
                <div className="flex flex-nowrap gap-x-3 gap-y-0 overflow-x-auto">
                  {!stats.porRegional?.length ? (
                    <span className="text-muted">—</span>
                  ) : (
                    (stats.porRegional ?? []).map((r) => (
                      <span key={r.regional} className="flex items-baseline gap-1.5 shrink-0 whitespace-nowrap" title={r.regional}>
                        <span className="text-[12px] text-foreground truncate max-w-[4rem]">{r.regional}</span>
                        <span className="text-[14px] font-bold tabular-nums">{r.quantidade}</span>
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-border bg-bg px-3 py-2.5 min-w-0 flex-1 shrink min-w-[10rem]">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted mb-1">Por Tipo</p>
                <div className="flex flex-nowrap gap-x-3 gap-y-0 overflow-x-auto">
                  {!stats.porTipo?.length ? (
                    <span className="text-muted">—</span>
                  ) : (
                    (stats.porTipo ?? []).map((t) => (
                      <span key={t.tipo} className="flex items-baseline gap-1.5 shrink-0 whitespace-nowrap" title={TIPOS_ACIDENTE.find((tp) => tp.value === t.tipo)?.label || t.tipo}>
                        <span className="text-[12px] text-foreground truncate max-w-[4rem]">{TIPOS_ACIDENTE.find((tp) => tp.value === t.tipo)?.label || t.tipo}</span>
                        <span className="text-[14px] font-bold tabular-nums">{t.quantidade}</span>
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
            {((stats.porRegionalInvestigados?.length ?? 0) > 0 || (stats.porTipoInvestigados?.length ?? 0) > 0) && (
              <div className="mt-2 grid grid-cols-2 gap-1.5 border-t border-border/60 pt-2">
                <div className="rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[10px]">
                  <p className="mb-0.5 font-semibold text-amber-700 dark:text-amber-400">Investigados por Regional</p>
                  <div className="max-h-14 overflow-y-auto">
                    {(stats.porRegionalInvestigados ?? []).map((r) => (
                      <div key={r.regional} className="flex justify-between gap-1">
                        <span className="truncate">{r.regional}</span>
                        <span className="font-medium">{r.quantidade}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded border border-amber-500/30 bg-amber-500/5 px-2 py-1.5 text-[10px]">
                  <p className="mb-0.5 font-semibold text-amber-700 dark:text-amber-400">Investigados por Tipo</p>
                  <div className="max-h-14 overflow-y-auto">
                    {(stats.porTipoInvestigados ?? []).map((t) => (
                      <div key={t.tipo} className="flex justify-between gap-1">
                        <span className="truncate">{TIPOS_ACIDENTE.find((tp) => tp.value === t.tipo)?.label || t.tipo}</span>
                        <span className="font-medium">{t.quantidade}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            </>
          ) : (
            <p className="text-[10px] text-muted">Nenhuma estatística disponível.</p>
          )}
          </div>
        </section>

        <section
          id="taxa-frequencia-acidentes"
          className="scroll-mt-24 space-y-6 rounded-2xl border border-border/80 bg-card p-6 shadow-sm md:p-8"
        >
            <div className="flex flex-col gap-4 border-b border-border/60 pb-6 md:flex-row md:items-start md:justify-between">
              <div className="flex gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-800 dark:text-emerald-200">
                  <TrendingUp className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground md:text-lg">
                    Taxa de frequência de acidentes (TF)
                  </h2>
                  <p className="mt-2 max-w-3xl text-xs leading-relaxed text-muted md:text-sm">
                    Indicador mensal a partir do número de acidentes e das horas-homem trabalhadas (HHT). Os colaboradores
                    ativos podem ser informados por mês; acidentes vêm da base importada.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-medium text-muted">
                  Ano de referência
                  {tfLoading && <span className="ml-2 text-emerald-600">Carregando...</span>}
                </span>
                <select
                  className="rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-emerald-500/50 min-w-[8rem] disabled:opacity-70"
                  value={tfAno}
                  onChange={(e) => setTfAno(e.target.value)}
                  disabled={tfLoading}
                >
                  {[
                    ...new Set([
                      ...tfAnosComDados,
                      new Date().getFullYear(),
                      new Date().getFullYear() - 1,
                      new Date().getFullYear() - 2,
                      new Date().getFullYear() - 3,
                      new Date().getFullYear() - 4,
                    ]),
                  ]
                    .filter((y) => !Number.isNaN(y))
                    .sort((a, b) => b - a)
                    .map((y) => (
                      <option key={y} value={String(y)}>
                        {y}
                        {tfAnosComDados.includes(y) ? ' (com dados)' : ''}
                      </option>
                    ))}
                </select>
              </div>
              {tfAnosComDados.length > 0 && (
                <p className="text-xs text-muted">
                  Anos com acidentes na base: {tfAnosComDados.join(', ')}. Selecione o ano para ver Nº de Acidentes e TF por mês.
                </p>
              )}

              <div className="space-y-3 overflow-x-auto rounded-xl border border-border/80 bg-muted/20 p-5">
                <div className="flex items-center gap-3 px-0.5">
                  <span className="w-40 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted">
                    Mês
                  </span>
                  <div className="grid grid-cols-12 gap-2 flex-1 min-w-0">
                    {['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'].map((nome) => (
                      <div
                        key={nome}
                        className="min-w-[3rem] rounded-lg bg-muted/40 py-2 flex items-center justify-center text-xs font-semibold text-muted"
                      >
                        {nome}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-xs font-medium text-muted">
                      Colaboradores ativos
                      {tfFonteAtivos === 'alterdata' && (
                        <span className="ml-1 text-emerald-600 dark:text-emerald-400" title="Contagem automática">
                          (Alterdata)
                        </span>
                      )}
                    </span>
                    <div className="grid grid-cols-12 gap-2 flex-1 min-w-0">
                      {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(
                        (m) => {
                          const linha = tfMeses[m];
                          return (
                            <input
                              key={m}
                              type="number"
                              min={0}
                              className="min-w-[3rem] rounded-lg border border-border bg-card px-2 py-2 text-sm text-center tabular-nums outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                              placeholder="0"
                              value={linha?.ativos ?? ''}
                              onChange={(e) => {
                                const ativos = e.target.value;
                                const ativosNum = parseInt(ativos, 10);
                                const hht = Number.isNaN(ativosNum) || ativosNum < 0 ? 0 : ativosNum * 150;
                                const acidentes = parseInt(linha?.accidentes ?? '0', 10) || 0;
                                const tf = hht > 0 ? ((acidentes * 1_000_000) / hht).toFixed(2) : '--';
                                setTfMeses((prev) => ({
                                  ...prev,
                                  [m]: {
                                    ...(prev[m] || { ativos: '', accidentes: '', horas: '', tf: '--' }),
                                    ativos,
                                    accidentes: String(linha?.accidentes ?? prev[m]?.accidentes ?? '0'),
                                    horas: String(hht),
                                    tf,
                                  },
                                }));
                              }}
                            />
                          );
                        },
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-xs font-medium text-muted">
                      HHT (ativos × 150)
                    </span>
                    <div className="grid grid-cols-12 gap-2 flex-1 min-w-0">
                      {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(
                        (m) => {
                          const linha = tfMeses[m];
                          const horasNum = parseInt(linha?.horas ?? '', 10);
                          const horasStr = Number.isNaN(horasNum) ? '--' : horasNum.toLocaleString('pt-BR');
                          return (
                            <div
                              key={m}
                              className="min-w-[3rem] rounded-lg border border-border bg-panel/60 px-2 py-2 flex items-center justify-center text-sm tabular-nums text-foreground"
                            >
                              {horasStr}
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-xs font-medium text-muted">
                      Nº de Acidentes
                    </span>
                    <div className="grid grid-cols-12 gap-2 flex-1 min-w-0">
                      {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(
                        (m) => {
                          const linha = tfMeses[m];
                          const acc = linha?.accidentes ?? '0';
                          const n = parseInt(acc, 10);
                          const accStr = Number.isNaN(n) ? '0' : n.toLocaleString('pt-BR');
                          return (
                            <div
                              key={m}
                              className="min-w-[3rem] rounded-lg border border-border bg-card px-2 py-2 flex items-center justify-center text-sm tabular-nums text-foreground"
                            >
                              {accStr}
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="w-40 shrink-0 text-xs font-medium text-muted">
                      TF (por milhão de horas)
                    </span>
                    <div className="grid grid-cols-12 gap-2 flex-1 min-w-0">
                      {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(
                        (m) => {
                          const linha = tfMeses[m];
                          return (
                            <div
                              key={m}
                              className="min-w-[3rem] rounded-lg border border-border bg-panel/60 px-2 py-2 flex items-center justify-center text-sm tabular-nums text-foreground"
                            >
                              {linha?.tf && linha.tf !== '--'
                                ? Number(linha.tf).toLocaleString('pt-BR', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })
                                : '--'}
                            </div>
                          );
                        },
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 pt-4 border-t border-border mt-4 flex-wrap">
              <p className="text-xs text-muted">
                Salve os ativos por mês para que o HHT e a TF sejam calculados automaticamente.
              </p>
              <button
                type="button"
                disabled={tfSavingAtivos}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-50 transition-colors"
                onClick={async () => {
                  try {
                    setTfSavingAtivos(true);
                    const anoNum = parseInt(tfAno || String(new Date().getFullYear()), 10);
                    const registros = ['01','02','03','04','05','06','07','08','09','10','11','12'].map(
                      (m) => {
                        const linha = tfMeses[m];
                        const ativos = parseInt((linha?.ativos ?? '0').replace(/\D/g, ''), 10);
                        return { mes: parseInt(m, 10), ativos: Number.isNaN(ativos) ? 0 : ativos };
                      }
                    );
                    await fetchJSON('/api/acidentes/ativos-mensal', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ano: anoNum, registros }),
                    });
                    const params = new URLSearchParams();
                    params.set('ano', String(anoNum));
                    if (regional) params.set('regional', regional);
                    const d = await fetchJSON<{ registros: any[] }>('/api/acidentes/taxa-frequencia?' + params.toString());
                    const base: any = {};
                    ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].forEach((mm) => {
                      base[mm] = { ativos: '', accidentes: '', horas: '', tf: '--' };
                    });
                    (d.registros || []).forEach((r: any) => {
                      const mes = String(r.mes).padStart(2, '0');
                      base[mes] = {
                        ativos: String(r.ativos ?? ''),
                        accidentes: String(r.numeroAcidentes ?? ''),
                        horas: String(r.horasHomemTrabalhadas ?? ''),
                        tf: r.taxaFrequencia != null ? Number(r.taxaFrequencia).toFixed(2) : '--',
                      };
                    });
                    setTfMeses(base);
                    alert('Ativos salvos. TF recalculada.');
                  } catch (e: any) {
                    alert(e?.message || 'Erro ao salvar ativos');
                  } finally {
                    setTfSavingAtivos(false);
                  }
                }}
              >
                {tfSavingAtivos ? 'Salvando...' : 'Salvar ativos do ano'}
              </button>
            </div>
          </section>

      </div>

      <section
        id="registros-acidentes"
        className="scroll-mt-24 rounded-2xl border border-border/80 bg-card shadow-sm"
      >
        <div className="flex flex-col gap-4 border-b border-border/60 p-6 md:flex-row md:items-center md:justify-between md:p-8">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Table2 className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground md:text-lg">Registros de acidentes</h2>
              <p className="mt-1 text-xs text-muted">
                Base importada · {listRangeLabel}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-border/80 bg-muted/40 px-3 py-1.5 font-semibold tabular-nums text-foreground">
              {total.toLocaleString('pt-BR')} no filtro
            </span>
            <span className="text-muted">
              Página {page} / {totalPages}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto px-2 pb-2 md:px-4">
          <table className="min-w-[72rem] w-full border-collapse text-left text-[11px] md:min-w-full">
            <thead className="sticky top-0 z-10 border-b border-border/80 bg-card/95 text-[10px] font-semibold uppercase tracking-wider text-muted backdrop-blur-sm">
              <tr>
                <th className="w-10 px-2 py-3 text-center" scope="col" aria-label="Expandir" />
                <th className="min-w-[9rem] px-3 py-3" scope="col">
                  Trabalhador
                </th>
                <th className="px-2 py-3 text-center" scope="col">
                  Empresa
                </th>
                <th className="min-w-[10rem] px-3 py-3" scope="col">
                  Unidade
                </th>
                <th className="min-w-[8rem] px-3 py-3" scope="col">
                  Tipo
                </th>
                <th className="px-2 py-3 text-center" scope="col">
                  Afast.
                </th>
                <th className="px-2 py-3 text-center whitespace-nowrap" scope="col">
                  Data
                </th>
                <th className="px-2 py-3 text-center" scope="col">
                  Hora
                </th>
                <th className="px-2 py-3 text-center" scope="col">
                  Mês
                </th>
                <th className="min-w-[6rem] px-2 py-3 text-center font-mono text-[9px]" scope="col">
                  CAT
                </th>
                <th className="px-2 py-3 text-center" scope="col">
                  RIAT
                </th>
                <th className="px-2 py-3 text-center" scope="col">
                  SINAN
                </th>
                <th className="px-2 py-3 text-center" scope="col">
                  Status
                </th>
                <th className="min-w-[7rem] px-3 py-3 text-center" scope="col">
                  Ações
                </th>
              </tr>
            </thead>
              <tbody className="divide-y divide-border/50">
                {loading && (
                  <tr>
                    <td colSpan={14} className="px-6 py-16 text-center">
                      <div className="mx-auto flex max-w-sm flex-col items-center gap-3">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" aria-hidden />
                        <p className="text-sm font-medium text-muted">Carregando registros…</p>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={14} className="px-6 py-16 text-center">
                      {listError ? (
                        <div className="mx-auto max-w-md rounded-xl border border-destructive/30 bg-destructive/5 p-6">
                          <p className="text-sm font-medium text-destructive">{listError}</p>
                          <button
                            type="button"
                            className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500"
                            onClick={() => setListKey((k) => k + 1)}
                          >
                            Tentar novamente
                          </button>
                        </div>
                      ) : (
                        <div className="mx-auto max-w-md text-muted">
                          <p className="text-sm font-medium text-foreground">Nenhum acidente encontrado com estes filtros.</p>
                          {total === 0 && (
                            <p className="mt-3 text-xs leading-relaxed">
                              Experimente <strong className="text-foreground">Todos os anos</strong> no filtro de ano ou limpe os filtros.
                            </p>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
                {!loading &&
                  rows.map((row) => {
                    const isExpanded = expandedRows.has(row.id);
                    return (
                      <React.Fragment key={row.id}>
                        <tr className="transition-colors hover:bg-muted/25">
                          <td className="px-2 py-2.5 text-center align-middle">
                            <button
                              type="button"
                              onClick={() => toggleExpand(row.id)}
                              className="inline-flex rounded-md p-1 text-muted transition hover:bg-muted hover:text-foreground"
                              aria-expanded={isExpanded}
                              title={isExpanded ? 'Recolher detalhes' : 'Ver detalhes resumidos'}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 align-middle font-medium text-foreground">{row.nome}</td>
                          <td className="px-2 py-2.5 text-center align-middle">
                            <span className="inline-flex rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                              {row.empresa}
                            </span>
                          </td>
                          <td className="max-w-[14rem] truncate px-3 py-2.5 align-middle text-muted" title={row.unidadeHospitalar}>
                            {row.unidadeHospitalar}
                          </td>
                          <td className="max-w-[12rem] px-3 py-2.5 align-middle text-[10px] leading-snug text-muted">
                            {TIPOS_ACIDENTE.find((t) => t.value === row.tipo)?.label || row.tipo}
                          </td>
                          <td className="px-2 py-2.5 text-center align-middle">
                            {row.comAfastamento ? (
                              <span className="inline-flex rounded-md bg-red-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-700 ring-1 ring-red-500/25 dark:text-red-300">
                                Com afast.
                              </span>
                            ) : (
                              <span className="inline-flex rounded-md bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-500/25 dark:text-emerald-300">
                                Sem afast.
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2.5 text-center align-middle tabular-nums text-muted">
                            {formatDate(row.data)}
                          </td>
                          <td className="px-2 py-2.5 text-center align-middle tabular-nums text-muted">{row.hora || '—'}</td>
                          <td className="px-2 py-2.5 text-center align-middle text-muted">
                            {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][row.mes - 1]}
                          </td>
                          <td className="px-2 py-2.5 text-center align-middle font-mono text-[10px] text-muted">{row.numeroCAT || '—'}</td>
                          <td className="max-w-[5rem] truncate px-2 py-2.5 text-center align-middle text-muted" title={row.riat || undefined}>
                            {row.riat || '—'}
                          </td>
                          <td className="max-w-[5rem] truncate px-2 py-2.5 text-center align-middle text-muted" title={row.sinan || undefined}>
                            {row.sinan || '—'}
                          </td>
                          <td className="px-2 py-2.5 text-center align-middle">
                            <span
                              className={`inline-flex rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ${
                                row.status === 'concluido'
                                  ? 'bg-emerald-500/15 text-emerald-800 ring-emerald-500/30 dark:text-emerald-300'
                                  : row.status === 'cancelado'
                                  ? 'bg-neutral-500/15 text-neutral-700 ring-neutral-500/25 dark:text-neutral-300'
                                  : row.status === 'em_analise'
                                  ? 'bg-amber-500/15 text-amber-900 ring-amber-500/30 dark:text-amber-200'
                                  : 'bg-sky-500/15 text-sky-900 ring-sky-500/30 dark:text-sky-200'
                              }`}
                            >
                              {STATUS_ACIDENTE.find((s) => s.value === row.status)?.label || row.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center align-middle">
                            <div className="flex flex-col items-center gap-1 sm:flex-row sm:justify-center">
                              {row.hasInvestigacao && (
                                <span
                                  className="rounded-md bg-emerald-600/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white shadow-sm"
                                  title="Investigação registrada"
                                >
                                  RIAT
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => openInvestigacao(row)}
                                className="inline-flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-amber-500"
                              >
                                <FileSpreadsheet className="h-3 w-3 opacity-90" aria-hidden />
                                {row.hasInvestigacao ? 'Ver' : 'Investigar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-muted/20">
                            <td colSpan={14} className="border-t border-border/50 px-4 py-3">
                              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px]">
                                <span className="text-muted">
                                  <span className="font-semibold text-foreground">Data/Hora: </span>
                                  {formatDate(row.data)} {row.hora || ''}
                                </span>
                                <span className="text-muted">
                                  <span className="font-semibold text-foreground">Unidade: </span>
                                  {row.unidadeHospitalar}
                                </span>
                                <span className="text-muted">
                                  <span className="font-semibold text-foreground">Regional: </span>
                                  {row.regional || '—'}
                                </span>
                                <span className="text-muted">
                                  <span className="font-semibold text-foreground">Função: </span>
                                  {row.funcaoTrabalhador || '—'}
                                </span>
                                <span className="text-muted">
                                  <span className="font-semibold text-foreground">CAT: </span>
                                  {row.numeroCAT || '—'}
                                </span>
                                <span className="mt-1 w-full text-[10px] italic text-muted sm:mt-0 sm:w-auto">
                                  Detalhamento completo (descrição, causas, plano de ação): preencha a RIAT em Excel e anexe o link em Investigar.
                                </span>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <div>
              Página <span className="font-semibold">{page} / {totalPages}</span>
            </div>
            <div className="inline-flex items-center gap-1">
              <button
                type="button"
                className="rounded border border-border px-2 py-1 disabled:opacity-40"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Anterior
              </button>
              <button
                type="button"
                className="rounded border border-border px-2 py-1 disabled:opacity-40"
                onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))}
                disabled={page >= totalPages}
              >
                Próxima
              </button>
            </div>
          </div>
      </div>

      {/* Painel Investigação do acidente (RIAT, CAT, SINAN) */}
      {investigacaoRow && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={closeInvestigacao} aria-hidden />
          <div className="relative w-full max-w-4xl overflow-y-auto bg-panel border-l border-border shadow-xl flex flex-col max-h-full">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
              <h2 className="text-sm font-semibold">Investigação do acidente (conforme RIAT)</h2>
              <button
                type="button"
                onClick={closeInvestigacao}
                className="rounded border border-border px-2 py-1 text-[10px] hover:bg-panel"
              >
                Fechar
              </button>
            </div>
            <div className="flex-1 p-4 space-y-6 text-xs">
              {/* Resumo do acidente (somente leitura) */}
              <section className="rounded-lg border border-border bg-card/50 p-4">
                <h3 className="text-[11px] font-semibold uppercase text-muted mb-3">Acidente</h3>
                <div className="grid gap-2 md:grid-cols-2">
                  <p><span className="font-medium text-muted">Nome:</span> {investigacaoRow.nome}</p>
                  <p><span className="font-medium text-muted">Data/Hora:</span> {formatDate(investigacaoRow.data)} {investigacaoRow.hora || ''}</p>
                  <p><span className="font-medium text-muted">Unidade:</span> {investigacaoRow.unidadeHospitalar}</p>
                  <p><span className="font-medium text-muted">Regional:</span> {investigacaoRow.regional || '—'}</p>
                  <p><span className="font-medium text-muted">CAT:</span> {investigacaoRow.numeroCAT || '—'}</p>
                  <p><span className="font-medium text-muted">Tipo:</span> {TIPOS_ACIDENTE.find((t) => t.value === investigacaoRow.tipo)?.label || investigacaoRow.tipo}</p>
                </div>
              </section>

              {/* Formulário investigação */}
              <section className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-900/10 p-4 space-y-4">
                <h3 className="text-[11px] font-semibold uppercase text-amber-800 dark:text-amber-200">Investigação — RIAT, CAT e SINAN</h3>
                <p className="text-[11px] text-muted">
                  Anexe os documentos: informe o <strong>link</strong> do arquivo (ex.: Google Drive, OneDrive ou URL direta) e, se quiser, um nome para exibição.
                </p>
                {investigacaoLoading ? (
                  <p className="text-muted">Carregando...</p>
                ) : (
                  <>
                    <div className="flex flex-col gap-2 pb-3 border-b border-border">
                      <p className="text-[10px] text-muted">
                        Baixe o modelo RIAT <strong>em branco</strong> (arquivo do GitHub, sem preenchimento automático). Na
                        primeira investigação do acidente o download dispara sozinho; use o botão para baixar de novo.
                        Depois de preencher, salve na pasta do Google Drive e cole o link do arquivo no campo RIAT abaixo.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={downloadRiatPreenchida}
                          disabled={investigacaoRiatDownloading}
                          className="rounded border border-emerald-600 bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {investigacaoRiatDownloading ? 'Baixando...' : 'Baixar modelo RIAT (riat.xlsx)'}
                        </button>
                        <a
                          href={RIAT_GOOGLE_DRIVE_FOLDER_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded border border-[#1a73e8] bg-[#1a73e8]/10 px-4 py-2 text-xs font-semibold text-[#1a73e8] hover:bg-[#1a73e8]/20 dark:border-[#8ab4f8] dark:bg-[#8ab4f8]/15 dark:text-[#8ab4f8] dark:hover:bg-[#8ab4f8]/25"
                        >
                          <FolderOpen className="h-4 w-4 shrink-0" aria-hidden />
                          Abrir pasta RIAT no Google Drive
                        </a>
                        <span className="text-[10px] text-muted">
                          <code className="text-[9px]">public/templates/riat.xlsx</code>
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="block font-medium text-muted mb-1">Status da investigação</label>
                      <select
                        value={investigacaoForm.statusInvestigacao}
                        onChange={(e) => setInvestigacaoForm((f) => ({ ...f, statusInvestigacao: e.target.value }))}
                        className="w-full rounded border border-border bg-background px-3 py-2 text-xs"
                      >
                        <option value="">Selecione</option>
                        <option value="em_andamento">Em andamento</option>
                        <option value="concluida">Concluída</option>
                      </select>
                    </div>

                    <div className="grid gap-4 md:grid-cols-1">
                      <div className="rounded border border-border bg-background p-3 space-y-2">
                        <span className="font-semibold text-muted">RIAT (Registro de Investigação de Acidente de Trabalho)</span>
                        <input
                          type="url"
                          placeholder="Link do documento RIAT (ex.: Drive, OneDrive)"
                          value={investigacaoForm.riatUrl}
                          onChange={(e) => setInvestigacaoForm((f) => ({ ...f, riatUrl: e.target.value }))}
                          className="w-full rounded border border-border bg-background px-3 py-2 text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Nome do arquivo (opcional)"
                          value={investigacaoForm.riatNome}
                          onChange={(e) => setInvestigacaoForm((f) => ({ ...f, riatNome: e.target.value }))}
                          className="w-full rounded border border-border bg-background px-3 py-2 text-xs"
                        />
                        {investigacaoForm.riatUrl && (
                          <a href={investigacaoForm.riatUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline">
                            Abrir documento →
                          </a>
                        )}
                      </div>
                      <div className="rounded border border-border bg-background p-3 space-y-2">
                        <span className="font-semibold text-muted">CAT (Comunicação de Acidente de Trabalho)</span>
                        <input
                          type="url"
                          placeholder="Link do documento CAT (ex.: Drive, OneDrive)"
                          value={investigacaoForm.catUrl}
                          onChange={(e) => setInvestigacaoForm((f) => ({ ...f, catUrl: e.target.value }))}
                          className="w-full rounded border border-border bg-background px-3 py-2 text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Nome do arquivo (opcional)"
                          value={investigacaoForm.catNome}
                          onChange={(e) => setInvestigacaoForm((f) => ({ ...f, catNome: e.target.value }))}
                          className="w-full rounded border border-border bg-background px-3 py-2 text-xs"
                        />
                        {investigacaoForm.catUrl && (
                          <a href={investigacaoForm.catUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline">
                            Abrir documento →
                          </a>
                        )}
                      </div>
                      <div className="rounded border border-border bg-background p-3 space-y-2">
                        <span className="font-semibold text-muted">SINAN (Sistema de Informação de Agravos de Notificação)</span>
                        <input
                          type="url"
                          placeholder="Link do documento SINAN (ex.: Drive, OneDrive)"
                          value={investigacaoForm.sinanUrl}
                          onChange={(e) => setInvestigacaoForm((f) => ({ ...f, sinanUrl: e.target.value }))}
                          className="w-full rounded border border-border bg-background px-3 py-2 text-xs"
                        />
                        <input
                          type="text"
                          placeholder="Nome do arquivo (opcional)"
                          value={investigacaoForm.sinanNome}
                          onChange={(e) => setInvestigacaoForm((f) => ({ ...f, sinanNome: e.target.value }))}
                          className="w-full rounded border border-border bg-background px-3 py-2 text-xs"
                        />
                        {investigacaoForm.sinanUrl && (
                          <a href={investigacaoForm.sinanUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline">
                            Abrir documento →
                          </a>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block font-medium text-muted mb-1">Observações da investigação</label>
                      <textarea
                        placeholder="Observações, conclusões, medidas tomadas..."
                        value={investigacaoForm.observacoes}
                        onChange={(e) => setInvestigacaoForm((f) => ({ ...f, observacoes: e.target.value }))}
                        className="w-full min-h-[100px] rounded border border-border bg-background px-3 py-2 text-xs"
                        rows={4}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border">
                      <button
                        type="button"
                        onClick={closeInvestigacao}
                        className="rounded border border-border px-4 py-2 text-xs font-medium hover:bg-card"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={saveInvestigacao}
                        disabled={investigacaoSaving}
                        className="rounded bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                      >
                        {investigacaoSaving ? 'Salvando...' : 'Salvar investigação'}
                      </button>
                    </div>
                    <p className="text-[10px] text-muted pt-1">
                      Após preencher o modelo no Excel, você pode usar o Gov.br Assinador para assinatura digital.
                    </p>
                  </>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

