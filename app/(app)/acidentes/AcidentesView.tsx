'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { REGIONALS } from '@/lib/unidReg';
import { AlertTriangle, ChevronDown, ChevronUp, Eye, EyeOff, Plus, Search } from 'lucide-react';

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

type PlanoAcaoItem = {
  descricao: string;
  responsavel: string;
  prazoSugestao: string;
};

function gerarPlanoAcao(tipo: string): PlanoAcaoItem[] {
  const t = (tipo || '').toLowerCase();

  if (t.includes('queda')) {
    return [
      {
        descricao: 'Realizar inspeção detalhada do local do acidente (piso, desníveis, corrimãos, escadas e rotas de fuga).',
        responsavel: 'Engenharia / Manutenção predial',
        prazoSugestao: '30 dias',
      },
      {
        descricao: 'Avaliar necessidade de correção de piso, nivelamento, instalação de sinalização e antiderrapantes.',
        responsavel: 'Engenharia / SESMT',
        prazoSugestao: '45 dias',
      },
      {
        descricao: 'Revisar a iluminação do ambiente e pontos críticos de circulação.',
        responsavel: 'Engenharia / Manutenção elétrica',
        prazoSugestao: '30 dias',
      },
      {
        descricao: 'Realizar treinamento de prevenção de quedas e adoção de condutas seguras no deslocamento interno.',
        responsavel: 'SESMT / Educação Corporativa',
        prazoSugestao: '60 dias',
      },
      {
        descricao: 'Revisar EPCs disponíveis (corrimãos, guarda-corpos, fitas de isolamento, sinalização de degraus).',
        responsavel: 'SESMT / Engenharia',
        prazoSugestao: '45 dias',
      },
    ];
  }

  if (t.includes('trajeto') || t.includes('transito')) {
    return [
      {
        descricao: 'Analisar o deslocamento a serviço (trajeto, tempo de percurso, meios de transporte utilizados).',
        responsavel: 'SESMT / Gestão de Pessoas',
        prazoSugestao: '30 dias',
      },
      {
        descricao: 'Verificar jornada de trabalho, intervalos e possível fadiga relacionada ao acidente.',
        responsavel: 'Gestão de Pessoas / Chefia imediata',
        prazoSugestao: '30 dias',
      },
      {
        descricao: 'Planejar e executar treinamento de direção defensiva para trabalhadores que utilizam veículo a serviço.',
        responsavel: 'SESMT / Coordenação de Frota',
        prazoSugestao: '90 dias',
      },
      {
        descricao: 'Avaliar necessidade de atualização de política interna de transporte e deslocamento a serviço.',
        responsavel: 'Diretoria / Gestão de Pessoas',
        prazoSugestao: '120 dias',
      },
    ];
  }

  if (t.includes('biologico') || t.includes('perfuro') || t.includes('cortante')) {
    return [
      {
        descricao: 'Reforçar treinamento em boas práticas de biossegurança e NR-32 para a equipe envolvida.',
        responsavel: 'SESMT / Educação Permanente',
        prazoSugestao: '60 dias',
      },
      {
        descricao: 'Revisar fluxos de descarte de materiais perfurocortantes e recipientes coletores.',
        responsavel: 'SESMT / Controle de Infecção',
        prazoSugestao: '45 dias',
      },
      {
        descricao: 'Avaliar dispositivos de segurança disponíveis (agulhas com sistema de proteção, coletores adequados).',
        responsavel: 'Engenharia Clínica / Compras',
        prazoSugestao: '60 dias',
      },
      {
        descricao: 'Monitorar situação vacinal e imunização dos trabalhadores expostos.',
        responsavel: 'Saúde Ocupacional',
        prazoSugestao: '30 dias',
      },
      {
        descricao: 'Garantir notificação em sistema oficial (ex.: SINAN) quando aplicável.',
        responsavel: 'Vigilância em Saúde / SESMT',
        prazoSugestao: 'Imediato',
      },
    ];
  }

  // Plano genérico para outros tipos
  return [
    {
      descricao: 'Realizar análise detalhada do evento com participação do SESMT, gestor local e trabalhador envolvido.',
      responsavel: 'SESMT / Chefia imediata',
      prazoSugestao: '30 dias',
    },
    {
      descricao: 'Identificar causas imediatas, causas raiz e fatores contribuintes (ambiente, processo e comportamento).',
      responsavel: 'SESMT',
      prazoSugestao: '30 dias',
    },
    {
      descricao: 'Definir e registrar ações corretivas e preventivas específicas para eliminar ou mitigar o risco.',
      responsavel: 'SESMT / Gestão / Engenharia',
      prazoSugestao: '60 dias',
    },
    {
      descricao: 'Monitorar a implementação das ações definidas, com registro de evidências e datas de conclusão.',
      responsavel: 'SESMT',
      prazoSugestao: '90 dias',
    },
  ];
}

