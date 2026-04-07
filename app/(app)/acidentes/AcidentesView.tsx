'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { REGIONALS } from '@/lib/unidReg';
import {
  ChevronDown,
  ChevronUp,
  ClipboardList,
  FileSpreadsheet,
  FolderOpen,
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

  const fieldClass = 'w-full px-3 py-2 rounded bg-card border border-border text-sm outline-none';

  return (
    <div className="space-y-4 text-text">
      <div className="rounded-xl border border-border bg-panel p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium tracking-wide text-muted uppercase">SST · Acidentes</p>
            <h1 className="text-xl font-semibold">Acidentes de Trabalho</h1>
            <p className="mt-1 text-xs text-muted max-w-3xl">
              Indicadores, taxa de frequência (TF) e registros importados. Investigação via RIAT/CAT/SINAN. Atualize a base em{' '}
              <span className="text-text">Admin → Importar bases</span>.
            </p>
          </div>
          <span className="rounded-lg border border-border bg-card px-3 py-2 text-[11px] text-muted shrink-0">
            Lista somente leitura
          </span>
        </div>
      </div>

      <section id="painel-indicadores-acidentes" className="scroll-mt-4 rounded-xl border border-border bg-panel p-4 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold">Indicadores EMSERH</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Ano</span>
            <select
              id="painel-ano"
              className="px-3 py-2 rounded bg-card border border-border text-sm min-w-[5.5rem]"
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
        <p className="text-xs text-muted -mt-2">
          TF e totais por regional vêm da base importada (sem digitação manual aqui).
        </p>

        {painelLoading ? (
          <p className="text-sm text-muted py-4">Carregando indicadores…</p>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-[11px] text-muted">Taxa de frequência (ano)</p>
                <p className="text-2xl font-bold tabular-nums text-text mt-1">
                  {painelData?.taxaFrequenciaAnualEmserh != null ? painelData.taxaFrequenciaAnualEmserh.toFixed(2) : '—'}
                </p>
                <p className="text-[10px] text-muted mt-2">
                  {painelData != null
                    ? `${painelData.totalAcidentesAno} acidentes no ano`
                    : 'Indicadores indisponíveis.'}
                  {painelData?.fonteAtivosTF === 'alterdata' ? ' · Ativos TF: Alterdata' : ''}
                </p>
              </div>
              {REGIONALS.map((r) => (
                <div key={`acc-${r}`} className="rounded-lg border border-border bg-card p-3">
                  <p className="text-[11px] text-muted">Acidentes — {r}</p>
                  <p className="text-xl font-bold tabular-nums text-text mt-1">{painelData?.acidentesPorRegional?.[r] ?? 0}</p>
                </div>
              ))}
            </div>

            <p className="text-sm font-semibold text-text pt-1">Investigados</p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-[11px] text-muted">Total EMSERH</p>
                <p className="text-xl font-bold tabular-nums mt-1">{painelData?.investigadosNoAno ?? 0}</p>
              </div>
              {REGIONALS.map((r) => (
                <div key={`inv-${r}`} className="rounded-lg border border-border bg-card p-3">
                  <p className="text-[11px] text-muted">{r}</p>
                  <p className="text-lg font-bold tabular-nums mt-1">{painelData?.investigadosPorRegional?.[r] ?? 0}</p>
                </div>
              ))}
            </div>

            <p className="text-sm font-semibold text-text">Aderência ao plano de ação (%)</p>
            {painelData?.notaAderencia ? <p className="text-[11px] text-muted mb-2">{painelData.notaAderencia}</p> : null}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-[11px] text-muted">EMSERH</p>
                <p className="text-lg font-bold tabular-nums mt-1">
                  {painelData?.aderenciaPlanoAcaoPercent != null ? `${painelData.aderenciaPlanoAcaoPercent.toFixed(1)}%` : '—'}
                </p>
              </div>
              {REGIONALS.map((r) => {
                const p = painelData?.aderenciaPorRegional?.[r];
                return (
                  <div key={`pa-${r}`} className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] text-muted">{r}</p>
                    <p className="text-lg font-bold tabular-nums mt-1">{p != null ? `${p.toFixed(0)}%` : '—'}</p>
                  </div>
                );
              })}
            </div>

            <p className="text-sm font-semibold text-text">Divulgação programas legais (%)</p>
            {painelData?.notaDivulgacao ? <p className="text-[11px] text-muted mb-2">{painelData.notaDivulgacao}</p> : null}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-[11px] text-muted">EMSERH</p>
                <p className="text-lg font-bold tabular-nums mt-1">
                  {painelData?.unidadesDivulgacaoProgramasLegaisPercent != null
                    ? `${painelData.unidadesDivulgacaoProgramasLegaisPercent}%`
                    : '—'}
                </p>
              </div>
              {REGIONALS.map((r) => {
                const v = painelData?.divulgacaoProgramasLegaisPorRegional?.[r];
                return (
                  <div key={`div-${r}`} className="rounded-lg border border-border bg-card p-3">
                    <p className="text-[11px] text-muted">{r}</p>
                    <p className="text-lg font-bold tabular-nums mt-1">{v != null ? `${v}%` : '—'}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <div id="filtros-acidentes" className="scroll-mt-4 rounded-xl border border-border bg-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-lg font-semibold">Filtros</h2>
          <button
            type="button"
            className="px-2 py-1 text-xs border border-border rounded bg-card text-muted hover:text-text"
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
            Limpar
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <select
            className={fieldClass}
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
          <select
            className={fieldClass}
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
          <select
            className={fieldClass}
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
          <select
            className={fieldClass}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value || '');
              setPage(1);
            }}
          >
            <option value="">Todos os status</option>
            {STATUS_ACIDENTE.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <select
            className={fieldClass}
            value={empresa}
            onChange={(e) => {
              setEmpresa(e.target.value || '');
              setPage(1);
            }}
          >
            <option value="">Todas empresas</option>
            <option value="IADVH">IADVH</option>
            <option value="EMSERH">EMSERH</option>
          </select>
          <select
            className={fieldClass}
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
          <select
            className={fieldClass}
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
          <input
            type="search"
            className={fieldClass}
            placeholder="Buscar nome, unidade, CAT…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      <div className="space-y-4">
        <section id="visao-geral-acidentes" className="scroll-mt-4 rounded-xl border border-border bg-panel p-4">
          <h2 className="text-lg font-semibold mb-3">Resumo</h2>
          <p className="text-xs text-muted mb-3">Conforme filtros regional e ano da lista.</p>
          {statsLoading ? (
            <p className="text-sm text-muted">Carregando…</p>
          ) : stats ? (
            <>
              <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1">
                <div className="rounded-lg border border-border bg-card px-3 py-2.5 min-w-[5rem] shrink-0">
                  <p className="text-[11px] text-muted">Ano</p>
                  <p className="text-lg font-bold tabular-nums">{stats.totalAno}</p>
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-2.5 min-w-[5rem] shrink-0">
                  <p className="text-[11px] text-muted">Mês</p>
                  <p className="text-lg font-bold tabular-nums">{stats.totalMes}</p>
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-2.5 min-w-[5rem] shrink-0">
                  <p className="text-[11px] text-muted">Com afast.</p>
                  <p className="text-lg font-bold tabular-nums text-red-500 dark:text-red-400">{stats.comAfastamento}</p>
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-2.5 min-w-[5rem] shrink-0">
                  <p className="text-[11px] text-muted">Sem afast.</p>
                  <p className="text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{stats.semAfastamento}</p>
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-2.5 min-w-[5rem] shrink-0">
                  <p className="text-[11px] text-muted">Investig.</p>
                  <p className="text-lg font-bold tabular-nums">{stats.totalInvestigados ?? 0}</p>
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-2.5 min-w-[12rem] shrink-0">
                  <p className="text-[11px] text-muted mb-1">Por regional</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                    {!stats.porRegional?.length ? (
                      <span className="text-muted">—</span>
                    ) : (
                      (stats.porRegional ?? []).map((r) => (
                        <span key={r.regional} className="whitespace-nowrap">
                          <span className="text-muted">{r.regional}</span>{' '}
                          <span className="font-semibold tabular-nums">{r.quantidade}</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-card px-3 py-2.5 min-w-[12rem] shrink-0">
                  <p className="text-[11px] text-muted mb-1">Por tipo</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                    {!stats.porTipo?.length ? (
                      <span className="text-muted">—</span>
                    ) : (
                      (stats.porTipo ?? []).map((t) => (
                        <span key={t.tipo} className="whitespace-nowrap" title={TIPOS_ACIDENTE.find((tp) => tp.value === t.tipo)?.label}>
                          <span className="text-muted truncate inline-block max-w-[6rem] align-bottom">
                            {TIPOS_ACIDENTE.find((tp) => tp.value === t.tipo)?.label || t.tipo}
                          </span>{' '}
                          <span className="font-semibold tabular-nums">{t.quantidade}</span>
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
              {((stats.porRegionalInvestigados?.length ?? 0) > 0 || (stats.porTipoInvestigados?.length ?? 0) > 0) && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] border-t border-border pt-3">
                  <div className="rounded-lg border border-border bg-card p-2">
                    <p className="font-semibold text-text mb-1">Investigados por regional</p>
                    <div className="space-y-0.5 max-h-24 overflow-y-auto">
                      {(stats.porRegionalInvestigados ?? []).map((r) => (
                        <div key={r.regional} className="flex justify-between gap-2">
                          <span className="truncate text-muted">{r.regional}</span>
                          <span className="font-medium tabular-nums">{r.quantidade}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-border bg-card p-2">
                    <p className="font-semibold text-text mb-1">Investigados por tipo</p>
                    <div className="space-y-0.5 max-h-24 overflow-y-auto">
                      {(stats.porTipoInvestigados ?? []).map((t) => (
                        <div key={t.tipo} className="flex justify-between gap-2">
                          <span className="truncate text-muted">
                            {TIPOS_ACIDENTE.find((tp) => tp.value === t.tipo)?.label || t.tipo}
                          </span>
                          <span className="font-medium tabular-nums">{t.quantidade}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-muted">Nenhuma estatística disponível.</p>
          )}
        </section>

        <section id="taxa-frequencia-acidentes" className="scroll-mt-4 rounded-xl border border-border bg-panel p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Taxa de frequência (TF)</h2>
            <select
              className="px-3 py-2 rounded bg-card border border-border text-sm min-w-[8rem]"
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
                    {tfAnosComDados.includes(y) ? ' · dados' : ''}
                  </option>
                ))}
            </select>
          </div>
          <p className="text-xs text-muted">
            HHT = ativos × 150 por mês. Acidentes vêm da base. Ativos: preencha ou use Alterdata.
            {tfLoading ? <span className="ml-2 text-text">Carregando…</span> : null}
          </p>
          {tfAnosComDados.length > 0 && (
            <p className="text-[11px] text-muted">Anos com registros na base: {tfAnosComDados.join(', ')}.</p>
          )}

          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="min-w-[56rem] w-full text-[11px]">
              <thead>
                <tr className="border-b border-border bg-card/10">
                  <th className="px-2 py-2 text-left text-muted font-medium w-36 sticky left-0 bg-card/10 z-[1]">Indicador</th>
                  {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((nome) => (
                    <th key={nome} className="px-1 py-2 text-center text-muted font-medium min-w-[3.25rem]">
                      {nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="px-2 py-1.5 text-muted sticky left-0 bg-panel z-[1]">
                    Colab. ativos
                    {tfFonteAtivos === 'alterdata' ? <span className="block text-[10px] text-emerald-600">Alterdata</span> : null}
                  </td>
                  {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m) => {
                    const linha = tfMeses[m];
                    return (
                      <td key={m} className="px-0.5 py-1">
                        <input
                          type="number"
                          min={0}
                          className="w-full min-w-[2.75rem] px-1 py-1.5 rounded border border-border bg-card text-center tabular-nums text-xs"
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
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-t border-border">
                  <td className="px-2 py-1.5 text-muted sticky left-0 bg-panel z-[1]">HHT</td>
                  {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m) => {
                    const linha = tfMeses[m];
                    const horasNum = parseInt(linha?.horas ?? '', 10);
                    const horasStr = Number.isNaN(horasNum) ? '—' : horasNum.toLocaleString('pt-BR');
                    return (
                      <td key={m} className="px-1 py-1.5 text-center tabular-nums text-text">
                        {horasStr}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-t border-border">
                  <td className="px-2 py-1.5 text-muted sticky left-0 bg-panel z-[1]">Nº acidentes</td>
                  {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m) => {
                    const linha = tfMeses[m];
                    const acc = linha?.accidentes ?? '0';
                    const n = parseInt(acc, 10);
                    const accStr = Number.isNaN(n) ? '0' : n.toLocaleString('pt-BR');
                    return (
                      <td key={m} className="px-1 py-1.5 text-center tabular-nums font-medium">
                        {accStr}
                      </td>
                    );
                  })}
                </tr>
                <tr className="border-t border-border">
                  <td className="px-2 py-1.5 text-muted sticky left-0 bg-panel z-[1]">TF</td>
                  {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m) => {
                    const linha = tfMeses[m];
                    return (
                      <td key={m} className="px-1 py-1.5 text-center tabular-nums">
                        {linha?.tf && linha.tf !== '--'
                          ? Number(linha.tf).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : '—'}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border">
              <p className="text-xs text-muted">Salve os ativos do ano para persistir e recalcular a TF.</p>
              <button
                type="button"
                disabled={tfSavingAtivos}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
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

      <section id="registros-acidentes" className="scroll-mt-4 rounded-xl border border-border bg-panel">
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Registros</h2>
          <p className="text-xs text-muted mt-1">
            {listRangeLabel} · Total no filtro: <span className="font-semibold text-text">{total.toLocaleString('pt-BR')}</span>
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-[11px]">
            <thead className="bg-card/10">
              <tr>
                <th className="px-2 py-2 text-center w-8" aria-label="Expandir" />
                <th className="px-3 py-2 text-left">Nome</th>
                <th className="px-3 py-2 text-left">Empresa</th>
                <th className="px-3 py-2 text-left">Unidade</th>
                <th className="px-3 py-2 text-left">Tipo</th>
                <th className="px-3 py-2 text-center">Afastamento</th>
                <th className="px-3 py-2 text-center">Data</th>
                <th className="px-3 py-2 text-center">Hora</th>
                <th className="px-3 py-2 text-center">Mês</th>
                <th className="px-3 py-2 text-center">CAT</th>
                <th className="px-3 py-2 text-center">RIAT</th>
                <th className="px-3 py-2 text-center">SINAN</th>
                <th className="px-3 py-2 text-center">Status</th>
                <th className="px-3 py-2 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
                {loading && (
                  <tr>
                    <td colSpan={14} className="px-3 py-8 text-center text-muted">
                      Carregando…
                    </td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={14} className="px-3 py-8 text-center">
                      {listError ? (
                        <>
                          <p className="text-sm text-red-400">{listError}</p>
                          <button
                            type="button"
                            className="mt-2 px-3 py-1.5 text-xs border border-border rounded bg-card"
                            onClick={() => setListKey((k) => k + 1)}
                          >
                            Recarregar
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-muted">Nenhum acidente encontrado.</p>
                          {total === 0 && (
                            <p className="mt-2 text-[11px] text-muted">Tente «Todos os anos» no filtro.</p>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                )}
                {!loading &&
                  rows.map((row) => {
                    const isExpanded = expandedRows.has(row.id);
                    return (
                      <React.Fragment key={row.id}>
                        <tr className="border-t border-border hover:bg-card/10">
                          <td className="px-2 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => toggleExpand(row.id)}
                              className="text-muted hover:text-text p-0.5"
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="px-3 py-2">{row.nome}</td>
                          <td className="px-3 py-2">{row.empresa}</td>
                          <td className="px-3 py-2 max-w-[14rem] truncate" title={row.unidadeHospitalar}>
                            {row.unidadeHospitalar}
                          </td>
                          <td className="px-3 py-2 text-[10px] leading-snug">
                            {TIPOS_ACIDENTE.find((t) => t.value === row.tipo)?.label || row.tipo}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.comAfastamento ? (
                              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-medium text-white dark:bg-red-900/40 dark:text-red-100">
                                Com afastamento
                              </span>
                            ) : (
                              <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-medium text-white dark:bg-emerald-900/40 dark:text-emerald-100">
                                Sem afastamento
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center tabular-nums">{formatDate(row.data)}</td>
                          <td className="px-3 py-2 text-center">{row.hora || '-'}</td>
                          <td className="px-3 py-2 text-center">
                            {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][row.mes - 1]}
                          </td>
                          <td className="px-3 py-2 text-center font-mono text-[10px]">{row.numeroCAT || '-'}</td>
                          <td className="px-3 py-2 text-center truncate max-w-[4rem]" title={row.riat || undefined}>
                            {row.riat || '-'}
                          </td>
                          <td className="px-3 py-2 text-center truncate max-w-[4rem]" title={row.sinan || undefined}>
                            {row.sinan || '-'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <span
                              className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                row.status === 'concluido'
                                  ? 'bg-emerald-500 text-white dark:bg-emerald-900/40 dark:text-emerald-100'
                                  : row.status === 'cancelado'
                                  ? 'bg-neutral-600 text-white dark:bg-neutral-900/40 dark:text-neutral-100'
                                  : row.status === 'em_analise'
                                  ? 'bg-amber-500 text-white dark:bg-amber-900/40 dark:text-amber-100'
                                  : 'bg-blue-500 text-white dark:bg-blue-900/40 dark:text-blue-100'
                              }`}
                            >
                              {STATUS_ACIDENTE.find((s) => s.value === row.status)?.label || row.status}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center">
                            <div className="inline-flex items-center gap-1 flex-wrap justify-center">
                              {row.hasInvestigacao && (
                                <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-medium text-white" title="Investigação">
                                  OK
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => openInvestigacao(row)}
                                className="inline-flex items-center gap-1 rounded bg-amber-600 px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-amber-500"
                              >
                                <FileSpreadsheet className="h-3 w-3" aria-hidden />
                                {row.hasInvestigacao ? 'Ver/Editar' : 'Investigar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-card/5">
                            <td colSpan={14} className="px-4 py-2 border-t border-border">
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
                                <span>
                                  <span className="font-medium text-text">Data/Hora: </span>
                                  {formatDate(row.data)} {row.hora || ''}
                                </span>
                                <span>
                                  <span className="font-medium text-text">Unidade: </span>
                                  {row.unidadeHospitalar}
                                </span>
                                <span>
                                  <span className="font-medium text-text">Regional: </span>
                                  {row.regional || '—'}
                                </span>
                                <span>
                                  <span className="font-medium text-text">Função: </span>
                                  {row.funcaoTrabalhador || '—'}
                                </span>
                                <span>
                                  <span className="font-medium text-text">CAT: </span>
                                  {row.numeroCAT || '—'}
                                </span>
                                <span className="w-full text-[10px] italic sm:w-auto">
                                  RIAT em Excel: use Investigar para modelo e link.
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
        <div className="flex items-center justify-between gap-2 p-3 text-xs text-text border-t border-border">
          <span className="text-muted">{listRangeLabel}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="px-2 py-1 border border-border rounded disabled:opacity-40 bg-card"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Anterior
            </button>
            <span>
              Página {page} / {totalPages}
            </span>
            <button
              type="button"
              className="px-2 py-1 border border-border rounded disabled:opacity-40 bg-card"
              onClick={() => setPage((p) => (p < totalPages ? p + 1 : p))}
              disabled={page >= totalPages}
            >
              Próxima
            </button>
          </div>
        </div>
      </section>

      {investigacaoRow && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={closeInvestigacao} aria-hidden />
          <div className="relative flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-border bg-panel shadow-xl md:max-w-2xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-panel px-4 py-3">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-text truncate">Investigação (RIAT, CAT, SINAN)</h2>
                <p className="text-xs text-muted truncate">{investigacaoRow.nome}</p>
              </div>
              <button
                type="button"
                onClick={closeInvestigacao}
                className="shrink-0 rounded-lg border border-border bg-card p-2 text-muted hover:bg-card/80"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto p-5 text-xs md:p-6">
              <section className="rounded-xl border border-border bg-card p-4">
                <h3 className="mb-3 text-xs font-semibold text-muted uppercase tracking-wide">
                  Dados do acidente
                </h3>
                <dl className="grid gap-3 sm:grid-cols-2">
                  {[
                    ['Trabalhador', investigacaoRow.nome],
                    ['Data / hora', `${formatDate(investigacaoRow.data)} ${investigacaoRow.hora || ''}`.trim()],
                    ['Unidade', investigacaoRow.unidadeHospitalar],
                    ['Regional', investigacaoRow.regional || '—'],
                    ['CAT', investigacaoRow.numeroCAT || '—'],
                    [
                      'Tipo',
                      TIPOS_ACIDENTE.find((t) => t.value === investigacaoRow.tipo)?.label || investigacaoRow.tipo,
                    ],
                  ].map(([k, v]) => (
                    <div key={String(k)} className="min-w-0">
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{k}</dt>
                      <dd className="mt-0.5 break-words text-sm text-text">{v}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section className="space-y-4 rounded-xl border border-border bg-panel p-4">
                <div>
                  <h3 className="text-xs font-semibold text-text">Documentos e status</h3>
                  <p className="mt-1 text-[11px] text-muted leading-relaxed">
                    Informe o <strong className="text-text">link</strong> de cada arquivo (Drive, OneDrive ou URL) e o nome opcional.
                  </p>
                </div>
                {investigacaoLoading ? (
                  <p className="text-muted">Carregando...</p>
                ) : (
                  <>
                    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-background/80 p-4">
                      <p className="text-[11px] leading-relaxed text-muted">
                        Baixe o modelo RIAT <strong className="text-text">em branco</strong>. Na primeira investigação o
                        download pode iniciar automaticamente; use o botão para baixar novamente. Depois de preencher, envie à
                        pasta do Drive e cole o link no campo RIAT.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={downloadRiatPreenchida}
                          disabled={investigacaoRiatDownloading}
                          className="rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
                        >
                          {investigacaoRiatDownloading ? 'Baixando…' : 'Baixar modelo RIAT'}
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
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                        Status da investigação
                      </label>
                      <select
                        value={investigacaoForm.statusInvestigacao}
                        onChange={(e) => setInvestigacaoForm((f) => ({ ...f, statusInvestigacao: e.target.value }))}
                        className="w-full rounded border border-border bg-card px-3 py-2 text-sm outline-none"
                      >
                        <option value="">Selecione</option>
                        <option value="em_andamento">Em andamento</option>
                        <option value="concluida">Concluída</option>
                      </select>
                    </div>

                    <div className="grid gap-4">
                      <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                        <span className="text-xs font-semibold text-text">RIAT</span>
                        <input
                          type="url"
                          placeholder="https://… (link do arquivo)"
                          value={investigacaoForm.riatUrl}
                          onChange={(e) => setInvestigacaoForm((f) => ({ ...f, riatUrl: e.target.value }))}
                          className={fieldClass}
                        />
                        <input
                          type="text"
                          placeholder="Nome do arquivo (opcional)"
                          value={investigacaoForm.riatNome}
                          onChange={(e) => setInvestigacaoForm((f) => ({ ...f, riatNome: e.target.value }))}
                          className={fieldClass}
                        />
                        {investigacaoForm.riatUrl && (
                          <a href={investigacaoForm.riatUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline">
                            Abrir documento →
                          </a>
                        )}
                      </div>
                      <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                        <span className="text-xs font-semibold text-text">CAT</span>
                        <input
                          type="url"
                          placeholder="https://… (link do arquivo)"
                          value={investigacaoForm.catUrl}
                          onChange={(e) => setInvestigacaoForm((f) => ({ ...f, catUrl: e.target.value }))}
                          className={fieldClass}
                        />
                        <input
                          type="text"
                          placeholder="Nome do arquivo (opcional)"
                          value={investigacaoForm.catNome}
                          onChange={(e) => setInvestigacaoForm((f) => ({ ...f, catNome: e.target.value }))}
                          className={fieldClass}
                        />
                        {investigacaoForm.catUrl && (
                          <a href={investigacaoForm.catUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline">
                            Abrir documento →
                          </a>
                        )}
                      </div>
                      <div className="space-y-2 rounded-lg border border-border bg-card p-3">
                        <span className="text-xs font-semibold text-text">SINAN</span>
                        <input
                          type="url"
                          placeholder="https://… (link do arquivo)"
                          value={investigacaoForm.sinanUrl}
                          onChange={(e) => setInvestigacaoForm((f) => ({ ...f, sinanUrl: e.target.value }))}
                          className={fieldClass}
                        />
                        <input
                          type="text"
                          placeholder="Nome do arquivo (opcional)"
                          value={investigacaoForm.sinanNome}
                          onChange={(e) => setInvestigacaoForm((f) => ({ ...f, sinanNome: e.target.value }))}
                          className={fieldClass}
                        />
                        {investigacaoForm.sinanUrl && (
                          <a href={investigacaoForm.sinanUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline">
                            Abrir documento →
                          </a>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted">
                        Observações
                      </label>
                      <textarea
                        placeholder="Conclusões, medidas, pendências…"
                        value={investigacaoForm.observacoes}
                        onChange={(e) => setInvestigacaoForm((f) => ({ ...f, observacoes: e.target.value }))}
                        className="w-full min-h-[100px] px-3 py-2 rounded border border-border bg-card text-sm outline-none"
                        rows={4}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-4">
                      <button
                        type="button"
                        onClick={closeInvestigacao}
                        className="rounded border border-border bg-card px-4 py-2 text-xs font-medium hover:bg-card/80"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={saveInvestigacao}
                        disabled={investigacaoSaving}
                        className="rounded-lg bg-amber-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-amber-500 disabled:opacity-50"
                      >
                        {investigacaoSaving ? 'Salvando…' : 'Salvar investigação'}
                      </button>
                    </div>
                    <p className="text-[10px] leading-relaxed text-muted">
                      Após preencher o Excel, a assinatura digital pode ser feita com o Gov.br Assinador.
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

