'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Flame, AlertTriangle, Clock, FileX, Search, ChevronLeft, ChevronRight, Settings, Save, X, Download, Filter, RefreshCw } from 'lucide-react';
import { formatarNomeUnidade } from '@/lib/spci/unidadeMapper';
import MetaVsRealCard from '@/components/shared/MetaVsRealCard';

type ExtintorRow = {
  id: number;
  'Ano do Planejamento': number;
  TAG: string;
  Unidade: string;
  Local: string;
  Regional: string;
  Classe: string;
  'Massa/Volume (kg/L)': string;
  'TAG de Controle Mensal': string;
  'Data Tagueamento': string | null;
  'Lote Contrato': string;
  'Possui Contrato': string;
  'Nº série (Selo INMETRO)': string | null;
  'Última recarga': string | null;
  'Planej. Recarga': string | null;
  'Data Execução Recarga': string | null;
  // Campos calculados (nunca vêm do banco)
  status: 'OK' | 'A VENCER' | 'VENCIDO';
  dataLimiteRecarga: string | null;
  diasRestantes: number | null;
  mesPlanejRecarga: string | null;
  mesExecRecarga: string | null;
};

type StatsData = {
  total: number;
  totalVencidos: number;
  totalAVencer: number;
  totalSemContrato: number;
  porRegional: Record<string, number>;
};

type MetaRealData = {
  meta: Record<string, number>; // Meta acumulada
  metaMensal?: Record<string, number>; // Meta por mês (sem acumular)
  real: Record<string, number>; // Real por mês (sem acumular)
  realAcumulado: Record<string, number>; // Real acumulado
  totalExtintores: number;
  totalMeta: number;
  totalReal: number;
  ano: number;
};

const fetchJSON = async <T = any>(url: string, init?: RequestInit): Promise<T> => {
  try {
    const r = await fetch(url, { cache: 'no-store', ...init });
    const data = await r.json();
    if (!r.ok) {
      const errorMsg = (data && (data.error || data.message)) || `Erro HTTP ${r.status}`;
      console.error('[fetchJSON] Erro na resposta:', { url, status: r.status, data });
      throw new Error(errorMsg);
    }
    // Se a resposta tem campo 'ok' e é false, lança erro
    if (data && typeof data === 'object' && 'ok' in data && data.ok === false) {
      const errorMsg = data.error || 'Erro desconhecido';
      console.error('[fetchJSON] Erro no payload:', { url, error: errorMsg });
      throw new Error(errorMsg);
    }
    return data as T;
  } catch (error: any) {
    console.error('[fetchJSON] Erro na requisição:', { url, error: error.message });
    throw error;
  }
};

// Converte data dd/mm/yyyy para input date (yyyy-mm-dd)
function toInputDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const parts = dateStr.split('/');
  if (parts.length !== 3) return '';
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

// Converte input date (yyyy-mm-dd) para dd/mm/yyyy
function fromInputDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '';
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'VENCIDO':
      return 'bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/50';
    case 'A VENCER':
      return 'bg-yellow-50 dark:bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-500/50';
    case 'OK':
      return 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/50';
    default:
      return 'bg-gray-50 dark:bg-gray-500/20 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-500/50';
  }
}

/**
 * Padroniza o campo Local: primeira letra de cada palavra em maiúscula
 */
function formatarLocal(local: string | null | undefined): string {
  if (!local) return '';
  
  return local
    .toLowerCase()
    .split(' ')
    .map(palavra => {
      if (palavra.length === 0) return palavra;
      return palavra.charAt(0).toUpperCase() + palavra.slice(1);
    })
    .join(' ')
    .trim();
}