function StatusPill({ status }: { status: 'pendente' | 'andamento' | 'concluido' }) {
  const map = {
    pendente: {
      label: 'Pendente',
      className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800',
    },
    andamento: {
      label: 'Em andamento',
      className: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/20 dark:text-sky-200 dark:border-sky-800',
    },
    concluido: {
      label: 'Concluído',
      className: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800',
    },
  }[status];

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold ${map.className}`}>
      {map.label}
    </span>
  );
}

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
  }, [regional, tipo, status, empresa, ano, mes, q, page, listKey]);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
            SST • Acidentes
          </p>
          <h1 className="mt-1 text-lg font-semibold">Acidentes de Trabalho</h1>
          <p className="mt-1 text-xs text-muted">
            Registro, análise e acompanhamento de acidentes de trabalho nas unidades da EMSERH.
          </p>
        </div>
        <span className="rounded-full border border-border bg-panel px-3 py-1.5 text-[11px] text-muted">
          Somente leitura (importe em Admin → Importar bases)
        </span>
      </div>

      {/* Painel SST — indicadores (no topo; títulos conforme especificação operacional) */}
      <section
        id="painel-indicadores-acidentes"
        className="rounded-xl border-2 border-amber-500/50 bg-gradient-to-b from-amber-500/5 to-panel p-4 shadow-md space-y-4 scroll-mt-4"
      >
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-amber-500/20 pb-3">
          <h2 className="text-sm font-extrabold uppercase tracking-wide text-foreground">
            Indicadores de acidentes — EMSERH
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-muted uppercase">Ano</span>
            <select
              className="rounded-lg border-2 border-amber-500/40 bg-card px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500/60"
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
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200 py-4">Carregando indicadores...</p>
        ) : (
          <div className="space-y-5 text-xs">
            <div className="rounded-lg border border-border bg-card/80 px-4 py-3">
              <p className="text-[11px] font-extrabold uppercase text-foreground leading-snug">
                Taxa de frequência de acidentes total EMSERH
              </p>
              <p className="mt-2 text-3xl font-black tabular-nums text-emerald-700 dark:text-emerald-300">
                {painelData?.taxaFrequenciaAnualEmserh != null
                  ? painelData.taxaFrequenciaAnualEmserh.toFixed(2)
                  : '—'}
              </p>
              <p className="text-[10px] text-muted mt-1">
                {painelData != null
                  ? `${painelData.totalAcidentesAno} acidentes no ano selecionado`
                  : 'Dados do painel indisponíveis (verifique deploy da rota /api/acidentes/painel-indicadores).'}
                {painelData?.fonteAtivosTF === 'alterdata' ? ' · Ativos: Alterdata' : ''}
              </p>
            </div>

            <div>
              <p className="text-[10px] font-extrabold uppercase text-muted mb-2 tracking-wide">
                Números de acidentes EMSERH — por regional
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {REGIONALS.map((r) => (
                  <div key={`acc-${r}`} className="rounded-lg border-2 border-border bg-bg px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase text-foreground leading-tight">
                      Números de acidentes EMSERH — {r}
                    </p>
                    <p className="text-2xl font-black tabular-nums mt-1">{painelData?.acidentesPorRegional?.[r] ?? 0}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-extrabold uppercase text-muted mb-2 tracking-wide">
                Acidentes investigados
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                <div className="rounded-lg border-2 border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase">Acidentes investigados — EMSERH</p>
                  <p className="text-2xl font-black tabular-nums mt-1">{painelData?.investigadosNoAno ?? 0}</p>
                </div>
                {REGIONALS.map((r) => (
                  <div key={`inv-${r}`} className="rounded-lg border border-border bg-bg px-3 py-2.5">
                    <p className="text-[10px] font-bold uppercase">Acidentes investigados — {r}</p>
                    <p className="text-xl font-black tabular-nums mt-1">{painelData?.investigadosPorRegional?.[r] ?? 0}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-extrabold uppercase text-foreground mb-2 leading-snug">
                % aderência ao plano de ação das investigações de acidentes
              </p>
              <p className="text-[10px] text-muted mb-2">{painelData?.notaAderencia}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                <div className="rounded-lg border-2 border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase">% P.A — EMSERH</p>
                  <p className="text-2xl font-black tabular-nums mt-1">
                    {painelData?.aderenciaPlanoAcaoPercent != null
                      ? `${painelData.aderenciaPlanoAcaoPercent.toFixed(1)}%`
                      : '—'}
                  </p>
                </div>
                {REGIONALS.map((r) => {
                  const p = painelData?.aderenciaPorRegional?.[r];
                  return (
                    <div key={`pa-${r}`} className="rounded-lg border border-border bg-bg px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase leading-tight">P.A acidentes EMSERH — {r}</p>
                      <p className="text-xl font-black tabular-nums mt-1">{p != null ? `${p.toFixed(0)}%` : '—'}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-extrabold uppercase text-foreground mb-2 leading-snug">
                % unidades atendidas — divulgação programas legais
              </p>
              <p className="text-[10px] text-muted mb-2">{painelData?.notaDivulgacao}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase">Divulgação — EMSERH (total)</p>
                  <p className="text-2xl font-black tabular-nums mt-1">
                    {painelData?.unidadesDivulgacaoProgramasLegaisPercent != null
                      ? `${painelData.unidadesDivulgacaoProgramasLegaisPercent}%`
                      : '—'}
                  </p>
                </div>
                {REGIONALS.map((r) => {
                  const v = painelData?.divulgacaoProgramasLegaisPorRegional?.[r];
                  return (
                    <div key={`div-${r}`} className="rounded-lg border border-dashed border-border bg-muted/15 px-3 py-2.5">
                      <p className="text-[10px] font-bold uppercase leading-tight">
                        Divulgação programas legais EMSERH — {r}
                      </p>
                      <p className="text-xl font-black tabular-nums mt-1">{v != null ? `${v}%` : '—'}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Filtros - card padronizado */}
      <div className="rounded-xl border border-border bg-panel p-4 shadow-sm flex flex-wrap items-center gap-3 text-xs">
        <div className="flex flex-col gap-1">
          <span className="font-medium">Regional</span>
          <select
            className="w-52 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
            value={regional}
            onChange={(e) => {
              setRegional(e.target.value || '');
              setPage(1);
            }}
          >
            <option value="">Todas as Regionais</option>
            {REGIONALS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <>
            <div className="flex flex-col gap-1">
              <span className="font-medium">Tipo</span>
              <select
                className="w-44 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                value={tipo}
                onChange={(e) => {
                  setTipo(e.target.value || '');
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
                {TIPOS_ACIDENTE.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium">Status</span>
              <select
                className="w-44 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
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
            <div className="flex flex-col gap-1">
              <span className="font-medium">Empresa</span>
              <select
                className="w-36 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
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
            <div className="flex flex-col gap-1">
              <span className="font-medium">Ano</span>
              <select
                className="w-36 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                value={ano}
                onChange={(e) => {
                  setAno(e.target.value);
                  setPage(1);
                }}
              >
                <option value="todos">Todos os anos</option>
                {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <option key={y} value={String(y)}>{y}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-medium">Mês</span>
              <select
                className="w-40 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                value={mes}
                onChange={(e) => {
                  setMes(e.target.value || '');
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
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
            <div className="flex flex-col gap-1">
              <span className="font-medium">Buscar</span>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="text"
                  className="w-56 pl-8 rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
                  placeholder="Nome, unidade, CAT..."
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
        </>
      </div>

      {/* VISÃO GERAL – blocos institucionais */}
      <div className="space-y-4">
        {/* Bloco 0: Estatísticas – uma linha compacta */}
        <section className="rounded-xl border border-border bg-panel p-3 shadow-sm">
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
        </section>

        {/* Bloco 1: Taxa de Frequência (TF) */}
          <section className="rounded-xl border border-border bg-panel p-5 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Taxa de Frequência de Acidentes de Trabalho (TF)</h2>
                <p className="mt-1.5 text-xs text-muted leading-relaxed max-w-2xl">
                  Indicador calculado mensalmente com base no número de acidentes de trabalho e no
                  total de horas-homem trabalhadas, permitindo o monitoramento da frequência de
                  acidentes ao longo do tempo.
                </p>
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

              <div className="space-y-3 rounded-xl border border-border bg-bg/50 p-4 overflow-x-auto">
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

      {/* Registros de Acidentes */}
      <div className="space-y-4">
        <div className="text-xs text-muted">
          Total: <span className="font-semibold text-text">{total}</span> acidentes
        </div>

          <div className="overflow-x-auto rounded-lg border border-border bg-card">
            <table className="min-w-full text-[11px]">
              <thead className="bg-white/5 text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 text-center"></th>
                  <th className="px-3 py-2 text-center">Nome</th>
                  <th className="px-3 py-2 text-center">Empresa</th>
                  <th className="px-3 py-2 text-center">Unidade</th>
                  <th className="px-3 py-2 text-center">Tipo</th>
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
                    <td colSpan={14} className="px-3 py-6 text-center text-muted">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={14} className="px-3 py-6 text-center">
                      {listError ? (
                        <>
                          <p className="text-destructive text-sm">{listError}</p>
                          <button
                            type="button"
                            className="mt-3 rounded bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-700"
                            onClick={() => setListKey((k) => k + 1)}
                          >
                            Recarregar lista
                          </button>
                        </>
                      ) : (
                        <>
                          <p className="text-muted">Nenhum acidente encontrado.</p>
                          {total === 0 && (
                            <p className="mt-2 text-[11px] text-muted">
                              Se não aparecer nenhum acidente, selecione <strong>«Todos os anos»</strong> no filtro ou tente outro ano (ex.: 2021, 2022).
                            </p>
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
                        <tr className="border-t border-border/60">
                          <td className="px-3 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => toggleExpand(row.id)}
                              className="text-muted hover:text-text"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          <td className="px-3 py-2 text-center text-[11px]">{row.nome}</td>
                          <td className="px-3 py-2 text-center text-[11px]">{row.empresa}</td>
                          <td className="px-3 py-2 text-center text-[11px]">{row.unidadeHospitalar}</td>
                          <td className="px-3 py-2 text-center text-[11px]">
                            {TIPOS_ACIDENTE.find((t) => t.value === row.tipo)?.label || row.tipo}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {row.comAfastamento ? (
                              <span className="inline-flex rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-medium text-white dark:bg-red-900/40 dark:text-red-100">
                                Com Afastamento
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-medium text-white dark:bg-emerald-900/40 dark:text-emerald-100">
                                Sem Afastamento
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center text-[11px]">{formatDate(row.data)}</td>
                          <td className="px-3 py-2 text-center text-[11px]">{row.hora || '-'}</td>
                          <td className="px-3 py-2 text-center text-[11px]">
                            {[
                              'Jan',
                              'Fev',
                              'Mar',
                              'Abr',
                              'Mai',
                              'Jun',
                              'Jul',
                              'Ago',
                              'Set',
                              'Out',
                              'Nov',
                              'Dez',
                            ][row.mes - 1]}
                          </td>
                          <td className="px-3 py-2 text-center text-[11px]">{row.numeroCAT || '-'}</td>
                          <td className="px-3 py-2 text-center text-[11px]">{row.riat || '-'}</td>
                          <td className="px-3 py-2 text-center text-[11px]">{row.sinan || '-'}</td>
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
                            <div className="inline-flex items-center gap-1.5">
                              {row.hasInvestigacao && (
                                <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-medium text-white" title="Investigação registrada">
                                  OK
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => openInvestigacao(row)}
                                className="inline-flex items-center gap-1 rounded bg-amber-600 px-2 py-1.5 text-[10px] font-semibold text-white hover:bg-amber-500"
                              >
                                {row.hasInvestigacao ? 'Ver/Editar' : 'Investigar'}
                              </button>
                            </div>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr>
                            <td colSpan={14} className="px-3 py-3 bg-panel/50">
                              <div className="space-y-3 text-[11px]">
                                <div className="grid gap-3 md:grid-cols-3">
                                  <div className="space-y-1">
                                    <div className="font-semibold mb-1">Identificação do acidente</div>
                                    <p className="text-muted">
                                      <span className="font-medium text-text">Data/Hora: </span>
                                      {formatDate(row.data)} {row.hora || ''}
                                    </p>
                                    <p className="text-muted">
                                      <span className="font-medium text-text">Unidade: </span>
                                      {row.unidadeHospitalar}
                                    </p>
                                    <p className="text-muted">
                                      <span className="font-medium text-text">Regional: </span>
                                      {row.regional || 'Não informada'}
                                    </p>
                                    {row.setor && (
                                      <p className="text-muted">
                                        <span className="font-medium text-text">Setor: </span>
                                        {row.setor}
                                      </p>
                                    )}
                                  </div>
                                  <div className="space-y-1">
                                    <div className="font-semibold mb-1">Perfil do trabalhador</div>
                                    <p className="text-muted">
                                      <span className="font-medium text-text">Nome: </span>
                                      {row.nome}
                                    </p>
                                    {row.funcaoTrabalhador && (
                                      <p className="text-muted">
                                        <span className="font-medium text-text">Função: </span>
                                        {row.funcaoTrabalhador}
                                      </p>
                                    )}
                                    {row.tipoVinculo && (
                                      <p className="text-muted">
                                        <span className="font-medium text-text">Tipo de vínculo: </span>
                                        {row.tipoVinculo}
                                      </p>
                                    )}
                                  </div>
                                  <div className="space-y-1">
                                    <div className="font-semibold mb-1">Análise técnica</div>
                                    {row.causaImediata && (
                                      <p className="text-muted">
                                        <span className="font-medium text-text">Causa imediata: </span>
                                        {row.causaImediata}
                                      </p>
                                    )}
                                    {row.causaRaiz && (
                                      <p className="text-muted">
                                        <span className="font-medium text-text">Causa raiz: </span>
                                        {row.causaRaiz}
                                      </p>
                                    )}
                                    {row.fatoresContrib && (
                                      <p className="text-muted">
                                        <span className="font-medium text-text">Fatores contribuintes: </span>
                                        {row.fatoresContrib}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div>
                                  <div className="font-semibold mb-1">Descrição detalhada do acidente</div>
                                  <p className="mb-2 text-muted">
                                    Descreva de forma objetiva: o que aconteceu, como aconteceu, onde ocorreu,
                                    por que ocorreu, quais atividades eram executadas, se havia EPI, se o trabalhador
                                    recebeu treinamento e se foram identificados atos ou condições inseguras.
                                  </p>
                                  <div className="whitespace-pre-wrap text-[11px] bg-bg/60 rounded-lg p-3 border border-dashed border-border">
                                    {row.descricao || 'Sem descrição detalhada informada.'}
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-border">
                                  <div className="flex items-center justify-between mb-1">
                                    <div className="font-semibold">Plano de Ação Automático</div>
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-[10px] font-semibold hover:bg-card"
                                      onClick={() => {
                                        // A geração é automática com base no tipo; este botão existe para tornar
                                        // a regra explícita para o usuário.
                                        alert(
                                          'O plano de ação foi gerado automaticamente com base na classificação do acidente e pode ser ajustado pelo SESMT.',
                                        );
                                      }}
                                    >
                                      Gerar Plano de Ação
                                    </button>
                                  </div>
                                  <p className="mb-2 text-muted">
                                    Ações sugeridas automaticamente com base na classificação do acidente. O SESMT pode
                                    revisar, complementar e registrar as evidências de conclusão de cada etapa.
                                  </p>
                                  <div className="overflow-x-auto">
                                    <table className="min-w-full text-[11px]">
                                      <thead>
                                        <tr className="text-left text-muted uppercase">
                                          <th className="py-1 pr-2">Ação recomendada</th>
                                          <th className="py-1 pr-2">Responsável</th>
                                          <th className="py-1 pr-2">Prazo sugerido</th>
                                          <th className="py-1 pr-2 text-center">Status</th>
                                          <th className="py-1 pr-2">Evidência</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {gerarPlanoAcao(row.tipo).map((acao, idxAcao) => (
                                          <tr key={idxAcao} className="border-t border-border/40">
                                            <td className="py-1 pr-2 align-top">
                                              <span className="text-xs text-text">{acao.descricao}</span>
                                            </td>
                                            <td className="py-1 pr-2 align-top">
                                              <span className="text-xs text-muted">{acao.responsavel}</span>
                                            </td>
                                            <td className="py-1 pr-2 align-top">
                                              <span className="text-xs text-muted">{acao.prazoSugestao}</span>
                                            </td>
                                            <td className="py-1 pr-2 text-center align-top">
                                              <StatusPill status="pendente" />
                                            </td>
                                            <td className="py-1 pr-2 align-top text-muted">
                                              Campo para registro das evidências de conclusão da ação.
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
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
                {investigacaoRow.descricao && (
                  <p className="mt-2 pt-2 border-t border-border text-muted"><span className="font-medium">Descrição:</span> {investigacaoRow.descricao}</p>
                )}
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

