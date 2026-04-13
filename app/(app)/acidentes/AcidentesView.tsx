'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { REGIONALS } from '@/lib/unidReg';
import { ChevronDown, ChevronUp, FileSpreadsheet, FolderOpen, X } from 'lucide-react';

type AcidenteRow = {
  id: string;
  nome: string;
  unidadeHospitalar: string;
  regional: string | null;
  tipo: string;
  comAfastamento: boolean;
  data: string;
  hora: string | null;
  mes: number;
  ano: number;
  numeroCAT: string | null;
  status: string;
  descricao: string | null;
  setor?: string | null;
  funcaoTrabalhador?: string | null;
  tipoVinculo?: string | null;
  causaImediata?: string | null;
  causaRaiz?: string | null;
  fatoresContrib?: string | null;
  hasInvestigacao?: boolean;
  /** Preenchidos a partir da investigação (links/nomes); exibidos na linha expandida. */
  riatInvestigacao?: { label: string; href: string | null } | null;
  sinanInvestigacao?: { label: string; href: string | null } | null;
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

/** Painel, TF e filtros de ano: apenas 2026 em diante. */
const ANO_MIN_ACIDENTES = 2026;

function anosAcidentesSelect(): number[] {
  const cy = new Date().getFullYear();
  const end = Math.max(cy, ANO_MIN_ACIDENTES) + 1;
  const out: number[] = [];
  for (let y = end; y >= ANO_MIN_ACIDENTES; y--) out.push(y);
  return out;
}

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

type MensalRegionalPayload = {
  ano: number;
  porRegionalMes: Record<string, number[]>;
  outrosPorMes: number[] | null;
  totalPorMes: number[];
  totalPorRegional: Record<string, number>;
  totalOutros: number;
  totalAno: number;
};

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

  const defaultAnoAcidentes = String(Math.max(ANO_MIN_ACIDENTES, new Date().getFullYear()));
  const [painelAno, setPainelAno] = useState(defaultAnoAcidentes);

  const [mensalRegional, setMensalRegional] = useState<MensalRegionalPayload | null>(null);
  const [mensalRegionalLoading, setMensalRegionalLoading] = useState(false);

  // Taxa de Frequência (TF) - edição anual (12 meses)
  const [tfAno, setTfAno] = useState<string>(defaultAnoAcidentes);
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
          const candidatos = d.anosComDados!.filter((y) => y >= ANO_MIN_ACIDENTES);
          if (candidatos.length > 0) setTfAno(String(Math.max(...candidatos)));
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
  }, [regional, unidade, tipo, status, ano, mes, q, page, listKey]);

  useEffect(() => {
    const y = parseInt(painelAno, 10);
    if (Number.isNaN(y) || y < ANO_MIN_ACIDENTES) {
      setMensalRegional(null);
      return;
    }
    setMensalRegionalLoading(true);
    fetch(`/api/acidentes/mensal-regional?ano=${y}`, { cache: 'no-store' })
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        if (r.ok && data?.porRegionalMes && Array.isArray(data.totalPorMes)) {
          setMensalRegional(data as MensalRegionalPayload);
        } else {
          setMensalRegional(null);
        }
      })
      .catch(() => setMensalRegional(null))
      .finally(() => setMensalRegionalLoading(false));
  }, [painelAno]);

  const tfAnosComDadosFiltrados = useMemo(
    () => tfAnosComDados.filter((y) => y >= ANO_MIN_ACIDENTES),
    [tfAnosComDados]
  );

  const tfYearOptions = useMemo(() => {
    const set = new Set(anosAcidentesSelect());
    for (const y of tfAnosComDadosFiltrados) set.add(y);
    const cur = parseInt(tfAno, 10);
    if (!Number.isNaN(cur) && cur >= ANO_MIN_ACIDENTES) set.add(cur);
    return [...set].sort((a, b) => b - a);
  }, [tfAnosComDadosFiltrados, tfAno]);

  const painelYearOptions = useMemo(() => {
    const set = new Set(anosAcidentesSelect());
    const cur = parseInt(painelAno, 10);
    if (!Number.isNaN(cur) && cur >= ANO_MIN_ACIDENTES) set.add(cur);
    return [...set].sort((a, b) => b - a);
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
          <h2 className="text-lg font-semibold">Acidentes no ano</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Ano</span>
            <select
              id="painel-ano"
              className="px-3 py-2 rounded bg-card border border-border text-sm min-w-[5.5rem]"
              value={painelAno}
              onChange={(e) => setPainelAno(e.target.value)}
            >
              {painelYearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-muted -mt-2">Contagens mensais por regional, conforme a base importada.</p>

        <div className="rounded-lg border border-border bg-card/40 overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border bg-card/60">
            <p className="text-sm font-semibold text-text">Distribuição mensal por regional</p>
            <p className="text-[11px] text-muted mt-0.5">
              Quantidade de acidentes registrados em cada mês (Norte, Leste, Centro, Sul) — ano {painelAno}.
            </p>
          </div>
          <div className="overflow-x-auto">
            {mensalRegionalLoading ? (
              <p className="text-sm text-muted py-8 text-center px-3">Carregando tabela mensal…</p>
            ) : mensalRegional ? (
              <table className="w-full text-[11px] min-w-[44rem] border-collapse">
                <thead>
                  <tr className="border-b border-border bg-card/30">
                    <th className="text-left font-medium text-muted px-3 py-2 sticky left-0 z-[1] bg-card/95 backdrop-blur-sm min-w-[7rem]">
                      Regional
                    </th>
                    {MESES_CURTOS.map((nome) => (
                      <th key={nome} className="text-center font-medium text-muted px-1 py-2 min-w-[2.5rem]">
                        {nome}
                      </th>
                    ))}
                    <th className="text-center font-semibold text-text px-2 py-2 min-w-[3rem] border-l border-border">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {REGIONALS.map((r) => {
                    const meses = mensalRegional.porRegionalMes?.[r] ?? Array(12).fill(0);
                    const rowTotal = mensalRegional.totalPorRegional?.[r] ?? meses.reduce((a, b) => a + b, 0);
                    return (
                      <tr key={r} className="border-b border-border/80 hover:bg-card/20">
                        <td className="px-3 py-1.5 font-medium text-text sticky left-0 z-[1] bg-panel/95 backdrop-blur-sm">
                          {r}
                        </td>
                        {meses.map((v, idx) => (
                          <td
                            key={idx}
                            className={`text-center tabular-nums py-1.5 px-0.5 ${
                              v > 0 ? 'text-text font-medium' : 'text-muted'
                            }`}
                          >
                            {v}
                          </td>
                        ))}
                        <td className="text-center tabular-nums font-semibold text-text py-1.5 border-l border-border">
                          {rowTotal}
                        </td>
                      </tr>
                    );
                  })}
                  {mensalRegional.outrosPorMes && mensalRegional.totalOutros > 0 ? (
                    <tr className="border-b border-border/80 hover:bg-card/20">
                      <td className="px-3 py-1.5 text-muted italic sticky left-0 z-[1] bg-panel/95 backdrop-blur-sm">
                        Demais / não informado
                      </td>
                      {mensalRegional.outrosPorMes.map((v, idx) => (
                        <td
                          key={idx}
                          className={`text-center tabular-nums py-1.5 ${v > 0 ? 'text-text' : 'text-muted'}`}
                        >
                          {v}
                        </td>
                      ))}
                      <td className="text-center tabular-nums font-medium border-l border-border">
                        {mensalRegional.totalOutros}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
                <tfoot>
                  <tr className="bg-card/25 border-t border-border">
                    <td className="px-3 py-2 font-semibold text-text sticky left-0 z-[1] bg-card/90 backdrop-blur-sm">
                      Total EMSERH
                    </td>
                    {(mensalRegional.totalPorMes ?? []).map((v, idx) => (
                      <td key={idx} className="text-center tabular-nums font-semibold text-text py-2">
                        {v}
                      </td>
                    ))}
                    <td className="text-center tabular-nums font-bold text-text py-2 border-l border-border">
                      {mensalRegional.totalAno ?? 0}
                    </td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <p className="text-sm text-muted py-8 text-center px-3">Não foi possível carregar a distribuição mensal.</p>
            )}
          </div>
        </div>
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
            value={ano}
            onChange={(e) => {
              setAno(e.target.value);
              setPage(1);
            }}
          >
            <option value="todos">Todos os anos</option>
            {anosAcidentesSelect().map((y) => (
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

      <section id="taxa-frequencia-acidentes" className="scroll-mt-4 rounded-xl border border-border bg-panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/40 px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight text-text">Taxa de frequência</h2>
            {tfFonteAtivos === 'alterdata' ? (
              <p className="mt-1">
                <span className="inline-flex items-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                  Ativos · Alterdata
                </span>
              </p>
            ) : null}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {tfLoading ? (
              <span className="text-[11px] text-muted tabular-nums" aria-live="polite">
                Atualizando…
              </span>
            ) : null}
            <label htmlFor="tf-ano" className="sr-only">
              Ano da taxa de frequência
            </label>
            <select
              id="tf-ano"
              className="rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium tabular-nums shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 min-w-[5.5rem]"
              value={tfAno}
              onChange={(e) => setTfAno(e.target.value)}
              disabled={tfLoading}
              title={
                tfAnosComDadosFiltrados.length > 0
                  ? `Anos com registros na base: ${tfAnosComDadosFiltrados.join(', ')}`
                  : undefined
              }
            >
              {tfYearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-4">
          <div className="overflow-x-auto rounded-lg border border-border bg-card/30 shadow-inner">
            <table className="min-w-[56rem] w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-card/80">
                  <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted w-40 sticky left-0 z-[1] bg-card/95 backdrop-blur-sm">
                    Indicador
                  </th>
                  {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'].map((nome) => (
                    <th
                      key={nome}
                      className="px-1 py-2.5 text-center text-[11px] font-semibold text-muted min-w-[3.25rem]"
                    >
                      {nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                <tr className="bg-panel/50">
                  <th
                    scope="row"
                    className="px-3 py-2 text-left font-medium text-text sticky left-0 z-[1] bg-panel/95 backdrop-blur-sm"
                  >
                    Colaboradores ativos
                  </th>
                  {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m) => {
                    const linha = tfMeses[m];
                    return (
                      <td key={m} className="px-1 py-1.5">
                        <input
                          type="number"
                          min={0}
                          className="w-full min-w-[2.75rem] rounded-md border border-border/90 bg-card px-2 py-1.5 text-center text-xs tabular-nums shadow-sm outline-none transition-colors focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20"
                          placeholder="0"
                          aria-label={`Colaboradores ativos — mês ${Number(m)}`}
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
                <tr className="bg-panel/30">
                  <th
                    scope="row"
                    className="px-3 py-2 text-left text-muted sticky left-0 z-[1] bg-panel/95 text-xs font-medium backdrop-blur-sm"
                    title="Horas-homem trabalhadas no mês"
                  >
                    HHT
                  </th>
                  {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m) => {
                    const linha = tfMeses[m];
                    const horasNum = parseInt(linha?.horas ?? '', 10);
                    const horasStr = Number.isNaN(horasNum) ? '—' : horasNum.toLocaleString('pt-BR');
                    return (
                      <td key={m} className="px-1 py-2 text-center tabular-nums text-text">
                        {horasStr}
                      </td>
                    );
                  })}
                </tr>
                <tr className="bg-panel/30">
                  <th
                    scope="row"
                    className="px-3 py-2 text-left text-muted sticky left-0 z-[1] bg-panel/95 text-xs font-medium backdrop-blur-sm"
                  >
                    Acidentes
                  </th>
                  {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m) => {
                    const linha = tfMeses[m];
                    const acc = linha?.accidentes ?? '0';
                    const n = parseInt(acc, 10);
                    const accStr = Number.isNaN(n) ? '0' : n.toLocaleString('pt-BR');
                    return (
                      <td key={m} className="px-1 py-2 text-center tabular-nums text-text">
                        {accStr}
                      </td>
                    );
                  })}
                </tr>
                <tr className="bg-emerald-500/[0.06] dark:bg-emerald-950/20">
                  <th
                    scope="row"
                    className="px-3 py-2.5 text-left text-text sticky left-0 z-[1] bg-emerald-500/[0.08] text-xs font-semibold backdrop-blur-sm dark:bg-emerald-950/35"
                    title="Taxa de frequência por milhão de horas-homem"
                  >
                    TF
                  </th>
                  {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m) => {
                    const linha = tfMeses[m];
                    return (
                      <td
                        key={m}
                        className="px-1 py-2.5 text-center text-sm font-semibold tabular-nums text-text"
                      >
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

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
            <button
                type="button"
                disabled={tfSavingAtivos}
                title="Grava colaboradores ativos do ano e atualiza a TF no sistema."
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:opacity-50"
                onClick={async () => {
                  try {
                    setTfSavingAtivos(true);
                    const anoNum = Math.max(
                      ANO_MIN_ACIDENTES,
                      parseInt(tfAno || defaultAnoAcidentes, 10) || ANO_MIN_ACIDENTES
                    );
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
                {tfSavingAtivos ? 'Salvando…' : 'Salvar colaboradores ativos'}
              </button>
          </div>
        </div>
      </section>

      <section id="registros-acidentes" className="scroll-mt-4 rounded-xl border border-border bg-panel overflow-hidden">
        <div className="border-b border-border bg-card/40 px-4 py-3">
          <h2 className="text-base font-semibold tracking-tight text-text">Registros</h2>
          <p className="mt-1 text-xs text-muted">
            {listRangeLabel} · <span className="font-semibold tabular-nums text-text">{total.toLocaleString('pt-BR')}</span> no
            filtro
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-card/80">
                <th className="w-10 px-2 py-2.5 text-center" aria-label="Expandir" />
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">Nome</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">Unidade</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted">Tipo</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
                  Afastamento
                </th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">Data</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">Hora</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">Mês</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">CAT</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">Status</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">Ações</th>
              </tr>
            </thead>
            <tbody>
                {loading && (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center text-muted">
                      Carregando…
                    </td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-3 py-8 text-center">
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
                        <tr className="border-t border-border transition-colors hover:bg-card/50">
                          <td className="px-2 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => toggleExpand(row.id)}
                              className="rounded-md p-1 text-muted transition hover:bg-card hover:text-text"
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="px-3 py-2.5 font-medium text-text">{row.nome}</td>
                          <td className="max-w-[14rem] truncate px-3 py-2.5 text-muted" title={row.unidadeHospitalar}>
                            {row.unidadeHospitalar}
                          </td>
                          <td className="px-3 py-2.5 text-[10px] leading-snug text-muted">
                            {TIPOS_ACIDENTE.find((t) => t.value === row.tipo)?.label || row.tipo}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            {row.comAfastamento ? (
                              <span className="inline-flex rounded-full bg-red-500/10 px-2.5 py-0.5 text-[10px] font-medium text-red-700 ring-1 ring-inset ring-red-500/20 dark:text-red-300 dark:ring-red-400/30">
                                Com afastamento
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-800 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300 dark:ring-emerald-400/25">
                                Sem afastamento
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-center tabular-nums text-text">{formatDate(row.data)}</td>
                          <td className="px-3 py-2.5 text-center tabular-nums text-muted">{row.hora || '—'}</td>
                          <td className="px-3 py-2.5 text-center tabular-nums text-muted">
                            {['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][row.mes - 1]}
                          </td>
                          <td className="px-3 py-2.5 text-center font-mono text-[10px] text-muted">{row.numeroCAT || '—'}</td>
                          <td className="px-3 py-2.5 text-center">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${
                                row.status === 'concluido'
                                  ? 'bg-emerald-500/10 text-emerald-800 ring-emerald-500/25 dark:text-emerald-300 dark:ring-emerald-400/30'
                                  : row.status === 'cancelado'
                                  ? 'bg-neutral-500/10 text-neutral-700 ring-neutral-500/20 dark:text-neutral-300'
                                  : row.status === 'em_analise'
                                  ? 'bg-amber-500/10 text-amber-900 ring-amber-500/25 dark:text-amber-200 dark:ring-amber-400/30'
                                  : 'bg-blue-500/10 text-blue-800 ring-blue-500/25 dark:text-blue-300 dark:ring-blue-400/30'
                              }`}
                            >
                              {STATUS_ACIDENTE.find((s) => s.value === row.status)?.label || row.status}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="inline-flex flex-wrap items-center justify-center gap-1.5">
                              {row.hasInvestigacao && (
                                <span
                                  className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-500/25 dark:text-emerald-300"
                                  title="Há registro de investigação"
                                >
                                  OK
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => openInvestigacao(row)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[10px] font-semibold text-white shadow-sm shadow-blue-600/20 transition hover:bg-blue-500"
                              >
                                <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                                {row.hasInvestigacao ? 'Ver / editar' : 'Investigar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-card/40">
                            <td colSpan={11} className="border-t border-border px-4 py-3">
                              <div className="flex flex-col gap-2 text-[11px] text-muted">
                                <div className="flex flex-wrap gap-x-4 gap-y-1">
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
                                </div>
                                <div className="flex flex-wrap gap-x-6 gap-y-2 border-t border-border/60 pt-2">
                                  {row.riatInvestigacao ? (
                                    <span className="min-w-0 max-w-full">
                                      <span className="font-medium text-text">RIAT: </span>
                                      {row.riatInvestigacao.href ? (
                                        <a
                                          href={row.riatInvestigacao.href}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="break-all text-blue-700 underline decoration-blue-600/35 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                        >
                                          {row.riatInvestigacao.label}
                                        </a>
                                      ) : (
                                        <span className="text-text">{row.riatInvestigacao.label}</span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] italic">RIAT: use «Investigar» para informar link ou nome do arquivo.</span>
                                  )}
                                  {row.sinanInvestigacao ? (
                                    <span className="min-w-0 max-w-full">
                                      <span className="font-medium text-text">SINAN: </span>
                                      {row.sinanInvestigacao.href ? (
                                        <a
                                          href={row.sinanInvestigacao.href}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="break-all text-blue-700 underline decoration-blue-600/35 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                                        >
                                          {row.sinanInvestigacao.label}
                                        </a>
                                      ) : (
                                        <span className="text-text">{row.sinanInvestigacao.label}</span>
                                      )}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] italic">SINAN: preencha na investigação quando houver documento.</span>
                                  )}
                                </div>
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-card/40 px-4 py-3 text-xs">
          <span className="text-muted">{listRangeLabel}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-text shadow-sm transition hover:bg-card/80 disabled:opacity-40"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              Anterior
            </button>
            <span className="tabular-nums text-muted">
              Página <span className="font-semibold text-text">{page}</span> / {totalPages}
            </span>
            <button
              type="button"
              className="rounded-lg border border-border bg-card px-3 py-1.5 font-medium text-text shadow-sm transition hover:bg-card/80 disabled:opacity-40"
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
          <div
            className="absolute inset-0 bg-black/40 transition-opacity dark:bg-black/60"
            onClick={closeInvestigacao}
            aria-hidden
          />
          <div className="relative flex h-full w-full max-w-xl flex-col overflow-hidden border-l border-border bg-panel shadow-lg md:max-w-2xl">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card/40 px-4 py-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold tracking-tight text-text">Investigação · RIAT, CAT e SINAN</h2>
                <p className="mt-0.5 truncate text-xs text-muted">{investigacaoRow.nome}</p>
              </div>
              <button
                type="button"
                onClick={closeInvestigacao}
                className="shrink-0 rounded-lg border border-border bg-card p-2 text-muted shadow-sm transition hover:bg-card/80 hover:text-text"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
              <section className="rounded-lg border border-border bg-card/50 p-3">
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted">Dados do acidente</h3>
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

              <section className="space-y-3 rounded-lg border border-border bg-panel p-3">
                <div>
                  <h3 className="text-sm font-semibold text-text">Documentos e status</h3>
                  <p className="mt-1 text-[11px] text-muted">
                    Informe o link de cada arquivo (Drive, OneDrive ou URL) e o nome opcional.
                  </p>
                </div>
                {investigacaoLoading ? (
                  <p className="text-muted">Carregando...</p>
                ) : (
                  <>
                    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card/40 p-3">
                      <p className="text-[11px] text-muted">
                        Baixe o modelo RIAT em branco. Na primeira investigação o download pode iniciar automaticamente; use o
                        botão para baixar novamente. Depois de preencher, envie à pasta do Drive e cole o link no campo RIAT.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={downloadRiatPreenchida}
                          disabled={investigacaoRiatDownloading}
                          className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
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
                        className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                      >
                        <option value="">Selecione</option>
                        <option value="em_andamento">Em andamento</option>
                        <option value="concluida">Concluída</option>
                      </select>
                    </div>

                    <div className="grid gap-4">
                      <div className="space-y-2 rounded-xl border border-border/70 bg-card/90 p-3 shadow-sm">
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
                      <div className="space-y-2 rounded-xl border border-border/70 bg-card/90 p-3 shadow-sm">
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
                      <div className="space-y-2 rounded-xl border border-border/70 bg-card/90 p-3 shadow-sm">
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
                        className="min-h-[100px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
                        rows={4}
                      />
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3">
                      <button
                        type="button"
                        onClick={closeInvestigacao}
                        className="rounded-lg border border-border bg-card px-4 py-2 text-xs font-medium text-muted shadow-sm transition hover:bg-card/80 hover:text-text"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={saveInvestigacao}
                        disabled={investigacaoSaving}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
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

