'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle, Info, Filter, RefreshCw, Search, Edit, Calendar } from 'lucide-react';
import MetaVsRealCard from '@/components/shared/MetaVsRealCard';
import { isDesignadoUnit } from '@/lib/cipa/designado';

type Toast = { id: string; message: string; type: 'success' | 'error' | 'info' };
function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2" role="region" aria-label="Notificações">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg min-w-[300px] max-w-md ${
            t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-200' :
            t.type === 'error' ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200' :
            'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200'
          }`}
        >
          {t.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0" aria-hidden />}
          {t.type === 'error' && <XCircle className="w-5 h-5 flex-shrink-0" aria-hidden />}
          {t.type === 'info' && <Info className="w-5 h-5 flex-shrink-0" aria-hidden />}
          <span className="text-sm font-medium flex-1">{t.message}</span>
          <button type="button" onClick={() => removeToast(t.id)} className="text-current opacity-70 hover:opacity-100" aria-label="Fechar notificação">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

type Row = {
  id: string | number;
  regional: string;
  unidade: string;
  ano_gestao: number;
  atividade_codigo: number;
  atividade_nome: string;
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
  data_conclusao: string | null;
  data_posse_gestao: string | null;
};

type MetaRealData = {
  meta: Record<string, number>;
  real?: Record<string, number>;
  realAcumulado: Record<string, number>;
  metaPercent?: Record<string, number>;
  realPercent?: Record<string, number>;
  metaPercentAcumulado?: Record<string, number>;
  realPercentAcumulado?: Record<string, number>;
  evolucaoMensal?: Record<string, number>;
  totalMeta: number;
  totalReal: number;
  percentTotal?: number;
  ano: number;
};

type DiagnosticoPorUnidade = {
  unidade: string;
  executadas: number;
  pendentes: number;
  itens: Array<{
    unidade: string;
    atividade_codigo: number;
    atividade_nome: string;
    data_fim_prevista: string;
    data_conclusao: string | null;
    status: 'executada' | 'pendente';
  }>;
};

type DiagnosticoData = {
  mes: string;
  mesLabel: string;
  total: number;
  executadas: number;
  pendentes: number;
  porUnidade: DiagnosticoPorUnidade[];
  computed?: boolean;
};

type ConcluidasData = {
  totalUnidades: number;
  cipasConcluidas: number;
  emAndamento: number;
  unidades: Array<{
    regional: string;
    unidade: string;
    totalAtividades: number;
    concluidas: number;
    dataUltimaConclusao: string | null;
  }>;
  computed?: boolean;
};

async function fetchJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: 'no-store', ...init });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json && (json.error || json.message)) || 'Erro ao carregar dados');
  return json;
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '-';
  const s = String(iso).trim();
  if (!s) return '-';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [yyyy, mm, dd] = s.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('pt-BR');
}

function toDateInputValue(iso: string | null | undefined): string {
  if (!iso) return '';
  const s = String(iso).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
}

/** Formata percentual com 2 casas decimais para o card Meta vs Real */
function fmtPct(n: number): string {
  return Number(n).toFixed(2);
}

export default function CipaPage() {
  const [regional, setRegional] = useState<string>('');
  const [unidade, setUnidade] = useState<string>('');
  const [ano, setAno] = useState<string>('2025');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [search, setSearch] = useState<string>('');

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [computed2026, setComputed2026] = useState(false);

  const [metaReal, setMetaReal] = useState<MetaRealData | null>(null);
  const [metaRealLoading, setMetaRealLoading] = useState(false);
  const [anoMetaReal, setAnoMetaReal] = useState<string>('2025');
  const [abaAtiva, setAbaAtiva] = useState<'indicador' | 'diagnostico' | 'concluidas'>('indicador');
  const [mesDiagnostico, setMesDiagnostico] = useState<string>(
    String(new Date().getMonth() + 1).padStart(2, '0'),
  );
  const [diagnostico, setDiagnostico] = useState<DiagnosticoData | null>(null);
  const [diagnosticoLoading, setDiagnosticoLoading] = useState(false);
  const [concluidas, setConcluidas] = useState<ConcluidasData | null>(null);
  const [concluidasLoading, setConcluidasLoading] = useState(false);

  const [regionais, setRegionais] = useState<string[]>([]);
  const [unidades, setUnidades] = useState<Array<{ unidade: string; regional: string }>>([]);

  const [modalEdicao, setModalEdicao] = useState<{ open: boolean; row: Row | null }>({ open: false, row: null });
  const [dataInicioEdit, setDataInicioEdit] = useState<string>('');
  const [dataFimEdit, setDataFimEdit] = useState<string>('');
  const [dataConclusaoEdit, setDataConclusaoEdit] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    setToasts((p) => [...p, { id, message: msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 5000);
  };
  const removeToast = (id: string) => setToasts((p) => p.filter((x) => x.id !== id));

  const [searchDebounced, setSearchDebounced] = useState('');

  useEffect(() => {
    fetchJSON(`/api/cipa/options?ano=${encodeURIComponent(ano)}`)
      .then((d: any) => {
        setRegionais(Array.isArray(d.regionais) ? d.regionais : []);
        setUnidades(Array.isArray(d.unidades) ? d.unidades : []);
      })
      .catch(() => {
        setRegionais([]);
        setUnidades([]);
      });
  }, [ano]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setSearchDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (abaAtiva === 'diagnostico' || abaAtiva === 'concluidas') return;
    loadData();
  }, [regional, unidade, ano, page, pageSize, searchDebounced, abaAtiva]);

  useEffect(() => {
    loadMetaReal();
  }, [regional, anoMetaReal]);

  useEffect(() => {
    if (abaAtiva === 'diagnostico' && regional) loadDiagnostico();
    else setDiagnostico(null);
  }, [abaAtiva, regional, anoMetaReal, mesDiagnostico]);

  useEffect(() => {
    if (abaAtiva === 'concluidas') loadConcluidas();
    else setConcluidas(null);
  }, [abaAtiva, regional, anoMetaReal]);

  // Sincroniza anoMetaReal com o filtro de ano quando mudar
  useEffect(() => {
    setAnoMetaReal(ano);
  }, [ano]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (regional) params.set('regional', regional);
      if (unidade) params.set('unidade', unidade);
      if (searchDebounced) params.set('search', searchDebounced);
      params.set('ano', ano);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      const data: any = await fetchJSON(`/api/cipa/list?${params.toString()}`);
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setTotal(Number(data.total ?? 0));
      setComputed2026(Boolean(data.computed));
    } catch (e: any) {
      setRows([]);
      setTotal(0);
      setComputed2026(false);
      showToast(e?.message || 'Erro ao carregar cronograma', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadMetaReal = async () => {
    setMetaRealLoading(true);
    try {
      const params = new URLSearchParams();
      if (regional) params.set('regional', regional);
      params.set('ano', anoMetaReal);
      const data: any = await fetchJSON(`/api/cipa/meta-real?${params.toString()}`);
      setMetaReal(data);
    } catch {
      setMetaReal(null);
    } finally {
      setMetaRealLoading(false);
    }
  };

  const loadDiagnostico = async () => {
    if (!regional) return;
    setDiagnosticoLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('regional', regional);
      params.set('ano', anoMetaReal);
      params.set('mes', mesDiagnostico);
      const data: any = await fetchJSON(`/api/cipa/diagnostico?${params.toString()}`);
      if (data?.ok) {
        setDiagnostico({
          mes: data.mes,
          mesLabel: data.mesLabel,
          total: data.total,
          executadas: data.executadas,
          pendentes: data.pendentes,
          porUnidade: data.porUnidade ?? [],
          computed: data.computed,
        });
      } else {
        setDiagnostico(null);
      }
    } catch {
      setDiagnostico(null);
    } finally {
      setDiagnosticoLoading(false);
    }
  };

  const loadConcluidas = async () => {
    setConcluidasLoading(true);
    try {
      const params = new URLSearchParams();
      if (regional) params.set('regional', regional);
      params.set('ano', anoMetaReal);
      const data: any = await fetchJSON(`/api/cipa/concluidas?${params.toString()}`);
      if (data?.ok) {
        setConcluidas({
          totalUnidades: data.totalUnidades ?? 0,
          cipasConcluidas: data.cipasConcluidas ?? 0,
          emAndamento: data.emAndamento ?? 0,
          unidades: data.unidades ?? [],
          computed: data.computed,
        });
      } else {
        setConcluidas(null);
      }
    } catch {
      setConcluidas(null);
    } finally {
      setConcluidasLoading(false);
    }
  };

  const abrirModalEdicao = (row: Row) => {
    setModalEdicao({ open: true, row });
    setDataInicioEdit(toDateInputValue(row.data_inicio_prevista));
    setDataFimEdit(toDateInputValue(row.data_fim_prevista));
    setDataConclusaoEdit(toDateInputValue(row.data_conclusao));
  };

  const fecharModalEdicao = () => {
    setModalEdicao({ open: false, row: null });
    setDataInicioEdit('');
    setDataFimEdit('');
    setDataConclusaoEdit('');
  };

  const salvarAtividade = async () => {
    if (!modalEdicao.row) return;

    const origInicio = toDateInputValue(modalEdicao.row.data_inicio_prevista);
    const origFim = toDateInputValue(modalEdicao.row.data_fim_prevista);
    const origConc = toDateInputValue(modalEdicao.row.data_conclusao);

    const body: Record<string, unknown> = {
      regional: modalEdicao.row.regional,
      unidade: modalEdicao.row.unidade,
      ano_gestao: modalEdicao.row.ano_gestao,
      atividade_codigo: modalEdicao.row.atividade_codigo,
      atividade_nome: modalEdicao.row.atividade_nome,
      data_posse_gestao: modalEdicao.row.data_posse_gestao,
    };

    if (dataInicioEdit !== origInicio) body.data_inicio_prevista = dataInicioEdit || null;
    if (dataFimEdit !== origFim) body.data_fim_prevista = dataFimEdit || null;
    if (dataConclusaoEdit !== origConc) body.data_conclusao = dataConclusaoEdit || null;

    if (
      !Object.prototype.hasOwnProperty.call(body, 'data_inicio_prevista') &&
      !Object.prototype.hasOwnProperty.call(body, 'data_fim_prevista') &&
      !Object.prototype.hasOwnProperty.call(body, 'data_conclusao')
    ) {
      showToast('Nenhuma data foi alterada.', 'info');
      return;
    }

    setSaving(true);
    try {
      const data: any = await fetchJSON('/api/cipa/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (data?.ok) {
        fecharModalEdicao();
        loadData();
        loadMetaReal();
        if (abaAtiva === 'diagnostico') loadDiagnostico();
        if (abaAtiva === 'concluidas') loadConcluidas();
        showToast('Datas atualizadas com sucesso.', 'success');
      } else {
        showToast(data?.error || 'Erro ao salvar', 'error');
      }
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const removerConclusao = async () => {
    if (!modalEdicao.row || !confirm('Deseja remover a data de conclusão desta atividade?')) return;
    setSaving(true);
    try {
      const data: any = await fetchJSON('/api/cipa/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          regional: modalEdicao.row.regional,
          unidade: modalEdicao.row.unidade,
          ano_gestao: modalEdicao.row.ano_gestao,
          atividade_codigo: modalEdicao.row.atividade_codigo,
          atividade_nome: modalEdicao.row.atividade_nome,
          data_posse_gestao: modalEdicao.row.data_posse_gestao,
          data_conclusao: null,
        }),
      });
      if (data?.ok) {
        setDataConclusaoEdit('');
        loadData();
        loadMetaReal();
        if (abaAtiva === 'diagnostico') loadDiagnostico();
        if (abaAtiva === 'concluidas') loadConcluidas();
        showToast('Data de conclusão removida.', 'success');
      } else {
        showToast(data?.error || 'Erro ao remover', 'error');
      }
    } catch (e: any) {
      showToast(e?.message || 'Erro ao remover', 'error');
    } finally {
      setSaving(false);
    }
  };

  const unidadesFiltradas = useMemo(() => {
    if (!regional) return unidades;
    const reg = regional.toUpperCase();
    return unidades.filter((u) => u.regional.toUpperCase() === reg);
  }, [regional, unidades]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const mesesKeys = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

  return (
    <div className="p-5 space-y-5">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <div className="flex flex-col gap-2">
        <nav className="text-xs text-muted">
          <a href="/dashboard" className="hover:text-text">Dashboard</a>
          <span className="mx-1">/</span>
          <span className="text-text">CIPA</span>
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-text">CIPA - Cronograma de Gestão</h1>
            <p className="text-xs text-muted mt-0.5">
              Atividades e datas de execução por regional e unidade. Unidades com CIPA por designação exibem 5 itens.
            </p>
          </div>
          <button
            onClick={() => {
              loadMetaReal();
              if (abaAtiva === 'diagnostico') loadDiagnostico();
              else if (abaAtiva === 'concluidas') loadConcluidas();
              else loadData();
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-panel hover:bg-bg text-sm font-medium transition-colors"
            aria-label="Atualizar dados"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Abas Indicador / Diagnóstico */}
      <div className="rounded-xl border border-border bg-panel shadow-sm overflow-hidden">
        <div className="flex border-b border-border">
          <button
            type="button"
            onClick={() => setAbaAtiva('indicador')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              abaAtiva === 'indicador'
                ? 'text-emerald-700 dark:text-emerald-300 border-b-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/10'
                : 'text-muted hover:text-text hover:bg-bg/50'
            }`}
          >
            Indicador
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva('diagnostico')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              abaAtiva === 'diagnostico'
                ? 'text-emerald-700 dark:text-emerald-300 border-b-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/10'
                : 'text-muted hover:text-text hover:bg-bg/50'
            }`}
          >
            Diagnóstico
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva('concluidas')}
            className={`px-4 py-2.5 text-sm font-medium transition-colors ${
              abaAtiva === 'concluidas'
                ? 'text-emerald-700 dark:text-emerald-300 border-b-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-500/10'
                : 'text-muted hover:text-text hover:bg-bg/50'
            }`}
          >
            Concluídas
          </button>
        </div>

        <div className="p-4">
          {abaAtiva === 'indicador' && (
            <>
              {metaRealLoading ? (
                <div className="py-6 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-muted">Carregando meta e progresso...</span>
                  </div>
                </div>
              ) : metaReal ? (
                <MetaVsRealCard
                  title={`Meta vs Real - CIPA ${regional ? `(${regional})` : '(Consolidado)'}`}
                  yearControl={
                    <select
                      value={anoMetaReal}
                      onChange={(e) => setAnoMetaReal(e.target.value)}
                      className="px-3 py-1.5 rounded-lg border border-border bg-bg text-xs"
                    >
                      {[2025, 2026].map((a) => (
                        <option key={a} value={String(a)}>
                          {a}
                        </option>
                      ))}
                    </select>
                  }
                  monthsShort={mesesNomes}
                  metaPct={mesesKeys.map((mes) => {
                    const q = Number(metaReal.meta?.[mes] ?? 0)
                    const percent =
                      metaReal.metaPercentAcumulado?.[mes] ??
                      metaReal.metaPercent?.[mes] ??
                      (metaReal.totalMeta > 0 ? Math.round((q / metaReal.totalMeta) * 10000) / 100 : 0)
                    return Number(percent)
                  })}
                  realPct={mesesKeys.map((mes) => {
                    const realQtd = Number(metaReal.real?.[mes] ?? metaReal.realAcumulado?.[mes] ?? 0)
                    const realAcumRaw =
                      metaReal.realPercentAcumulado?.[mes] ??
                      metaReal.realPercent?.[mes] ??
                      (metaReal.totalMeta > 0 ? Math.round((realQtd / metaReal.totalMeta) * 10000) / 100 : 0)
                    return Math.min(100, Number(realAcumRaw))
                  })}
                  evolPct={mesesKeys.map((mes) => Number(metaReal.evolucaoMensal?.[mes] ?? 0))}
                  realClassName={(idx) => {
                    const mes = mesesKeys[idx]
                    const metaAcum = Number(metaReal.metaPercentAcumulado?.[mes] ?? metaReal.metaPercent?.[mes] ?? 0)
                    const realQtd = Number(metaReal.real?.[mes] ?? metaReal.realAcumulado?.[mes] ?? 0)
                    const realAcumRaw =
                      metaReal.realPercentAcumulado?.[mes] ??
                      metaReal.realPercent?.[mes] ??
                      (metaReal.totalMeta > 0 ? Math.round((realQtd / metaReal.totalMeta) * 10000) / 100 : 0)
                    const realAcum = Math.min(100, Number(realAcumRaw))
                    const ambosZero = metaAcum === 0 && realAcum === 0
                    const atingiu = realAcum >= metaAcum - 0.01
                    return ambosZero
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                      : atingiu
                        ? 'bg-emerald-500 text-white'
                        : 'bg-red-500 text-white'
                  }}
                  metaTitle={(idx) => {
                    const mes = mesesKeys[idx]
                    const q = Number(metaReal.meta?.[mes] ?? 0)
                    const percent =
                      metaReal.metaPercentAcumulado?.[mes] ??
                      metaReal.metaPercent?.[mes] ??
                      (metaReal.totalMeta > 0 ? Math.round((q / metaReal.totalMeta) * 10000) / 100 : 0)
                    return `${mesesNomes[idx]}: ${q} atividades no mês | acumulado ${fmtPct(Number(percent))}%`
                  }}
                  realTitle={(idx) => {
                    const mes = mesesKeys[idx]
                    const realQtd = Number(metaReal.real?.[mes] ?? metaReal.realAcumulado?.[mes] ?? 0)
                    const metaQtd = Number(metaReal.meta?.[mes] ?? 0)
                    const realAcum = Math.min(
                      100,
                      Number(
                        metaReal.realPercentAcumulado?.[mes] ??
                          metaReal.realPercent?.[mes] ??
                          (metaReal.totalMeta > 0 ? Math.round((realQtd / metaReal.totalMeta) * 10000) / 100 : 0),
                      ),
                    )
                    return `${mesesNomes[idx]}: ${realQtd} realizadas no mês (meta ${metaQtd}) | acumulado ${fmtPct(realAcum)}%`
                  }}
                  evolTitle={(idx) => {
                    const mes = mesesKeys[idx]
                    const evol = Number(metaReal.evolucaoMensal?.[mes] ?? 0)
                    const sinal = evol > 0 ? '+' : ''
                    return `${mesesNomes[idx]}: ${sinal}${fmtPct(evol)}% do real no mês`
                  }}
                  footerLeft={
                    <>
                      Total: <span className="font-semibold text-text">{Number(metaReal.totalReal ?? 0)}</span> de{' '}
                      <span className="font-semibold text-text">{Number(metaReal.totalMeta ?? 0)}</span> atividades concluídas
                    </>
                  }
                  footerRight={
                    <>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {fmtPct(
                          metaReal.percentTotal ??
                            (metaReal.totalMeta > 0 ? (Number(metaReal.totalReal ?? 0) / metaReal.totalMeta) * 100 : 0),
                        )}
                        %
                      </span>{' '}
                      de conclusão
                    </>
                  }
                />
              ) : (
                <p className="text-xs text-muted text-center py-4">Sem dados de indicador para os filtros atuais.</p>
              )}
            </>
          )}

          {abaAtiva === 'diagnostico' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-bg/40 p-4 space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-text">Diagnóstico mensual</h2>
                  <p className="text-xs text-muted mt-1">
                    Atividades com fim previsto no mês. Somente leitura — use a aba Indicador e o cronograma para editar.
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                  <div>
                    <label className="text-xs font-medium block mb-1.5 text-text">Regional</label>
                    <select
                      value={regional}
                      onChange={(e) => {
                        setRegional(e.target.value);
                        setUnidade('');
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-text"
                    >
                      <option value="">Selecione a regional…</option>
                      {regionais.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5 text-text">Ano</label>
                    <select
                      value={anoMetaReal}
                      onChange={(e) => {
                        setAnoMetaReal(e.target.value);
                        setAno(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-text"
                    >
                      {[2025, 2026].map((a) => (
                        <option key={a} value={String(a)}>{a}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {regional && (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted mb-2">Mês</p>
                    <div className="flex flex-wrap gap-1">
                      {mesesKeys.map((mes, idx) => (
                        <button
                          key={mes}
                          type="button"
                          onClick={() => setMesDiagnostico(mes)}
                          className={`min-w-[2.75rem] px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                            mesDiagnostico === mes
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'bg-card border border-border text-muted hover:text-text hover:border-emerald-300'
                          }`}
                        >
                          {mesesNomes[idx]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {!regional ? (
                <div className="rounded-xl border border-dashed border-border bg-bg/30 px-6 py-12 text-center">
                  <p className="text-sm text-muted">Selecione a regional acima para ver o diagnóstico do mês.</p>
                </div>
              ) : diagnosticoLoading ? (
                <div className="py-16 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs text-muted">Carregando diagnóstico…</p>
                </div>
              ) : diagnostico ? (
                <>
                  {diagnostico.computed && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-4 py-2.5">
                      Dados calculados a partir de 2025 (ainda não gravados no banco para toda a regional).
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-3 sm:gap-4">
                    <div className="rounded-xl border border-border bg-panel px-4 py-3 text-center shadow-sm">
                      <p className="text-[10px] uppercase tracking-wide text-muted font-semibold">Previstas no mês</p>
                      <p className="text-2xl font-bold text-text tabular-nums mt-1">{diagnostico.total}</p>
                      <p className="text-[11px] text-muted mt-0.5">{diagnostico.mesLabel} / {anoMetaReal}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/10 px-4 py-3 text-center shadow-sm">
                      <p className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300 font-semibold">Executadas</p>
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums mt-1">{diagnostico.executadas}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10 px-4 py-3 text-center shadow-sm">
                      <p className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300 font-semibold">Pendentes</p>
                      <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 tabular-nums mt-1">{diagnostico.pendentes}</p>
                    </div>
                  </div>

                  {diagnostico.total === 0 ? (
                    <div className="rounded-xl border border-border bg-panel px-6 py-10 text-center">
                      <p className="text-sm text-muted">
                        Nenhuma atividade com fim previsto em {diagnostico.mesLabel}/{anoMetaReal} para {regional}.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {diagnostico.porUnidade.map((bloco) => (
                        <div
                          key={bloco.unidade}
                          className="rounded-xl border border-border bg-panel shadow-sm overflow-hidden"
                        >
                          <div className="px-4 py-2.5 bg-bg/60 border-b border-border flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-text leading-snug">{bloco.unidade}</span>
                            <div className="flex items-center gap-2 text-[11px] shrink-0">
                              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                {bloco.executadas}
                              </span>
                              <span className="text-muted">·</span>
                              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300 font-medium">
                                <XCircle className="w-3.5 h-3.5" />
                                {bloco.pendentes}
                              </span>
                            </div>
                          </div>
                          <table className="w-full table-fixed text-xs">
                            <colgroup>
                              <col className="w-[3rem]" />
                              <col />
                              <col className="w-[6.5rem]" />
                              <col className="w-[6.5rem]" />
                              <col className="w-[7.5rem]" />
                            </colgroup>
                            <thead>
                              <tr className="border-b border-border bg-bg/30 text-muted">
                                <th className="px-3 py-2 text-center font-semibold uppercase text-[10px]">Nº</th>
                                <th className="px-3 py-2 text-left font-semibold uppercase text-[10px]">Atividade</th>
                                <th className="px-3 py-2 text-center font-semibold uppercase text-[10px]">Fim prev.</th>
                                <th className="px-3 py-2 text-center font-semibold uppercase text-[10px]">Conclusão</th>
                                <th className="px-3 py-2 text-center font-semibold uppercase text-[10px]">Status</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {bloco.itens.map((item) => (
                                <tr key={`${item.unidade}-${item.atividade_codigo}`} className="hover:bg-bg/20">
                                  <td className="px-3 py-2.5 text-center tabular-nums text-muted font-medium">
                                    {item.atividade_codigo}
                                  </td>
                                  <td className="px-3 py-2.5 text-left leading-snug pr-4">{item.atividade_nome}</td>
                                  <td className="px-3 py-2.5 text-center tabular-nums whitespace-nowrap">
                                    {formatDate(item.data_fim_prevista)}
                                  </td>
                                  <td className="px-3 py-2.5 text-center tabular-nums whitespace-nowrap">
                                    {formatDate(item.data_conclusao)}
                                  </td>
                                  <td className="px-3 py-2.5 text-center">
                                    {item.status === 'executada' ? (
                                      <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                                        <CheckCircle2 className="w-3 h-3 shrink-0" />
                                        OK
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300">
                                        <XCircle className="w-3 h-3 shrink-0" />
                                        Pend.
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted text-center py-10">Não foi possível carregar o diagnóstico.</p>
              )}
            </div>
          )}

          {abaAtiva === 'concluidas' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-border bg-bg/40 p-4 space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-text">CIPAs concluídas</h2>
                  <p className="text-xs text-muted mt-1">
                    Unidades com todas as atividades do cronograma finalizadas (data de conclusão preenchida).
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                  <div>
                    <label className="text-xs font-medium block mb-1.5 text-text">Regional</label>
                    <select
                      value={regional}
                      onChange={(e) => {
                        setRegional(e.target.value);
                        setUnidade('');
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-text"
                    >
                      <option value="">Todas as regionais</option>
                      {regionais.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5 text-text">Ano</label>
                    <select
                      value={anoMetaReal}
                      onChange={(e) => {
                        setAnoMetaReal(e.target.value);
                        setAno(e.target.value);
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm text-text"
                    >
                      {[2025, 2026].map((a) => (
                        <option key={a} value={String(a)}>{a}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {concluidasLoading ? (
                <div className="py-16 text-center">
                  <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
                  <p className="text-xs text-muted">Carregando CIPAs concluídas…</p>
                </div>
              ) : concluidas ? (
                <>
                  {concluidas.computed && (
                    <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-4 py-2.5">
                      Dados calculados a partir de 2025 (ainda não gravados no banco para toda a regional).
                    </p>
                  )}

                  <div className="grid grid-cols-3 gap-3 sm:gap-4">
                    <div className="rounded-xl border border-border bg-panel px-4 py-3 text-center shadow-sm">
                      <p className="text-[10px] uppercase tracking-wide text-muted font-semibold">Total de unidades</p>
                      <p className="text-2xl font-bold text-text tabular-nums mt-1">{concluidas.totalUnidades}</p>
                      <p className="text-[11px] text-muted mt-0.5">{regional || 'Todas'} / {anoMetaReal}</p>
                    </div>
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-500/10 px-4 py-3 text-center shadow-sm">
                      <p className="text-[10px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300 font-semibold">100% concluídas</p>
                      <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums mt-1">{concluidas.cipasConcluidas}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/10 px-4 py-3 text-center shadow-sm">
                      <p className="text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300 font-semibold">Em andamento</p>
                      <p className="text-2xl font-bold text-amber-700 dark:text-amber-300 tabular-nums mt-1">{concluidas.emAndamento}</p>
                    </div>
                  </div>

                  {concluidas.unidades.length === 0 ? (
                    <div className="rounded-xl border border-border bg-panel px-6 py-10 text-center">
                      <p className="text-sm text-muted">
                        Nenhuma unidade com CIPA 100% concluída{regional ? ` em ${regional}` : ''} em {anoMetaReal}.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-border bg-panel shadow-sm overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-bg/30 text-muted">
                            <th className="px-4 py-2.5 text-left font-semibold uppercase text-[10px]">Regional</th>
                            <th className="px-4 py-2.5 text-left font-semibold uppercase text-[10px]">Unidade</th>
                            <th className="px-4 py-2.5 text-center font-semibold uppercase text-[10px]">Atividades</th>
                            <th className="px-4 py-2.5 text-center font-semibold uppercase text-[10px]">Última conclusão</th>
                            <th className="px-4 py-2.5 text-center font-semibold uppercase text-[10px]">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {concluidas.unidades.map((item) => (
                            <tr key={`${item.regional}-${item.unidade}`} className="hover:bg-bg/20">
                              <td className="px-4 py-2.5 text-left font-medium">{item.regional}</td>
                              <td className="px-4 py-2.5 text-left leading-snug">
                                <span>{item.unidade}</span>
                                {isDesignadoUnit(item.unidade) && (
                                  <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/40">
                                    Designado
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-center tabular-nums">
                                {item.concluidas}/{item.totalAtividades}
                              </td>
                              <td className="px-4 py-2.5 text-center tabular-nums whitespace-nowrap">
                                {formatDate(item.dataUltimaConclusao)}
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className="inline-flex items-center justify-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                                  Concluída
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted text-center py-10">Não foi possível carregar as CIPAs concluídas.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {abaAtiva === 'indicador' && (
      <>
      {/* Filtros */}
      <div className="rounded-xl border border-border bg-panel p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold text-muted uppercase tracking-wide px-2">Filtros</span>
          <div className="h-px flex-1 bg-border" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="max-w-[200px]">
            <label className="text-xs font-medium block mb-1.5 text-text">Regional</label>
            <select
              value={regional}
              onChange={(e) => { setRegional(e.target.value); setUnidade(''); setPage(1); }}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text"
            >
              <option value="">Selecione…</option>
              {regionais.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5 text-text">Unidade</label>
            <select
              value={unidade}
              onChange={(e) => { setUnidade(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text disabled:opacity-50"
              disabled={!regional}
            >
              <option value="">(todas)</option>
              {unidadesFiltradas.map((u) => (
                <option key={u.unidade} value={u.unidade}>{u.unidade}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5 text-text">Ano</label>
            <select
              value={ano}
              onChange={(e) => { setAno(e.target.value); setPage(1); }}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text"
            >
              <option value="2025">2025</option>
              <option value="2026">2026</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5 text-text">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Unidade ou atividade"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text"
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <button
              onClick={() => { setRegional(''); setUnidade(''); setSearch(''); setPage(1); }}
              className="px-4 py-2.5 rounded-xl border border-border bg-panel hover:bg-bg text-sm font-medium flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Limpar
            </button>
          </div>
        </div>
        {computed2026 && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Cronograma 2026 calculado a partir da posse de 2025. Use <strong>Editar</strong> em cada linha e salve — a data fica gravada no banco.
          </p>
        )}
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-panel shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-muted">
            <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
            <div>Carregando cronograma...</div>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-muted mb-2">Nenhum registro encontrado</div>
            <div className="text-xs text-muted mt-1">
              {total === 0 && ano === '2026' ? 'Selecione regional/unidade ou edite uma linha para gravar o cronograma 2026 no banco.' : 'Ajuste os filtros.'}
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-bg/50 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase">Regional</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase">Unidade</th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase w-12">Nº</th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase">Atividade</th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase">Início previsto</th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase">Fim previsto</th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase">Conclusão</th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase">Data posse</th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase">Status</th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-[11px]">
                  {rows.map((row) => {
                    const concluida = Boolean(row.data_conclusao);
                    return (
                      <tr key={`${row.regional}-${row.unidade}-${row.atividade_codigo}`} className="hover:bg-bg/30">
                        <td className="px-4 py-3 text-left font-medium text-[11px]">{row.regional}</td>
                        <td className="px-4 py-3 text-left text-[11px]">
                          <span>{row.unidade}</span>
                          {isDesignadoUnit(row.unidade) && (
                            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-violet-50 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/40">
                              Designado
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-[11px]">{row.atividade_codigo}</td>
                        <td className="px-4 py-3 text-left text-[11px]">{row.atividade_nome}</td>
                        <td className="px-4 py-3 text-center text-[11px]">{formatDate(row.data_inicio_prevista)}</td>
                        <td className="px-4 py-3 text-center text-[11px]">{formatDate(row.data_fim_prevista)}</td>
                        <td className="px-4 py-3 text-center text-[11px]">{formatDate(row.data_conclusao)}</td>
                        <td className="px-4 py-3 text-center text-[11px]">{formatDate(row.data_posse_gestao)}</td>
                        <td className="px-4 py-3 text-center">
                          {concluida ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/50">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Concluída
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-medium bg-amber-50 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-500/50">
                              <XCircle className="w-3 h-3 mr-1" />
                              Pendente
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => abrirModalEdicao(row)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-500/50 hover:bg-blue-100 dark:hover:bg-blue-500/30 transition-colors"
                            title="Editar datas previstas e conclusão"
                          >
                            <Edit className="w-3 h-3" />
                            Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border text-xs text-muted">
                <span>
                  Página {page} de {totalPages} ({total} registro{total !== 1 ? 's' : ''})
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded-lg border border-border bg-panel hover:bg-bg disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded-lg border border-border bg-panel hover:bg-bg disabled:opacity-50"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      </>
      )}

      {/* Modal de edição de datas */}
      {modalEdicao.open && modalEdicao.row && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={fecharModalEdicao}>
          <div className="bg-white dark:bg-neutral-950 rounded-2xl w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
              <div className="text-lg font-semibold">Editar atividade</div>
              <div className="text-xs opacity-70 mt-1">{modalEdicao.row.atividade_nome}</div>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-medium mb-1.5 text-text">Unidade</div>
                  <div className="text-sm text-muted">{modalEdicao.row.unidade}</div>
                </div>
                <div>
                  <div className="text-xs font-medium mb-1.5 text-text">Regional</div>
                  <div className="text-sm text-muted">{modalEdicao.row.regional}</div>
                </div>
              </div>
              {computed2026 && (
                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg px-3 py-2">
                  Ao salvar, esta atividade será gravada no banco. As demais linhas da regional permanecem calculadas até serem editadas.
                </p>
              )}
              <div>
                <label className="text-xs font-medium block mb-1.5 text-text">Início previsto</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="date"
                    value={dataInicioEdit}
                    onChange={(e) => setDataInicioEdit(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5 text-text">Fim previsto</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="date"
                    value={dataFimEdit}
                    onChange={(e) => setDataFimEdit(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5 text-text">Data de conclusão</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="date"
                    value={dataConclusaoEdit}
                    onChange={(e) => setDataConclusaoEdit(e.target.value)}
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text"
                  />
                </div>
                <p className="text-[11px] text-muted mt-1">Deixe em branco para manter a atividade como pendente.</p>
              </div>
              {(modalEdicao.row.data_conclusao || dataConclusaoEdit) && (
                <div className="pt-2 border-t border-border">
                  <button
                    onClick={removerConclusao}
                    disabled={saving}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                  >
                    Remover data de conclusão
                  </button>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2">
              <button
                onClick={fecharModalEdicao}
                disabled={saving}
                className="px-4 py-2 rounded-lg border border-border bg-panel hover:bg-bg text-sm font-medium disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={salvarAtividade}
                disabled={saving || (!dataInicioEdit && !dataFimEdit && !dataConclusaoEdit)}
                className="px-4 py-2 rounded-lg border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Salvar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