export default function SPCIExtintoresPage() {
  // Filtros
  const [regional, setRegional] = useState<string>('');
  const [unidade, setUnidade] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [possuiContrato, setPossuiContrato] = useState<string>('');
  const [classe, setClasse] = useState<string>('');
  const [anoPlanejamento, setAnoPlanejamento] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  // Dados
  const [rows, setRows] = useState<ExtintorRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<string>('Unidade');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Estatísticas
  const [stats, setStats] = useState<StatsData | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Meta vs Real
  const [metaReal, setMetaReal] = useState<MetaRealData | null>(null);
  const [metaRealLoading, setMetaRealLoading] = useState(false);
  const [anoMetaReal, setAnoMetaReal] = useState<string>(String(new Date().getFullYear()));

  // Opções para filtros
  const [regionais, setRegionais] = useState<string[]>([]);
  const [unidades, setUnidades] = useState<string[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [anos, setAnos] = useState<number[]>([]);

  const isFutureMonthCell = (anoExercicio: number, month1to12: number): boolean => {
    const now = new Date();
    const cy = now.getFullYear();
    const cm = now.getMonth() + 1;
    if (anoExercicio > cy) return true;
    if (anoExercicio < cy) return false;
    return month1to12 > cm;
  };

  const fmtPct = (n: number): string => Number(n).toFixed(2);

  // Modal de edição
  const [modalEdicao, setModalEdicao] = useState<{
    open: boolean;
    unidade: string | null;
    extintores: ExtintorRow[];
  }>({ open: false, unidade: null, extintores: [] });
  const [editandoExtintores, setEditandoExtintores] = useState<Record<number, {
    tag: string;
    local: string;
    classe: string;
    massaVolume: string;
    planejRecarga: string;
    dataExecucaoRecarga: string;
    possuiContrato: boolean;
  }>>({});
  const [saving, setSaving] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());

  // Carrega opções únicas
  useEffect(() => {
    fetchJSON<{ regionais: string[]; unidades: string[]; classes: string[]; anos: number[] }>('/api/spci/options')
      .then((data) => {
        setRegionais(data.regionais || []);
        setUnidades(data.unidades || []);
        setClasses(data.classes || []);
        setAnos(data.anos || []);
      })
      .catch(() => {});
  }, []);

  // Carrega estatísticas
  useEffect(() => {
    setStatsLoading(true);
    const params = new URLSearchParams();
    if (regional) params.set('regional', regional);
    if (unidade) params.set('unidade', unidade);

    fetchJSON<{ stats: StatsData }>(`/api/spci/stats?${params.toString()}`)
      .then((data) => setStats(data.stats))
      .catch(() => setStats(null))
      .finally(() => setStatsLoading(false));
  }, [regional, unidade]);

  // Carrega Meta vs Real (consolidado ou por regional)
  useEffect(() => {
    setMetaRealLoading(true);
    const params = new URLSearchParams();
    if (regional) {
      params.set('regional', regional);
    }
    params.set('ano', anoMetaReal);

    fetchJSON<MetaRealData>(`/api/spci/meta-real?${params.toString()}`)
      .then((data) => setMetaReal(data))
      .catch(() => setMetaReal(null))
      .finally(() => setMetaRealLoading(false));
  }, [regional, anoMetaReal]);

  // Carrega lista de extintores
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (regional) params.set('regional', regional);
    if (unidade) params.set('unidade', unidade);
    if (status) params.set('status', status);
    if (possuiContrato) params.set('possuiContrato', possuiContrato);
    if (classe) params.set('classe', classe);
    if (anoPlanejamento) params.set('anoPlanejamento', anoPlanejamento);
    if (search) params.set('search', search);
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);

    const url = `/api/spci/list?${params.toString()}`;
    console.log('[SPCI Page] Buscando dados:', url);
    
    fetchJSON<{ ok?: boolean; rows: ExtintorRow[]; totalCount: number; error?: string }>(url)
      .then((data) => {
        console.log('[SPCI Page] Resposta completa:', {
          ok: data.ok,
          rowsCount: data.rows?.length || 0,
          totalCount: data.totalCount || 0,
          firstRow: data.rows?.[0] || null,
          dataKeys: Object.keys(data || {})
        });
        
        // Se tem campo ok e é false, trata como erro
        if (data && 'ok' in data && data.ok === false) {
          console.error('[SPCI Page] API retornou erro:', data.error);
          setRows([]);
          setTotal(0);
          return;
        }
        
        // Extrai rows e totalCount (pode estar em data.rows ou data diretamente)
        const rowsData = (data as any).rows || (Array.isArray(data) ? data : []);
        const totalData = (data as any).totalCount || (data as any).total || rowsData.length;
        
        console.log('[SPCI Page] Dados processados:', { 
          rows: rowsData.length, 
          total: totalData,
          hasRows: rowsData.length > 0,
          firstRowSample: rowsData[0] ? Object.keys(rowsData[0]) : null
        });
        
        setRows(rowsData);
        setTotal(totalData);
      })
      .catch((error) => {
        console.error('[SPCI Page] Erro ao carregar extintores:', error);
        setRows([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [regional, unidade, status, possuiContrato, classe, anoPlanejamento, search, page, pageSize, sortBy, sortDir]);

  // Unidades filtradas por regional
  const unidadesFiltradas = useMemo(() => {
    if (!regional) return unidades;
    return rows
      .filter((r) => r.Regional === regional)
      .map((r) => r.Unidade)
      .filter((u, i, arr) => arr.indexOf(u) === i)
      .sort();
  }, [regional, rows, unidades]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
    setPage(1);
  };

  const abrirModalEdicao = async (row: ExtintorRow) => {
    // Busca todos os extintores da mesma unidade
    const params = new URLSearchParams();
    params.set('unidade', row.Unidade);
    params.set('pageSize', '1000'); // Busca todos
    
    try {
      const data = await fetchJSON<{ rows: ExtintorRow[]; totalCount: number }>(`/api/spci/list?${params.toString()}`);
      const extintoresUnidade = data.rows || [];
      
      // Inicializa dados de edição para cada extintor
      const editData: Record<number, any> = {};
      extintoresUnidade.forEach((ext) => {
        editData[ext.id] = {
          tag: ext.TAG || '',
          local: ext.Local || '',
          classe: ext.Classe || '',
          massaVolume: ext['Massa/Volume (kg/L)'] || '',
          planejRecarga: toInputDate(ext['Planej. Recarga']),
          dataExecucaoRecarga: toInputDate(ext['Data Execução Recarga']),
          possuiContrato: ext['Possui Contrato']?.toUpperCase() === 'SIM',
        };
      });
      
      setEditandoExtintores(editData);
      setModalEdicao({
        open: true,
        unidade: row.Unidade,
        extintores: extintoresUnidade,
      });
    } catch (error: any) {
      alert('Erro ao carregar extintores da unidade: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const fecharModalEdicao = () => {
    setModalEdicao({ open: false, unidade: null, extintores: [] });
    setEditandoExtintores({});
    setSavingIds(new Set());
  };

  const atualizarExtintor = (id: number, campo: string, valor: any) => {
    setEditandoExtintores((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [campo]: valor,
      },
    }));
  };

  const salvarExtintor = async (extintor: ExtintorRow) => {
    const editData = editandoExtintores[extintor.id];
    if (!editData) return;

    const newSavingIds = new Set(savingIds);
    newSavingIds.add(extintor.id);
    setSavingIds(newSavingIds);

    try {
      await fetchJSON('/api/spci/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: extintor.id,
          tag: editData.tag,
          local: editData.local,
          classe: editData.classe,
          massaVolume: editData.massaVolume,
          planejRecarga: editData.planejRecarga ? fromInputDate(editData.planejRecarga) : null,
          dataExecucaoRecarga: editData.dataExecucaoRecarga ? fromInputDate(editData.dataExecucaoRecarga) : null,
          possuiContrato: editData.possuiContrato,
        }),
      });

      // Atualiza o extintor na lista do modal
      setModalEdicao((prev) => ({
        ...prev,
        extintores: prev.extintores.map((e) =>
          e.id === extintor.id
            ? {
                ...e,
                TAG: editData.tag,
                Local: editData.local,
                Classe: editData.classe,
                'Massa/Volume (kg/L)': editData.massaVolume,
                'Planej. Recarga': editData.planejRecarga ? fromInputDate(editData.planejRecarga) : null,
                'Data Execução Recarga': editData.dataExecucaoRecarga ? fromInputDate(editData.dataExecucaoRecarga) : null,
                'Possui Contrato': editData.possuiContrato ? 'SIM' : 'NÃO',
              }
            : e
        ),
      }));

      // Recarrega dados da tabela principal
      const params = new URLSearchParams();
      if (regional) params.set('regional', regional);
      if (unidade) params.set('unidade', unidade);
      if (status) params.set('status', status);
      if (possuiContrato) params.set('possuiContrato', possuiContrato);
      if (classe) params.set('classe', classe);
      if (anoPlanejamento) params.set('anoPlanejamento', anoPlanejamento);
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      params.set('sortBy', sortBy);
      params.set('sortDir', sortDir);

      const data = await fetchJSON<{ rows: ExtintorRow[]; totalCount: number }>(`/api/spci/list?${params.toString()}`);
      setRows(data.rows || []);
      setTotal(data.totalCount || 0);

      // Recarrega estatísticas
      const statsParams = new URLSearchParams();
      if (regional) statsParams.set('regional', regional);
      if (unidade) statsParams.set('unidade', unidade);
      const statsData = await fetchJSON<{ stats: StatsData }>(`/api/spci/stats?${statsParams.toString()}`);
      setStats(statsData.stats);
    } catch (error: any) {
      alert('Erro ao salvar: ' + (error.message || 'Erro desconhecido'));
    } finally {
      const newSavingIds2 = new Set(savingIds);
      newSavingIds2.delete(extintor.id);
      setSavingIds(newSavingIds2);
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
            SST • SPCI
          </p>
          <h1 className="mt-1 text-lg font-semibold">SPCI / Extintores</h1>
          <p className="mt-1 text-xs text-muted">
            Controle de equipamentos de combate a incêndio, inspeções e vencimentos.
          </p>
        </div>
      </div>

      {/* Cards de Estatísticas */}
      {statsLoading ? (
        <div className="text-center py-4 text-muted">Carregando estatísticas...</div>
      ) : stats ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-border bg-panel p-4">
            <p className="text-[11px] text-muted flex items-center gap-1">
              <Flame className="w-3 h-3" />
              Total de Extintores
            </p>
            <p className="mt-1 text-2xl font-semibold">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-border bg-panel p-4">
            <p className="text-[11px] text-muted flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              Vencidos
            </p>
            <p className="mt-1 text-2xl font-semibold text-red-300">{stats.totalVencidos}</p>
          </div>
          <div className="rounded-xl border border-border bg-panel p-4">
            <p className="text-[11px] text-muted flex items-center gap-1">
              <Clock className="w-3 h-3 text-yellow-400" />
              A Vencer (30 dias)
            </p>
            <p className="mt-1 text-2xl font-semibold text-yellow-300">{stats.totalAVencer}</p>
          </div>
          <div className="rounded-xl border border-border bg-panel p-4">
            <p className="text-[11px] text-muted flex items-center gap-1">
              <FileX className="w-3 h-3 text-orange-400" />
              Sem Contrato
            </p>
            <p className="mt-1 text-2xl font-semibold text-orange-300">{stats.totalSemContrato}</p>
          </div>
          <div className="rounded-xl border border-border bg-panel p-4">
            <p className="text-[11px] text-muted mb-1">Por Regional</p>
            <div className="mt-1 grid grid-cols-2 gap-1.5 text-[11px]">
              {Object.entries(stats.porRegional).map(([reg, count]) => (
                <div
                  key={reg}
                  className="flex items-center justify-between px-2 py-1 rounded-lg bg-bg/60 border border-border/60"
                >
                  <span className="text-muted font-medium">{reg}:</span>
                  <span className="font-semibold text-text">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {/* Meta vs Real */}
      {metaReal && stats ? (
        (() => {
          const mesesKeys = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']
          const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
          const anoNum = Number(anoMetaReal) || new Date().getFullYear()
          const totalMeta = Number(metaReal.totalMeta || 0)
          return (
            <MetaVsRealCard
              title={`Meta vs Real ${regional ? `- ${regional}` : '(Consolidado)'}`}
              yearControl={
                <div className="flex items-center gap-2">
                  <select
                    value={anoMetaReal}
                    onChange={(e) => setAnoMetaReal(e.target.value)}
                    className="px-3 py-1.5 rounded-lg border border-border bg-bg text-xs"
                  >
                    {anos.map((a) => (
                      <option key={a} value={a}>
                        {a}
                      </option>
                    ))}
                  </select>
                  {metaRealLoading ? <span className="text-[11px] text-muted">Carregando...</span> : null}
                </div>
              }
              monthsShort={mesesNomes}
              metaPct={mesesKeys.map((mes) => {
                const q = Number(metaReal.meta?.[mes] ?? 0)
                return totalMeta > 0 ? Math.min(100, Math.round((q / totalMeta) * 10000) / 100) : 0
              })}
              realPct={mesesKeys.map((mes, idx) => {
                const future = isFutureMonthCell(anoNum, idx + 1)
                if (future) return null
                const q = Number(metaReal.realAcumulado?.[mes] ?? 0)
                return totalMeta > 0 ? Math.min(100, Math.round((q / totalMeta) * 10000) / 100) : 0
              })}
              evolPct={mesesKeys.map((mes, idx) => {
                const future = isFutureMonthCell(anoNum, idx + 1)
                if (future) return null
                const cur = Number(metaReal.realAcumulado?.[mes] ?? 0)
                const prevMes = idx > 0 ? mesesKeys[idx - 1] : null
                const prev = prevMes ? Number(metaReal.realAcumulado?.[prevMes] ?? 0) : 0
                const curPct = totalMeta > 0 ? Math.min(100, Math.round((cur / totalMeta) * 10000) / 100) : 0
                const prevPct = totalMeta > 0 ? Math.min(100, Math.round((prev / totalMeta) * 10000) / 100) : 0
                return curPct - prevPct
              })}
              realClassName={(idx) => {
                const future = isFutureMonthCell(anoNum, idx + 1)
                if (future) return 'bg-muted/30 text-muted border border-border/50'
                const mes = mesesKeys[idx]
                const realQtd = Number(metaReal.realAcumulado?.[mes] ?? 0)
                const metaQtd = Number(metaReal.meta?.[mes] ?? 0)
                const ambosZero = totalMeta < 1 && realQtd < 1
                const atingiu = totalMeta > 0 && realQtd >= metaQtd
                return ambosZero
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  : atingiu
                    ? 'bg-emerald-500 text-white'
                    : 'bg-red-500 text-white'
              }}
              metaTitle={(idx) => {
                const mes = mesesKeys[idx]
                const q = Number(metaReal.meta?.[mes] ?? 0)
                const pct = totalMeta > 0 ? Math.min(100, Math.round((q / totalMeta) * 10000) / 100) : 0
                return `${mesesNomes[idx]}: meta acumulada ${q} extintor(es) (${fmtPct(pct)}% da meta anual)`
              }}
              realTitle={(idx) => {
                const future = isFutureMonthCell(anoNum, idx + 1)
                if (future) return `${mesesNomes[idx]}: mês ainda não iniciado`
                const mes = mesesKeys[idx]
                const realQtd = Number(metaReal.realAcumulado?.[mes] ?? 0)
                const metaQtd = Number(metaReal.meta?.[mes] ?? 0)
                const pct = totalMeta > 0 ? Math.min(100, Math.round((realQtd / totalMeta) * 10000) / 100) : 0
                return `${mesesNomes[idx]}: ${realQtd} recarregado(s) acum. de ${metaQtd} planejado(s) acum. · cobertura ${fmtPct(pct)}%`
              }}
              evolTitle={(idx) => {
                const future = isFutureMonthCell(anoNum, idx + 1)
                if (future) return `${mesesNomes[idx]}: mês ainda não iniciado`
                const mes = mesesKeys[idx]
                const cur = Number(metaReal.realAcumulado?.[mes] ?? 0)
                const prevMes = idx > 0 ? mesesKeys[idx - 1] : null
                const prev = prevMes ? Number(metaReal.realAcumulado?.[prevMes] ?? 0) : 0
                const curPct = totalMeta > 0 ? Math.min(100, Math.round((cur / totalMeta) * 10000) / 100) : 0
                const prevPct = totalMeta > 0 ? Math.min(100, Math.round((prev / totalMeta) * 10000) / 100) : 0
                const evol = curPct - prevPct
                const sinal = evol > 0 ? '+' : ''
                return `${mesesNomes[idx]}: ${sinal}${fmtPct(evol)}% do real no mês`
              }}
              footerLeft={
                <>
                  Total: <span className="font-semibold text-text">{Number(metaReal.totalReal ?? 0).toLocaleString('pt-BR')}</span> de{' '}
                  <span className="font-semibold text-text">{Number(metaReal.totalMeta ?? 0).toLocaleString('pt-BR')}</span> recargas executadas
                </>
              }
              footerRight={
                <>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {fmtPct(totalMeta > 0 ? (Number(metaReal.totalReal ?? 0) / totalMeta) * 100 : 0)}%
                  </span>{' '}
                  de conclusão
                </>
              }
            />
          )
        })()
      ) : (
        <div className="rounded-xl border border-border bg-panel p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold">Meta vs Real {regional ? `- ${regional}` : '(Consolidado)'}</h2>
            <div className="flex items-center gap-2">
              <select
                value={anoMetaReal}
                onChange={(e) => setAnoMetaReal(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-border bg-bg text-xs"
              >
                {anos.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
              {metaRealLoading ? <span className="text-[11px] text-muted">Carregando...</span> : null}
            </div>
          </div>
          <div className="text-[11px] text-muted">Carregando meta vs real…</div>
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-xl border border-border bg-panel p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {/* Busca por TAG ou Nº série */}
          <div className="lg:col-span-2">
            <label className="block text-xs text-muted mb-1">Buscar (TAG ou Nº série)</label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Digite TAG ou Nº série..."
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          {/* Regional */}
          <div>
            <label className="block text-xs text-muted mb-1">Regional</label>
            <select
              value={regional}
              onChange={(e) => {
                setRegional(e.target.value);
                setUnidade('');
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Todas</option>
              {regionais.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Unidade */}
          <div>
            <label className="block text-xs text-muted mb-1">Unidade</label>
            <select
              value={unidade}
              onChange={(e) => {
                setUnidade(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Todas</option>
              {unidadesFiltradas.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs text-muted mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Todos</option>
              <option value="OK">OK</option>
              <option value="A VENCER">A Vencer</option>
              <option value="VENCIDO">Vencido</option>
            </select>
          </div>

          {/* Possui Contrato */}
          <div>
            <label className="block text-xs text-muted mb-1">Possui Contrato</label>
            <select
              value={possuiContrato}
              onChange={(e) => {
                setPossuiContrato(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Todos</option>
              <option value="SIM">Sim</option>
              <option value="NÃO">Não</option>
            </select>
          </div>

          {/* Classe */}
          <div>
            <label className="block text-xs text-muted mb-1">Classe</label>
            <select
              value={classe}
              onChange={(e) => {
                setClasse(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Todas</option>
              {classes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Ano do Planejamento */}
          <div>
            <label className="block text-xs text-muted mb-1">Ano do Planejamento</label>
            <select
              value={anoPlanejamento}
              onChange={(e) => {
                setAnoPlanejamento(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="">Todos</option>
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Resumo de Resultados e Ações */}
      {!loading && rows.length > 0 && (
        <div className="rounded-xl border border-border bg-panel p-3 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <div className="text-muted">
              Mostrando <span className="font-semibold text-text">{rows.length}</span> de{' '}
              <span className="font-semibold text-text">{total.toLocaleString()}</span> extintores
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // Recarrega dados
                  const params = new URLSearchParams();
                  if (regional) params.set('regional', regional);
                  if (unidade) params.set('unidade', unidade);
                  if (status) params.set('status', status);
                  if (possuiContrato) params.set('possuiContrato', possuiContrato);
                  if (classe) params.set('classe', classe);
                  if (anoPlanejamento) params.set('anoPlanejamento', anoPlanejamento);
                  if (search) params.set('search', search);
                  params.set('page', String(page));
                  params.set('pageSize', String(pageSize));
                  params.set('sortBy', sortBy);
                  params.set('sortDir', sortDir);
                  
                  setLoading(true);
                  fetchJSON<{ rows: ExtintorRow[]; totalCount: number }>(`/api/spci/list?${params.toString()}`)
                    .then((data) => {
                      setRows(data.rows || []);
                      setTotal(data.totalCount || 0);
                    })
                    .catch(() => {
                      setRows([]);
                      setTotal(0);
                    })
                    .finally(() => setLoading(false));
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-border bg-panel hover:bg-bg text-xs text-text transition-colors"
                title="Atualizar dados"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Atualizar
              </button>
              <button
                onClick={async () => {
                  if (!rows.length) return;
                  const { utils, writeFile } = await import('xlsx');

                  const headers = [
                    'ID',
                    'TAG',
                    'Unidade',
                    'Regional',
                    'Local',
                    'Classe',
                    'Massa/Volume (kg/L)',
                    'TAG Controle Mensal',
                    'Data Tagueamento',
                    'Lote Contrato',
                    'Possui Contrato',
                    'Nº série (Selo INMETRO)',
                    'Última recarga',
                    'Data Limite',
                    'Status',
                    'Planej. Recarga',
                    'Data Execução Recarga',
                  ];

                  // Exporta todos os campos relevantes, nada fica oculto na planilha
                  const data = rows.map((row) => [
                    row.id,
                    row.TAG || '',
                    row.Unidade || '',
                    row.Regional || '',
                    row.Local || '',
                    row.Classe || '',
                    row['Massa/Volume (kg/L)'] || '',
                    row['TAG de Controle Mensal'] || '',
                    row['Data Tagueamento'] || '',
                    row['Lote Contrato'] || '',
                    row['Possui Contrato'] || '',
                    row['Nº série (Selo INMETRO)'] || '',
                    row['Última recarga'] || '',
                    row.dataLimiteRecarga || '',
                    row.status || '',
                    row['Planej. Recarga'] || '',
                    row['Data Execução Recarga'] || '',
                  ]);

                  const ws = utils.aoa_to_sheet([headers, ...data]);
                  const wb = utils.book_new();
                  utils.book_append_sheet(wb, ws, 'Extintores');
                  writeFile(wb, `extintores_${new Date().toISOString().split('T')[0]}.xlsx`);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-panel hover:bg-bg text-xs text-text transition-colors"
                title="Exportar para Excel"
                aria-label="Exportar para Excel"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              {(regional || unidade || status || possuiContrato || classe || anoPlanejamento || search) && (
                <button
                  onClick={() => {
                    setRegional('');
                    setUnidade('');
                    setStatus('');
                    setPossuiContrato('');
                    setClasse('');
                    setAnoPlanejamento('');
                    setSearch('');
                    setPage(1);
                  }}
                  className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-panel shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-8 text-muted">
              <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
              <div>Carregando extintores...</div>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-muted mb-2">Nenhum registro encontrado</div>
              {(regional || unidade || status || possuiContrato || classe || anoPlanejamento || search) && (
                <button
                  onClick={() => {
                    setRegional('');
                    setUnidade('');
                    setStatus('');
                    setPossuiContrato('');
                    setClasse('');
                    setAnoPlanejamento('');
                    setSearch('');
                    setPage(1);
                  }}
                  className="text-xs text-emerald-500 hover:text-emerald-400"
                >
                  Limpar filtros para ver todos os registros
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="bg-bg/50 border-b border-border">
                <tr>
                  <th
                    className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase cursor-pointer hover:bg-bg/70"
                    onClick={() => handleSort('Unidade')}
                  >
                    Unidade {sortBy === 'Unidade' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase cursor-pointer hover:bg-bg/70"
                    onClick={() => handleSort('Regional')}
                  >
                    Regional {sortBy === 'Regional' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase">Local</th>
                  <th
                    className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase cursor-pointer hover:bg-bg/70"
                    onClick={() => handleSort('Última recarga')}
                  >
                    Última Recarga {sortBy === 'Última recarga' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase">Data Limite</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase">Status</th>
                  <th
                    className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase cursor-pointer hover:bg-bg/70"
                    onClick={() => handleSort('Planej. Recarga')}
                  >
                    Planej. Recarga {sortBy === 'Planej. Recarga' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th
                    className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase cursor-pointer hover:bg-bg/70"
                    onClick={() => handleSort('Data Execução Recarga')}
                  >
                    Exec. Recarga {sortBy === 'Data Execução Recarga' && (sortDir === 'asc' ? '↑' : '↓')}
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => {
                  const isVencido = row.status === 'VENCIDO';
                  const isAVencer = row.status === 'A VENCER';

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-bg/30 ${
                        isVencido ? 'bg-red-500/5' : isAVencer ? 'bg-yellow-500/5' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-center text-[11px]">
                        <div>
                          <div className="font-medium">{formatarNomeUnidade(row.Unidade)}</div>
                          <div className="text-[10px] text-muted mt-0.5">{row.Unidade}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-[11px]">{row.Regional}</td>
                      <td className="px-4 py-3 text-center text-[11px]">{formatarLocal(row.Local)}</td>
                      <td className="px-4 py-3 text-center text-[11px]">{row['Última recarga'] || '-'}</td>
                      <td className="px-4 py-3 text-center text-[11px]">{row.dataLimiteRecarga || '-'}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded text-[11px] font-medium border ${getStatusColor(
                            row.status
                          )}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-[11px]">
                        <div>
                          <div>{row['Planej. Recarga'] || '-'}</div>
                          {row.mesPlanejRecarga && (
                            <div className="text-[10px] text-muted mt-0.5">{row.mesPlanejRecarga}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-[11px]">
                        <div>
                          <div>{row['Data Execução Recarga'] || '-'}</div>
                          {row.mesExecRecarga && (
                            <div className="text-[10px] text-muted mt-0.5">{row.mesExecRecarga}</div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => abrirModalEdicao(row)}
                          className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400 transition-colors"
                          title="Editar extintores da unidade"
                        >
                          <Settings className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginação */}
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

      {/* Modal de Edição de Extintores por Unidade */}
      {modalEdicao.open && modalEdicao.unidade && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={fecharModalEdicao}>
          <div 
            className="w-full max-w-5xl rounded-2xl border border-border bg-panel shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4 flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold">Editar Extintores</h2>
                <p className="text-sm text-muted mt-0.5">
                  Unidade: <span className="font-medium text-text">{formatarNomeUnidade(modalEdicao.unidade)}</span>
                </p>
                <p className="text-xs text-muted mt-1">
                  {modalEdicao.extintores.length} extintor{modalEdicao.extintores.length !== 1 ? 'es' : ''} encontrado{modalEdicao.extintores.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                onClick={fecharModalEdicao}
                className="p-2 rounded-lg hover:bg-bg transition-colors"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {modalEdicao.extintores.map((ext) => {
                  const editData = editandoExtintores[ext.id];
                  if (!editData) return null;

                  return (
                    <div
                      key={ext.id}
                      className="rounded-xl border border-border bg-card p-4 space-y-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-3 pb-3 border-b border-border">
                        <div>
                          <div className="text-sm font-semibold text-text">TAG: {ext.TAG || '-'}</div>
                          <div className="text-xs text-muted mt-0.5">
                            Local: {formatarLocal(ext.Local)} | Status: {ext.status}
                          </div>
                        </div>
                        <button
                          onClick={() => salvarExtintor(ext)}
                          disabled={savingIds.has(ext.id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                        >
                          {savingIds.has(ext.id) ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Salvando...
                            </>
                          ) : (
                            <>
                              <Save className="w-3.5 h-3.5" />
                              Salvar
                            </>
                          )}
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                          <label className="text-xs font-medium text-muted block mb-1.5">TAG</label>
                          <input
                            type="text"
                            value={editData.tag}
                            onChange={(e) => atualizarExtintor(ext.id, 'tag', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            placeholder="Ex: CAF-FEME-SESMT-003"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted block mb-1.5">Classe</label>
                          <select
                            value={editData.classe}
                            onChange={(e) => atualizarExtintor(ext.id, 'classe', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                          >
                            <option value="">Selecione</option>
                            {classes.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted block mb-1.5">Massa/Volume (kg/L)</label>
                          <input
                            type="text"
                            value={editData.massaVolume}
                            onChange={(e) => atualizarExtintor(ext.id, 'massaVolume', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            placeholder="Ex: 6"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted block mb-1.5">Local</label>
                          <input
                            type="text"
                            value={editData.local}
                            onChange={(e) => atualizarExtintor(ext.id, 'local', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                            placeholder="Ex: Sala da Distribuição"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted block mb-1.5">Planej. Recarga</label>
                          <input
                            type="date"
                            value={editData.planejRecarga}
                            onChange={(e) => atualizarExtintor(ext.id, 'planejRecarga', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted block mb-1.5">Data Execução Recarga</label>
                          <input
                            type="date"
                            value={editData.dataExecucaoRecarga}
                            onChange={(e) => atualizarExtintor(ext.id, 'dataExecucaoRecarga', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted block mb-1.5">Possui Contrato</label>
                          <select
                            value={editData.possuiContrato ? 'SIM' : 'NÃO'}
                            onChange={(e) => atualizarExtintor(ext.id, 'possuiContrato', e.target.value === 'SIM')}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-text text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                          >
                            <option value="SIM">Sim</option>
                            <option value="NÃO">Não</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-border bg-card px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="text-sm text-muted">
                Edite os campos e clique em "Salvar" em cada extintor para aplicar as alterações
              </div>
              <button
                onClick={fecharModalEdicao}
                className="px-4 py-2 rounded-lg border border-border bg-panel hover:bg-bg text-sm font-medium transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
