'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { isEpiObrigatorio } from '@/data/epiObrigatorio';
import { Settings, Package, Info, CheckCircle2, XCircle, AlertCircle, Clock, Download } from 'lucide-react';
import { findBestUnitMatch } from '@/lib/unitMatcher';
import MetaVsRealCard from '@/components/shared/MetaVsRealCard';

type Row = { id: string; nome: string; funcao: string; unidade: string; regional: string; entregue?: boolean; nome_site?: string | null; };
type KitItem = { item: string; quantidade: number; nome_site?: string | null; };
type Deliver = { item: string; qty_delivered: number; qty_required: number; deliveries: Array<{date:string, qty:number; entregue_por?: string; entregue_em?: string}>; };

const LS_KEY = 'entregas:v2025-11-07';


type StatusCode =
  | 'ATIVO'
  | 'FERIAS'
  | 'INSS'
  | 'LICENCA_MATERNIDADE'
  | 'DEMITIDO_2025_SEM_EPI'
  | 'DEMITIDO_2026_SEM_EPI'
  | 'EXCLUIDO_META';

type StatusInfo = {
  code: StatusCode;
  label: string;
  obs?: string | null;
};

const STATUS_LABELS: Record<StatusCode, string> = {
  ATIVO: 'Ativo',
  FERIAS: 'Férias',
  INSS: 'INSS',
  LICENCA_MATERNIDADE: 'Licença maternidade',
  DEMITIDO_2025_SEM_EPI: 'Demitido 2025 sem EPI',
  DEMITIDO_2026_SEM_EPI: 'Demitido 2026 sem EPI',
  EXCLUIDO_META: 'Excluído da meta',
};

const EXCLUDED_STATUS: StatusCode[] = ['DEMITIDO_2025_SEM_EPI', 'DEMITIDO_2026_SEM_EPI', 'EXCLUIDO_META'];

const ANO_ENTREGAS_TRACKER = 2026;

/** Mês ainda não iniciado no calendário (REAL e EVOL. só até o mês corrente). */
function isFutureMonthCellEntregas(anoExercicio: number, month1to12: number): boolean {
  const now = new Date();
  const cy = now.getFullYear();
  const cm = now.getMonth() + 1;
  if (anoExercicio > cy) return true;
  if (anoExercicio < cy) return false;
  return month1to12 > cm;
}

function fmtPctEntregas(n: number): string {
  return Number(n).toFixed(2);
}

/** Meta linear só em mai–dez (8 meses); jan–abr = 0. Índice 0 = jan … 11 = dez. */
function epiMetaMonthlySlicesMayDec(totalMeta: number): number[] {
  const slices = Array.from({ length: 12 }, () => 0);
  if (totalMeta <= 0) return slices;
  const n = 8;
  const q = Math.floor(totalMeta / n);
  const r = totalMeta % n;
  for (let k = 1; k <= n; k++) {
    const monthIdx = 3 + k;
    slices[monthIdx] = q + (k <= r ? 1 : 0);
  }
  return slices;
}

function epiMetaAcumuladaMayDec(totalMeta: number): number[] {
  const slices = epiMetaMonthlySlicesMayDec(totalMeta);
  const acum: number[] = [];
  let run = 0;
  for (let i = 0; i < 12; i++) {
    run += slices[i];
    acum.push(run);
  }
  return acum;
}

function statusDotClass(code: StatusCode): string {
  switch (code) {
    case 'FERIAS':
      return 'bg-sky-500';
    case 'INSS':
      return 'bg-amber-500';
    case 'LICENCA_MATERNIDADE':
      return 'bg-purple-500';
    case 'DEMITIDO_2025_SEM_EPI':
      return 'bg-red-500';
    case 'EXCLUIDO_META':
      return 'bg-neutral-400';
    default:
      return 'bg-emerald-500';
  }
}

function maskCPF(cpf?: string) {
  const d = String(cpf || '').replace(/\D/g, '').padStart(11, '0').slice(-11);
  return d ? `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}` : '';
}

function usePersistedState<T>(key: string, initial: T) {
  const [state, setState] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try {
      const raw = localStorage.getItem(key);
      return raw ? { ...initial, ...JSON.parse(raw) } : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(state)); } catch {}
  }, [state]);
  return [state, setState] as const;
}

async function fetchJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json };
}

// Componente de Resumo de EPIs por Tipo
function ResumoEpisPorTipo({ 
  regional, 
  unidadesData 
}: { 
  regional: string; 
  unidadesData: Array<{ unidade: string; qtePrevista: number; meses: Record<string, number>; totalRealizada: number }> | null 
}) {
  const [resumoData, setResumoData] = useState<Array<{ item: string; previsto: number; entregue: number; pendente: number }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!regional || !unidadesData || unidadesData.length === 0) {
      setResumoData([]);
      return;
    }

    async function loadResumo() {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set('regional', regional);
        params.set('ano', '2026');
        
        const { json } = await fetchJSON(`/api/entregas/resumo-epis-tipo?${params.toString()}`, { cache: 'no-store' });
        
        if (json?.ok && Array.isArray(json.resumo)) {
          setResumoData(json.resumo);
        } else {
          setResumoData([]);
        }
      } catch (e) {
        console.error('Erro ao carregar resumo de EPIs:', e);
        setResumoData([]);
      } finally {
        setLoading(false);
      }
    }

    loadResumo();
  }, [regional, unidadesData]);

  if (!regional || !unidadesData || unidadesData.length === 0 || resumoData.length === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-border bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 dark:to-emerald-900/20 p-4 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Package className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
        <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">Resumo de EPIs por Tipo</h3>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-4">
          <div className="w-5 h-5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {resumoData.map((epi) => (
            <div 
              key={epi.item}
              className="bg-white dark:bg-neutral-900 rounded-lg border border-emerald-200 dark:border-emerald-800 p-3 shadow-sm"
            >
              <div className="text-xs font-medium text-emerald-900 dark:text-emerald-100 mb-2 truncate" title={epi.item}>
                {epi.item}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Previsto:</span>
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">{epi.previsto.toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Entregue:</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{epi.entregue.toLocaleString('pt-BR')}</span>
                </div>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-emerald-100 dark:border-emerald-800">
                  <span className="text-muted-foreground">Pendente:</span>
                  <span className={`font-bold ${epi.pendente > 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {epi.pendente.toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Sistema de Toast para feedback
type Toast = { id: string; message: string; type: 'success' | 'error' | 'info'; };

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg min-w-[300px] max-w-md animate-in slide-in-from-right ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-200'
              : toast.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
              : 'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 flex-shrink-0" />}
          {toast.type === 'error' && <XCircle className="w-5 h-5 flex-shrink-0" />}
          {toast.type === 'info' && <Info className="w-5 h-5 flex-shrink-0" />}
          <span className="text-sm font-medium flex-1">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-current opacity-70 hover:opacity-100"
            aria-label="Fechar notificação"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function EntregasPage() {
  const [state, setState] = usePersistedState(LS_KEY, {
    regional: '',
    unidade: '',
    q: '',
    entregue: '' as '' | 'pendente' | 'entregue',
    page: 1,
    pageSize: 25,
  });

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [regionais, setRegionais] = useState<string[]>([]);
  const [unidadesAll, setUnidadesAll] = useState<Array<{ unidade: string; regional: string }>>([]);


  const [statusMap, setStatusMap] = useState<Record<string, StatusInfo>>({});
  const [showExcluded, setShowExcluded] = useState(false);
  const [statusModal, setStatusModal] = useState<{
    open: boolean;
    row?: Row | null;
    code?: StatusCode;
    obs?: string;
  }>({ open: false });

  const [tab, setTab] = useState<'lista' | 'diag'>('lista');
  const [exportBusy, setExportBusy] = useState(false);
  const [exportDe, setExportDe] = useState('2026-01-01');
  const [exportAte, setExportAte] = useState(() => new Date().toISOString().slice(0, 10));

  const [modal, setModal] = useState<{ open: boolean; row?: Row | null }>({ open: false });
  const [kit, setKit] = useState<KitItem[]>([]);
  const [kitSectors, setKitSectors] = useState<string[]>([]);
  const [kitSector, setKitSector] = useState<string>('');
  const [deliv, setDeliv] = useState<Deliver[]>([]);
  const [editLaunch, setEditLaunch] = useState<{
    open: boolean;
    cpf?: string;
    item?: string;
    qty_required?: number;
    deliveries?: Array<{ date: string; qty: number }>;
  }>({ open: false });
  const [selectedEpis, setSelectedEpis] = useState<Record<string, { qtd: number; data: string }>>({});
  
  // Sistema de Toast
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // Tracker de progresso
  const [metaData, setMetaData] = useState<{ meta: number; progresso: Record<string, number>; total: number } | null>(null);
  const [mesSelecionado, setMesSelecionado] = useState<string | null>(null);
  
  // Tabela por unidade (Diagnóstico)
  const [unidadesData, setUnidadesData] = useState<Array<{
    unidade: string;
    qtePrevista: number;
    meses: Record<string, number>;
    totalRealizada: number;
  }> | null>(null);
  
  // Toggle para mostrar EPIs não-obrigatórios
  const [mostrarNaoObrigatorios, setMostrarNaoObrigatorios] = useState(false);

  // Alertas de entregas vencidas (controle de qualidade: quando entregar de novo)
  type AlertaVencida = { cpf: string; nome: string; item: string; ultima_entrega_em: string; proxima_entrega_em: string; meses_validade: number; vencida: boolean; dias_vencido: number };
  const [alertasVencidas, setAlertasVencidas] = useState<AlertaVencida[]>([]);
  const [loadingAlertas, setLoadingAlertas] = useState(false);
  
  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = Date.now().toString() + Math.random().toString(36);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => removeToast(id), 5000);
  }
  
  function removeToast(id: string) {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  async function exportarRelatorioCompleto() {
    setExportBusy(true);
    try {
      const params = new URLSearchParams();
      if (state.regional) params.set('regional', state.regional);
      if (state.unidade) params.set('unidade', state.unidade);
      if (state.q?.trim()) params.set('q', state.q.trim());
      params.set('de', exportDe);
      params.set('ate', exportAte);
      params.set('incluir_pendentes', 'true');

      const res = await fetch(`/api/entregas/export?${params.toString()}`, { cache: 'no-store' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Falha ao gerar relatório');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Entregas_EPI_${exportAte}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast(
        'Relatório gerado. Se vier vazio, teste sem filtro de regional ou amplie o período (data inicial).',
        'success',
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erro ao exportar';
      showToast(msg, 'error');
    } finally {
      setExportBusy(false);
    }
  }

  function setFilter(patch: Partial<typeof state>) {
    setState(prev => ({
      ...prev,
      ...patch,
      page: patch.page !== undefined && patch.page !== null ? patch.page : 1,
    }));
  }
  function setFilterEntregue(value: '' | 'pendente' | 'entregue') {
    setFilter({ entregue: value, page: 1 });
  }


  // Carrega / persiste status dos colaboradores no localStorage e banco
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    // Carrega do localStorage primeiro (para compatibilidade)
    try {
      const raw = window.localStorage.getItem('entregas:status:v1');
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object') {
          setStatusMap(obj as Record<string, StatusInfo>);
        }
      }
    } catch {
      // ignore
    }
    
    // Depois tenta carregar do banco (quando houver rows)
    // Isso será feito quando os dados forem carregados
  }, []);
  
  // Carrega situações do banco quando os dados são carregados
  useEffect(() => {
    if (!rows || rows.length === 0) return;
    
    async function loadSituacoesFromDB() {
      try {
        const cpfs = rows.map(r => r.id).filter(Boolean);
        if (cpfs.length === 0) return;
        
        const cpfsStr = cpfs.join(',');
        const { json } = await fetchJSON(`/api/colaboradores/situacao-meta?cpfs=${encodeURIComponent(cpfsStr)}`, { cache: 'no-store' });
        
        if (json?.ok && json?.situacoes) {
          const situacoesFromDB: Record<string, StatusInfo> = {};
          for (const [cpf, data] of Object.entries(json.situacoes as Record<string, any>)) {
            const situacao = data.situacao as StatusCode;
            if (situacao && STATUS_LABELS[situacao]) {
              situacoesFromDB[cpf] = {
                code: situacao,
                label: STATUS_LABELS[situacao],
                obs: data.observacao || '',
              };
            }
          }
          
          // Mescla com o que já está no statusMap (banco tem prioridade)
          setStatusMap(prev => ({
            ...prev,
            ...situacoesFromDB,
          }));
        }
      } catch (e) {
        console.error('Erro ao carregar situações do banco:', e);
      }
    }
    
    loadSituacoesFromDB();
  }, [rows]);

  // Carrega alertas de entregas vencidas (quando entregar de novo — controle de qualidade)
  useEffect(() => {
    let cancelled = false;
    setLoadingAlertas(true);
    const params = new URLSearchParams();
    if (state.regional) params.set('regional', state.regional);
    if (state.unidade) params.set('unidade', state.unidade);
    fetch(`/api/entregas/alertas-vencidas?${params.toString()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j?.ok) return;
        setAlertasVencidas(Array.isArray(j.alertas) ? j.alertas : []);
      })
      .catch(() => {
        if (!cancelled) setAlertasVencidas([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingAlertas(false);
      });
    return () => { cancelled = true; };
  }, [state.regional, state.unidade]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem('entregas:status:v1', JSON.stringify(statusMap));
    } catch {
      // ignore
    }
  }, [statusMap]);

  // ---- CADASTRO MANUAL (DECLARADO ANTES DO JSX) ----
  const [newColab, setNewColab] = useState<{ cpf: string; nome: string; funcao: string; unidade: string; regional: string; matricula?: string; admissao?: string; demissao?: string }>({ cpf: '', nome: '', funcao: '', unidade: '', regional: '' });
  const [modalNew, setModalNew] = useState(false);
  const [cpfCheck, setCpfCheck] = useState<{ loading: boolean; exists: boolean | null; source?: string | null }>({ loading: false, exists: null, source: null });

  function openNewManual() {
    setNewColab({ cpf: '', nome: '', funcao: '', unidade: state.unidade || '', regional: state.regional || '' });
    setCpfCheck({ loading: false, exists: null, source: null });
    setModalNew(true);
  }

  async function checkManualCpf(cpfRaw: string) {
    const digits = String(cpfRaw || '').replace(/\D/g, '').slice(-11);
    if (!digits) {
      setCpfCheck({ loading: false, exists: null, source: null });
      return;
    }
    try {
      setCpfCheck(prev => ({ ...prev, loading: true }));
      const { json } = await fetchJSON('/api/entregas/check-cpf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: digits }),
      });
      if (json && typeof json === 'object' && 'ok' in json) {
        setCpfCheck({
          loading: false,
          exists: !!json.exists,
          source: (json.source as string | null) || null,
        });

        // Se já existe na base Alterdata, puxa o nome automaticamente (diferencial)
        // Só preenche se o campo ainda estiver vazio (pra não sobrescrever edição manual).
        if (json.exists && String(json.source || '') === 'alterdata') {
          const nome = String(json.nome || '').trim();
          if (nome && !String(newColab.nome || '').trim()) {
            setNewColab(prev => ({ ...prev, nome }));
          }
        }
      } else {
        setCpfCheck({ loading: false, exists: null, source: null });
      }
    } catch {
      setCpfCheck({ loading: false, exists: null, source: null });
    }
  }

  async function saveNewManual() {
    // Validações básicas
    const cpfLimpo = String(newColab.cpf || '').replace(/\D/g, '').slice(-11);
    if (cpfLimpo.length !== 11) {
      showToast('CPF inválido. Digite um CPF com 11 dígitos.', 'error');
      return;
    }
    if (!newColab.nome || !newColab.nome.trim()) {
      showToast('Nome é obrigatório.', 'error');
      return;
    }
    if (!newColab.funcao || !newColab.funcao.trim()) {
      showToast('Função é obrigatória.', 'error');
      return;
    }
    if (!newColab.regional) {
      showToast('Regional é obrigatória.', 'error');
      return;
    }
    if (!newColab.unidade) {
      showToast('Unidade é obrigatória.', 'error');
      return;
    }
    
    if (cpfCheck.exists === true) {
      showToast('Este CPF já está cadastrado. Verifique antes de continuar.', 'error');
      return;
    }
    
    const body: any = { ...newColab };
    body.cpf = cpfLimpo;
    const { json } = await fetchJSON('/api/entregas/manual', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
    if (json?.ok) {
      setModalNew(false);
      showToast('Colaborador cadastrado com sucesso!', 'success');
      // reload list
      const params = new URLSearchParams();
      params.set('regional', state.regional);
      if (state.unidade) params.set('unidade', state.unidade);
      if (state.q) params.set('q', state.q);
      if (state.entregue) params.set('entregue', state.entregue);
      params.set('page', String(state.page));
      params.set('pageSize', String(state.pageSize));
      const { json: j2 } = await fetchJSON('/api/entregas/list?' + params.toString(), { cache: 'no-store' });
      setRows((j2.rows || []) as Row[]);
      setTotal(Number(j2.total || 0));
    } else {
      showToast(json?.error || 'Erro ao cadastrar colaborador', 'error');
    }
  }
  // ---------------------------------------------------

  const unidades = useMemo(() => unidadesAll.filter(u => !state.regional || u.regional === state.regional), [unidadesAll, state.regional]);

  useEffect(() => {
    let on = true;
    (async () => {
      // Cache inteligente: usa cache mas com revalidação
      const { json } = await fetchJSON('/api/entregas/options', { cache: 'force-cache' });
      if (!on) return;
      setRegionais(json.regionais || []);
      setUnidadesAll(json.unidades || []);
    })();
    return () => { on = false };
  }, []);

  // Carrega meta e progresso quando regional estiver selecionada
  useEffect(() => {
    let on = true;
    setMetaData(null); // Reseta enquanto carrega
    (async () => {
      try {
        const params = new URLSearchParams();
        if (state.regional) params.set('regional', state.regional);
        params.set('ano', '2026');
        if (state.unidade) params.set('unidade', state.unidade);

        console.log('[Tracker] Buscando meta e progresso para:', state.regional || '(consolidado)');

        // Busca meta
        const metaResponse = await fetch(`/api/entregas/meta?${params.toString()}`, { cache: 'no-store' });
        const metaJson = await metaResponse.json().catch(() => ({}));
        if (!on) return;

        console.log('[Tracker] Meta response:', metaJson);

        // Busca progresso (ano 2026 para bater com entregas)
        const progResponse = await fetch(`/api/entregas/progresso?${params.toString()}`, { cache: 'no-store' });
        const progJson = await progResponse.json().catch(() => ({}));
        if (!on) return;

        console.log('[Tracker] Progresso response:', progJson);

        // Sempre define metaData, mesmo se houver erro (para mostrar o tracker)
        if (metaJson?.ok && progJson?.ok) {
          const meta = Number(metaJson.meta || 0);
          const total = Number(progJson.total || 0);
          console.log('[Tracker] Dados carregados:', { meta, total, meses: progJson.meses });
          
          setMetaData({
            meta,
            progresso: progJson.meses || {},
            total,
          });
        } else {
          console.error('[Tracker] Erro ao carregar meta/progresso:', { metaJson, progJson });
          // Define com valores padrão para sempre mostrar o tracker
          setMetaData({ 
            meta: Number(metaJson?.meta || 0), 
            progresso: progJson?.meses || {}, 
            total: Number(progJson?.total || 0) 
          });
        }
      } catch (error) {
        console.error('[Tracker] Erro ao buscar meta/progresso:', error);
        setMetaData({ meta: 0, progresso: {}, total: 0 });
      }
    })();
    return () => { on = false; };
  }, [state.regional, state.unidade]);

  // Carrega dados por unidade quando regional estiver selecionada (para Diagnóstico)
  useEffect(() => {
    if (!state.regional || tab !== 'diag') {
      setUnidadesData(null);
      return;
    }

    let on = true;
    setUnidadesData(null); // Reseta enquanto carrega
    (async () => {
      try {
        const params = new URLSearchParams();
        params.set('regional', state.regional);

        console.log('[Diagnóstico] Buscando unidades para:', state.regional);

        const response = await fetch(`/api/entregas/diagnostico-unidades?${params.toString()}`, { cache: 'no-store' });
        const json = await response.json().catch(() => ({ ok: false, error: 'Erro ao parsear JSON' }));
        
        if (!on) return;

        console.log('[Diagnóstico] Response:', json);

        if (json?.ok && Array.isArray(json.unidades)) {
          console.log('[Diagnóstico] Unidades carregadas:', json.unidades.length);
          setUnidadesData(json.unidades);
        } else {
          console.error('[Diagnóstico] Erro ao carregar unidades:', json);
          setUnidadesData([]);
        }
      } catch (error) {
        console.error('[Diagnóstico] Erro ao buscar unidades:', error);
        setUnidadesData([]);
      }
    })();
    return () => { on = false; };
  }, [state.regional, tab]);

  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (state.regional) params.set('regional', state.regional);
        if (state.unidade) params.set('unidade', state.unidade);
        if (state.q) params.set('q', state.q);
        if (state.entregue) params.set('entregue', state.entregue);
        params.set('page', String(state.page));
        params.set('pageSize', String(state.pageSize));
        // Sem cache para garantir dados sempre atualizados
        const { json } = await fetchJSON('/api/entregas/list?' + params.toString(), { 
          cache: 'no-store'
        });
        if (!on) return;
        setRows((json.rows || []) as Row[]);
        setTotal(Number(json.total || 0));
      } catch (e) {
        if (!on) return;
        console.error('Erro ao carregar entregas', e);
        setRows([]);
        setTotal(0);
      } finally {
        if (on) setLoading(false);
      }
    })();
    return () => { on = false };
  }, [state.regional, state.unidade, state.q, state.entregue, state.page, state.pageSize]);

  function openStatusModal(row: Row) {
    const current = statusMap[row.id];
    const code: StatusCode = (current?.code || 'ATIVO');
    setStatusModal({
      open: true,
      row,
      code,
      obs: current?.obs || '',
    });
  }

  async function saveStatusModal() {
    if (!statusModal.row) {
      setStatusModal({ open: false });
      return;
    }
    const baseCode: StatusCode = (statusModal.code || 'ATIVO');
    
    // Se está marcando como "DEMITIDO_2026_SEM_EPI", verifica se realmente não recebeu EPI
    if (baseCode === 'DEMITIDO_2026_SEM_EPI') {
      try {
        const cpf = statusModal.row.id;
        const { json: deliverData } = await fetchJSON(`/api/entregas/deliver?cpf=${encodeURIComponent(cpf)}`, { cache: 'no-store' });
        const entregas = deliverData?.rows || [];
        
        // Verifica se há entregas registradas
        if (entregas.length > 0 && entregas.some((e: any) => e.qty_delivered > 0)) {
          showToast('Este colaborador já recebeu EPI. Não é possível marcar como "Demitido 2026 sem EPI".', 'error');
          return;
        }
      } catch (e) {
        console.error('Erro ao verificar entregas:', e);
        // Continua mesmo com erro, mas avisa o usuário
        const confirmar = window.confirm('Não foi possível verificar se o colaborador recebeu EPI. Deseja continuar mesmo assim?');
        if (!confirmar) return;
      }
    }
    
    const info: StatusInfo = {
      code: baseCode,
      label: STATUS_LABELS[baseCode],
      obs: statusModal.obs || '',
    };
    const cpf = statusModal.row.id;
    
    // Salva no banco de dados
    try {
      await fetchJSON('/api/colaboradores/situacao-meta', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cpf,
          situacao: baseCode,
          observacao: statusModal.obs || '',
        }),
      });
    } catch (e) {
      console.error('Erro ao salvar situação no banco:', e);
      // Continua mesmo com erro, salva no localStorage
    }
    
    setStatusMap((prev) => ({
      ...prev,
      [cpf]: info,
    }));
    setStatusModal({ open: false });
    showToast('Situação do colaborador atualizada com sucesso!', 'success');
  }

  async function openDeliver(row: Row) {
    setModal({ open: true, row });
    setSelectedEpis({});

    setKitSectors([]);
    setKitSector('');

    // 1) Carrega setores disponíveis para essa função (stg_epi_map)
    let sectors: string[] = [];
    try {
      const { json: secJ } = await fetchJSON(
        `/api/entregas/kit-sectors?funcao=${encodeURIComponent(row.funcao || '')}`,
        { cache: 'no-store' },
      );
      sectors = secJ?.sectors || [];
    } catch (e) {
      // se falhar, cai no comportamento antigo
      sectors = [];
    }
    setKitSectors(sectors);

    // 2) Seleciona setor inicial (se houver mais de um, tenta usar a unidade do colaborador como “match”)
    let selectedSector = '';
    if (sectors.length === 1) selectedSector = sectors[0] || '';
    else if (sectors.length > 1) selectedSector = findBestUnitMatch(row.unidade || '', sectors) || sectors[0] || '';
    else selectedSector = row.unidade || '';
    setKitSector(selectedSector);

    // 3) monta query string com função + unidade/setor escolhido
    const params = new URLSearchParams();
    params.set('funcao', row.funcao || '');
    // PCG/PGR base (unidade do colaborador) para não misturar kits de programas diferentes
    if (row.unidade) params.set('pcg', row.unidade);
    if (selectedSector) params.set('unidade', selectedSector);

    // kit esperado (considerando função + unidade hospitalar/setor)
    const { json: kitJ } = await fetchJSON('/api/entregas/kit?' + params.toString(), { cache: 'no-store' });
    const items: KitItem[] = (kitJ?.items || kitJ?.itens || []).map((r: any) => ({
      item: r.item ?? r.epi ?? r.epi_item ?? '',
      quantidade: Number(r.quantidade ?? 1) || 1,
      nome_site: r.nome_site ?? null,
    })).filter((x: any) => x.item);
    setKit(items);

    // entregas já registradas para o CPF
    const { json: dJ } = await fetchJSON('/api/entregas/deliver?cpf=' + encodeURIComponent(row.id), { cache: 'no-store' });
    setDeliv((dJ?.rows || []).map((r: any) => ({
      item: String(r.item || ''),
      qty_delivered: Number(r.qty_delivered || 0),
      qty_required: Number(r.qty_required || 0),
      deliveries: Array.isArray(r.deliveries) ? r.deliveries : [],
    })));
  }

  async function doDeliver() {
    if (!modal.row) return;
    
    // Verifica se há EPIs selecionados para entrega em massa
    const selectedItems = Object.keys(selectedEpis).filter(item => selectedEpis[item].qtd > 0);
    
    if (selectedItems.length === 0) {
      showToast('Selecione pelo menos um EPI para fazer a entrega.', 'info');
      return;
    }

    // Entrega em massa
    try {
      const dataEntrega = selectedEpis[selectedItems[0]]?.data || new Date().toISOString().substring(0, 10);
      const items = selectedItems.map(item => ({
        item,
        qty: selectedEpis[item].qtd,
        date: selectedEpis[item].data || dataEntrega,
        qty_required: kit.find(k => k.item === item)?.quantidade || 1,
      }));

      const body = {
        cpf: modal.row.id,
        items,
      };

      const { ok, json } = await fetchJSON('/api/entregas/deliver', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'Content-Type': 'application/json' },
      });

      if (!ok || !json?.ok) {
        console.error('Erro ao registrar entregas em massa', json);
        if (json?.error) {
          showToast(`Erro ao registrar entregas: ${json.error}`, 'error');
        } else {
          showToast('Erro ao registrar entregas em massa.', 'error');
        }
        return;
      }

      // Recarrega as entregas
      const { json: dJ } = await fetchJSON(
        '/api/entregas/deliver?cpf=' + encodeURIComponent(modal.row.id),
        { cache: 'no-store' },
      );

      setDeliv((dJ?.rows || []).map((r: any) => ({
        item: String(r.item || ''),
        qty_delivered: Number(r.qty_delivered || 0),
        qty_required: Number(r.qty_required || 0),
        deliveries: Array.isArray(r.deliveries) ? r.deliveries : [],
      })));

      // Limpa seleção
      setSelectedEpis({});

      // Atualiza a lista para refletir "Entregue" na sinalização
      try {
        const params = new URLSearchParams();
        params.set('regional', state.regional);
        if (state.unidade) params.set('unidade', state.unidade);
        if (state.q) params.set('q', state.q);
        if (state.entregue) params.set('entregue', state.entregue);
        params.set('page', String(state.page));
        params.set('pageSize', String(state.pageSize));
        const { json: listJ } = await fetchJSON('/api/entregas/list?' + params.toString(), { cache: 'no-store' });
        setRows((listJ?.rows || []) as Row[]);
        setTotal(Number(listJ?.total ?? 0));
      } catch (_) {}
      
      showToast(`Entregas registradas com sucesso! ${selectedItems.length} EPI(s) entregue(s).`, 'success');
    } catch (e) {
      console.error('Erro inesperado ao registrar entregas em massa', e);
      alert('Erro inesperado ao registrar entregas em massa.');
    }
  }

  async function reloadDeliveries(cpf: string) {
    const { json: dJ } = await fetchJSON('/api/entregas/deliver?cpf=' + encodeURIComponent(cpf), { cache: 'no-store' });
    setDeliv((dJ?.rows || []).map((r: any) => ({
      item: String(r.item || ''),
      qty_delivered: Number(r.qty_delivered || 0),
      qty_required: Number(r.qty_required || 0),
      deliveries: Array.isArray(r.deliveries) ? r.deliveries : [],
    })));
  }

  async function saveEditLaunch() {
    if (!editLaunch.cpf || !editLaunch.item) return;
    const deliveries = Array.isArray(editLaunch.deliveries) ? editLaunch.deliveries : [];
    const body = {
      cpf: editLaunch.cpf,
      item: editLaunch.item,
      qty_required: Number(editLaunch.qty_required || 1) || 1,
      deliveries,
    };
    const { json } = await fetchJSON('/api/entregas/deliver', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!json?.ok) {
      showToast(`Erro ao editar entregas: ${json?.error || 'Erro'}`, 'error');
      return;
    }
    await reloadDeliveries(editLaunch.cpf);
    showToast('Entregas atualizadas com sucesso.', 'success');
    setEditLaunch({ open: false });
  }

  const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
  const diagResumo = useMemo(() => {
    if (!rows.length) return null;

    const counts: Record<StatusCode, number> = {
      ATIVO: 0,
      FERIAS: 0,
      INSS: 0,
      LICENCA_MATERNIDADE: 0,
      DEMITIDO_2025_SEM_EPI: 0,
      DEMITIDO_2026_SEM_EPI: 0,
      EXCLUIDO_META: 0,
    };
    const regionaisCount: Record<string, number> = {};

    for (const r of rows) {
      const st = statusMap[r.id];
      const code: StatusCode = (st?.code || 'ATIVO');
      counts[code] = (counts[code] || 0) + 1;
      const reg = (r.regional || '').trim();
      if (reg) {
        regionaisCount[reg] = (regionaisCount[reg] || 0) + 1;
      }
    }

    const foraMeta = EXCLUDED_STATUS.reduce((acc, code) => acc + (counts[code] || 0), 0);
    const total = rows.length;
    const dentroMeta = total - foraMeta;
    const regionaisLista = Object.entries(regionaisCount).sort((a, b) =>
      a[0].localeCompare(b[0], 'pt-BR'),
    );

    return {
      total,
      counts,
      foraMeta,
      dentroMeta,
      regionaisLista,
    };
  }, [rows, statusMap]);

  const visibleRows = useMemo(() => {
    return rows.filter((r) => {
      const st = statusMap[r.id];
      const code: StatusCode = (st?.code || 'ATIVO');
      if (!showExcluded && EXCLUDED_STATUS.includes(code)) return false;
      return true;
    });
  }, [rows, statusMap, showExcluded]);

  // Quick stats - calculado após visibleRows estar disponível
  const quickStats = useMemo(() => {
    const ativos = visibleRows.filter(r => {
      const st = statusMap[r.id];
      return (st?.code || 'ATIVO') === 'ATIVO';
    }).length;
    const comPendencias = visibleRows.filter(r => {
      // Aqui poderia verificar se tem pendências, mas por enquanto só conta os não-ativos
      const st = statusMap[r.id];
      return st && st.code !== 'ATIVO';
    }).length;
    return { total: visibleRows.length, ativos, comPendencias };
  }, [visibleRows, statusMap]);

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
            EPI • Entregas
          </p>
          <h1 className="mt-1 text-lg font-semibold">Entregas de EPI</h1>
          <p className="mt-1 text-xs text-muted">
            Controle de entregas de EPI por colaborador, combinando base oficial do Alterdata e cadastros manuais.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1.5 text-xs text-muted">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span>Base oficial + colaboradores manuais</span>
        </div>
      </div>
      
      {/* Abas */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-4 text-xs">
          <button
            type="button"
            onClick={() => setTab('lista')}
            className={`border-b-2 px-3 py-2 ${
              tab === 'lista'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            Lista de colaboradores
          </button>
          <button
            type="button"
            onClick={() => setTab('diag')}
            className={`border-b-2 px-3 py-2 ${
              tab === 'diag'
                ? 'border-emerald-500 text-emerald-500'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            Diagnóstico
          </button>
        </nav>
      </div>

      {/* Aba: Lista */}
      {tab === 'lista' && (
        <>
          {/* Tracker de Progresso - META vs REAL (no topo da aba Lista) */}
          {(() => {
            // Se ainda está carregando, mostra loading
            if (metaData === null) {
              return (
                <div className="rounded-xl border border-border bg-panel p-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs text-muted">Carregando meta e progresso...</span>
                  </div>
                </div>
              );
            }
            
            // Se não tem dados ainda, não mostra nada (já mostrou loading acima)
            if (!metaData) {
              return null;
            }
            
            // Mostra tracker sempre que tem metaData (mesmo se meta for 0)
            const meses = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
            const mesesNomes = [
              'Janeiro',
              'Fevereiro',
              'Março',
              'Abril',
              'Maio',
              'Junho',
              'Julho',
              'Agosto',
              'Setembro',
              'Outubro',
              'Novembro',
              'Dezembro',
            ];
            const progressoMeses = metaData.progresso || {};
            const metaTotal = metaData.meta || 0;
            const anoNum = ANO_ENTREGAS_TRACKER;

            /** Meta em itens: 0 jan–abr; mai–dez soma = metaTotal (linear em 8 meses). */
            const metaAcumArr = epiMetaAcumuladaMayDec(metaTotal);
            const entregueAcumArr = meses.map((_, idx) =>
              meses
                .slice(0, idx + 1)
                .reduce((acc, m) => acc + (Number(progressoMeses[m]) || 0), 0),
            );
            const realPctAcum = meses.map((_, idx) =>
              metaTotal > 0
                ? Math.min(
                    100,
                    Math.round((entregueAcumArr[idx] / metaTotal) * 10000) / 100,
                  )
                : 0,
            );

            const progressoFiltrado = mesSelecionado
              ? { [mesSelecionado]: metaData.progresso[mesSelecionado] || 0 }
              : metaData.progresso;

            const cy = new Date().getFullYear();
            const cm = new Date().getMonth() + 1;
            let entregueAteMesCorrente = 0;
            if (anoNum === cy) {
              meses.forEach((m, i) => {
                if (i + 1 <= cm) entregueAteMesCorrente += Number(progressoMeses[m]) || 0;
              });
            } else if (anoNum < cy) {
              entregueAteMesCorrente = meses.reduce((acc, m) => acc + (Number(progressoMeses[m]) || 0), 0);
            }

            return (
          <MetaVsRealCard
            title={`Meta vs Real - Entregas de EPI (${state.regional ? state.regional : 'Consolidado'})`}
            yearControl={
              <span className="rounded-lg border border-border bg-bg px-3 py-1.5 text-xs font-semibold tabular-nums">
                {ANO_ENTREGAS_TRACKER}
              </span>
            }
            monthsShort={mesesNomes.map((n) => n.substring(0, 3))}
            metaPct={meses.map((_, idx) =>
              metaTotal > 0 ? Math.min(100, Math.round(((metaAcumArr[idx] ?? 0) / metaTotal) * 10000) / 100) : 0,
            )}
            realPct={meses.map((_, idx) => {
              const future = isFutureMonthCellEntregas(anoNum, idx + 1)
              return future ? null : Number(realPctAcum[idx] ?? 0)
            })}
            evolPct={meses.map((_, idx) => {
              const future = isFutureMonthCellEntregas(anoNum, idx + 1)
              if (future) return null
              const cur = Number(realPctAcum[idx] ?? 0)
              const prev = idx > 0 ? Number(realPctAcum[idx - 1] ?? 0) : 0
              return cur - prev
            })}
            realClassName={(idx) => {
              const future = isFutureMonthCellEntregas(anoNum, idx + 1)
              if (future) return 'bg-muted/30 text-muted border border-border/50'
              const metaQtd = metaAcumArr[idx] ?? 0
              const realQtd = entregueAcumArr[idx] ?? 0
              const ambosZero = metaTotal < 1 && realQtd < 1
              const atingiu = metaTotal > 0 && (metaQtd <= 0 ? realQtd <= 0 : realQtd >= metaQtd)
              const folhaMetaZeroRealPos = metaQtd <= 0 && realQtd > 0
              return ambosZero
                ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                : folhaMetaZeroRealPos || atingiu
                  ? 'bg-emerald-500 text-white'
                  : 'bg-red-500 text-white'
            }}
            metaTitle={(idx) => {
              const head = metaAcumArr[idx] ?? 0
              const pct =
                metaTotal > 0 ? Math.min(100, Math.round((head / metaTotal) * 10000) / 100) : 0
              return `${mesesNomes[idx]}: meta acumulada ${head.toLocaleString('pt-BR')} itens (${fmtPctEntregas(pct)}% da meta anual)`
            }}
            realTitle={(idx) => {
              const future = isFutureMonthCellEntregas(anoNum, idx + 1)
              if (future) return `${mesesNomes[idx]}: mês ainda não iniciado`
              const metaQtd = metaAcumArr[idx] ?? 0
              const realQtd = entregueAcumArr[idx] ?? 0
              const pct = Number(realPctAcum[idx] ?? 0)
              return `${mesesNomes[idx]}: ${realQtd.toLocaleString('pt-BR')} itens acum. · meta ${metaQtd.toLocaleString('pt-BR')} · cobertura ${fmtPctEntregas(pct)}%`
            }}
            evolTitle={(idx) => {
              const future = isFutureMonthCellEntregas(anoNum, idx + 1)
              if (future) return `${mesesNomes[idx]}: mês ainda não iniciado`
              const cur = Number(realPctAcum[idx] ?? 0)
              const prev = idx > 0 ? Number(realPctAcum[idx - 1] ?? 0) : 0
              const evol = cur - prev
              const sinal = evol > 0 ? '+' : ''
              return `${mesesNomes[idx]}: ${sinal}${fmtPctEntregas(evol)}% do real no mês`
            }}
            footerLeft={
              <>
                Total: <span className="font-semibold text-text">{entregueAteMesCorrente.toLocaleString('pt-BR')}</span> de{' '}
                <span className="font-semibold text-text">{metaTotal.toLocaleString('pt-BR')}</span> itens entregues
              </>
            }
            footerRight={
              <>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  {fmtPctEntregas(metaTotal > 0 ? (entregueAteMesCorrente / metaTotal) * 100 : 0)}%
                </span>{' '}
                de cobertura
              </>
            }
          />
        );
      })()}

          {/* Filtros Principais */}
            <div className="rounded-xl border border-border bg-panel p-4 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs font-semibold text-muted uppercase tracking-wide px-2">Filtros</span>
                <div className="h-px flex-1 bg-border" />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="max-w-[200px]">
                  <label className="text-xs font-medium block mb-1.5 text-text">Regional</label>
                  <select
                    value={state.regional}
                    onChange={e => setFilter({ regional: e.target.value, unidade: '', page: 1 })}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                    aria-label="Selecione a Regional"
                  >
                    <option value="">Consolidado (todas)</option>
                    {regionais.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5 text-text">Unidade</label>
                  <select
                    value={state.unidade}
                    onChange={e => setFilter({ unidade: e.target.value, page: 1 })}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Selecione a Unidade"
                  >
                    <option value="">(todas)</option>
                    {unidades.map(u => <option key={u.unidade} value={u.unidade}>{u.unidade}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5 text-text">Entrega</label>
                  <select
                    value={state.entregue || ''}
                    onChange={e => setFilterEntregue((e.target.value || '') as '' | 'pendente' | 'entregue')}
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                    aria-label="Filtrar por situação de entrega"
                  >
                    <option value="">Todos</option>
                    <option value="pendente">Pendente</option>
                    <option value="entregue">Entregue</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1.5 text-text">Busca (nome/CPF)</label>
                  <input
                    value={state.q}
                    onChange={e => setFilter({ q: e.target.value, page: 1 })}
                    placeholder="Digite para filtrar…"
                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text placeholder:text-muted shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                    aria-label="Buscar por nome ou CPF"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-dashed border-border bg-card/40 p-3 space-y-2">
                <p className="text-xs text-muted">
                  Excel com aba <strong>Pendentes (tela)</strong> — quem está como Pendente na lista e quais EPIs deve
                  entregar — mais lançamentos, resumo e pendências parciais. Use os filtros da tela; para tudo, Regional
                  em Consolidado.
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label className="text-xs font-medium block mb-1 text-text">Data inicial</label>
                    <input
                      type="date"
                      value={exportDe}
                      onChange={(e) => setExportDe(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1 text-text">Data final</label>
                    <input
                      type="date"
                      value={exportAte}
                      max={new Date().toISOString().slice(0, 10)}
                      onChange={(e) => setExportAte(e.target.value)}
                      className="px-3 py-2 rounded-lg border border-border bg-card text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={exportarRelatorioCompleto}
                    disabled={exportBusy}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-emerald-600 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 disabled:opacity-50 text-sm font-medium"
                  >
                    <Download className="w-4 h-4" />
                    {exportBusy ? 'Gerando Excel…' : 'Exportar relatório completo'}
                  </button>
                </div>
              </div>
            </div>
            
            {/* Ações e Configurações */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={openNewManual}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 shadow-sm transition-colors font-medium text-sm"
                aria-label="Cadastrar novo colaborador"
              >
                <Package className="w-4 h-4" />
                Cadastrar colaborador
              </button>
              
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-text">Itens por página:</label>
                <select
                  value={state.pageSize}
                  onChange={e => setFilter({ pageSize: Number(e.target.value) || 25, page: 1 })}
                  className="px-3 py-2 rounded-xl border border-border bg-card text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                  aria-label="Quantidade de itens por página"
                >
                  {[10,25,50,100].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            {/* Legenda Compacta e Filtro */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 py-3 rounded-xl border border-border bg-panel">
              <details className="group">
                <summary className="text-xs font-medium text-text cursor-pointer list-none flex items-center gap-2 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                  <Info className="w-4 h-4" />
                  <span>Ver legenda de status</span>
                  <span className="text-muted group-open:hidden">▼</span>
                  <span className="text-muted hidden group-open:inline">▲</span>
                </summary>
                <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                  <div className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                    <span className="text-muted">Ativo</span>
                  </div>
                  <div className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-sky-500 flex-shrink-0" />
                    <span className="text-muted">Férias</span>
                  </div>
                  <div className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                    <span className="text-muted">INSS</span>
                  </div>
                  <div className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                    <span className="text-muted">Licença maternidade</span>
                  </div>
                  <div className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    <span className="text-muted">Demitido 2025 sem EPI</span>
                  </div>
                  <div className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-600 flex-shrink-0" />
                    <span className="text-muted">Demitido 2026 sem EPI</span>
                  </div>
                  <div className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-neutral-400 flex-shrink-0" />
                    <span className="text-muted">Excluído da meta</span>
                  </div>
                  <div className="inline-flex items-center gap-1">
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full border border-border flex-shrink-0">🅘</span>
                    <span className="text-muted">Observação rápida</span>
                  </div>
                </div>
              </details>
              
              <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-text">
                <input
                  type="checkbox"
                  className="rounded border-border text-emerald-600 focus:ring-emerald-500"
                  checked={showExcluded}
                  onChange={(e) => setShowExcluded(e.target.checked)}
                  aria-label="Mostrar colaboradores fora da meta"
                />
                <span>Mostrar colaboradores fora da meta</span>
              </label>
            </div>

            {!state.regional && (
              <div className="p-4 rounded-xl bg-amber-100 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                Selecione uma <strong>Regional</strong> para começar.
              </div>
            )}

            {state.regional && (
              <>
                {/* Alertas de entregas vencidas — quando entregar de novo (controle de qualidade, não entra na meta) */}
                <div className="mb-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 overflow-hidden">
                  <div className="px-4 py-3 border-b border-amber-200 dark:border-amber-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <div>
                        <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">Alertas de entregas vencidas</h3>
                        <p className="text-[11px] text-amber-700 dark:text-amber-300">Quando entregar de novo — controle de qualidade (não impacta meta)</p>
                      </div>
                    </div>
                    {loadingAlertas && (
                      <div className="w-5 h-5 border-2 border-amber-600 border-t-transparent rounded-full animate-spin flex-shrink-0" />
                    )}
                    {!loadingAlertas && alertasVencidas.length > 0 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                        {alertasVencidas.length} vencida{alertasVencidas.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {loadingAlertas && (
                    <div className="px-4 py-3 text-[11px] text-amber-700 dark:text-amber-300">Carregando alertas...</div>
                  )}
                  {!loadingAlertas && alertasVencidas.length === 0 && (
                    <div className="px-4 py-3 text-[11px] text-amber-700 dark:text-amber-300">Nenhuma entrega vencida no momento.</div>
                  )}
                  {!loadingAlertas && alertasVencidas.length > 0 && (
                      <div className="max-h-48 overflow-y-auto">
                        <table className="min-w-full text-[11px]">
                          <thead className="bg-amber-100/50 dark:bg-amber-900/30 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-amber-900 dark:text-amber-100">Colaborador</th>
                              <th className="px-3 py-2 text-left font-semibold text-amber-900 dark:text-amber-100">EPI</th>
                              <th className="px-3 py-2 text-left font-semibold text-amber-900 dark:text-amber-100">Última entrega</th>
                              <th className="px-3 py-2 text-left font-semibold text-amber-900 dark:text-amber-100">Próxima entrega em</th>
                              <th className="px-3 py-2 text-center font-semibold text-amber-900 dark:text-amber-100">Vencido há</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-200 dark:divide-amber-800">
                            {alertasVencidas.slice(0, 50).map((a, i) => (
                              <tr key={`${a.cpf}-${a.item}-${i}`} className="hover:bg-amber-100/30 dark:hover:bg-amber-900/20">
                                <td className="px-3 py-2 font-medium text-amber-900 dark:text-amber-100 truncate max-w-[140px]" title={a.nome}>{a.nome || a.cpf}</td>
                                <td className="px-3 py-2 text-amber-800 dark:text-amber-200 truncate max-w-[140px]" title={a.item}>{a.item}</td>
                                <td className="px-3 py-2 text-amber-800 dark:text-amber-200">{new Date(a.ultima_entrega_em).toLocaleDateString('pt-BR')}</td>
                                <td className="px-3 py-2 text-amber-800 dark:text-amber-200">{new Date(a.proxima_entrega_em).toLocaleDateString('pt-BR')}</td>
                                <td className="px-3 py-2 text-center">
                                  <span className="font-semibold text-amber-700 dark:text-amber-300">{a.dias_vencido} dia{a.dias_vencido !== 1 ? 's' : ''}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {alertasVencidas.length > 50 && (
                          <div className="px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-100/30 dark:bg-amber-900/30">
                            Exibindo as 50 primeiras de {alertasVencidas.length} vencidas. Ajuste filtros para refinar.
                          </div>
                        )}
                      </div>
                    )}
                </div>

              <div className="rounded-xl border border-border bg-panel overflow-hidden">
                <div className="max-h-[calc(100vh-400px)] overflow-y-auto">
                  <table className="min-w-full text-[11px] align-middle">
                    <thead className="sticky top-0 bg-panel z-10">
                      <tr>
                        <th className="px-3 py-2.5 text-center border-b border-border whitespace-nowrap text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-panel/95 backdrop-blur-sm">
                          Nome
                        </th>
                        <th className="px-3 py-2.5 text-center border-b border-border whitespace-nowrap text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-panel/95 backdrop-blur-sm">
                          CPF
                        </th>
                        <th className="px-3 py-2.5 text-center border-b border-border whitespace-nowrap text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-panel/95 backdrop-blur-sm">
                          Função
                        </th>
                        <th className="px-3 py-2.5 text-center border-b border-border whitespace-nowrap text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-panel/95 backdrop-blur-sm">
                          Unidade
                        </th>
                        <th className="px-3 py-2.5 text-center border-b border-border whitespace-nowrap text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-panel/95 backdrop-blur-sm">
                          Regional
                        </th>
                        <th className="px-3 py-2.5 text-center border-b border-border whitespace-nowrap text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-panel/95 backdrop-blur-sm" title="Situação geral das entregas">
                          Entrega
                        </th>
                        <th className="px-3 py-2.5 text-center border-b border-border whitespace-nowrap text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-panel/95 backdrop-blur-sm">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-muted">
                            <div className="flex flex-col items-center gap-2">
                              <div className="w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                              <span className="text-xs">Carregando colaboradores…</span>
                            </div>
                          </td>
                        </tr>
                      )}
                      {!loading && visibleRows.map((r) => {
                        const st = statusMap[r.id];
                        const code: StatusCode = (st?.code || 'ATIVO');
                        const label = st?.label || STATUS_LABELS[code];
                        const obs = st?.obs || '';
                        const isForaMeta = EXCLUDED_STATUS.includes(code);
                        return (
                          <tr key={r.id} className="odd:bg-panel/30 hover:bg-panel/70 transition-colors border-b border-border/50">
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${statusDotClass(code)}`} aria-label={label} />
                                <span className="truncate font-medium text-text" title={r.nome}>{r.nome}</span>
                                {(obs || code !== 'ATIVO') && (
                                  <span
                                    className="text-[10px] px-1.5 py-0.5 rounded-full border border-border cursor-help flex-shrink-0"
                                    title={obs || label}
                                    aria-label={`Observação: ${obs || label}`}
                                  >
                                    🅘
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2.5 text-center whitespace-nowrap text-text" title={maskCPF(r.id)}>{maskCPF(r.id)}</td>
                            <td className="px-3 py-2.5 text-center text-text" title={r.funcao || '—'}>{r.funcao || '—'}</td>
                            <td className="px-3 py-2.5 text-center text-text" title={r.unidade || '—'}>{r.unidade || '—'}</td>
                            <td className="px-3 py-2.5 text-center text-text" title={r.regional || '—'}>{r.regional || '—'}</td>
                            <td className="px-3 py-2.5 text-center">
                              <span
                                className={`inline-flex items-center justify-center rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                                  r.entregue
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-200 dark:border-emerald-800'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-700'
                                }`}
                              >
                                {r.entregue ? 'Entregue' : 'Pendente'}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => openStatusModal(r)}
                                  className="p-1.5 rounded-lg border border-border bg-panel hover:bg-muted text-text transition-colors"
                                  aria-label={`Ajustar situação de ${r.nome}`}
                                  title="Ajustar situação do colaborador"
                                >
                                  <Settings className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => openDeliver(r)}
                                  disabled={isForaMeta}
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                    isForaMeta
                                      ? 'bg-neutral-300 text-neutral-500 cursor-not-allowed dark:bg-neutral-800 dark:text-neutral-500'
                                      : 'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 shadow-sm'
                                  }`}
                                  aria-label={`Entregar EPIs para ${r.nome}`}
                                  title={isForaMeta ? 'Colaborador fora da meta - entrega desabilitada' : 'Registrar entrega de EPIs'}
                                >
                                  <Package className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Entregar</span>
                                </button>
                                <button
                                  onClick={() => openDeliver(r)}
                                  className="inline-flex items-center justify-center p-1.5 rounded-lg border border-border bg-panel hover:bg-muted text-text transition-colors"
                                  aria-label={`Ver histórico de entregas de ${r.nome}`}
                                  title="Ver/editar histórico de entregas"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {!loading && visibleRows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-3 py-8 text-center text-muted">
                            <div className="flex flex-col items-center gap-2">
                              <span className="text-sm">Nenhum colaborador encontrado.</span>
                              <span className="text-xs opacity-70">Ajuste os filtros ou selecione outra regional.</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border bg-panel/50">
                  <div className="text-xs font-medium text-muted">
                    Total: <span className="text-text font-semibold">{total.toLocaleString('pt-BR')}</span> colaborador{total !== 1 ? 'es' : ''}
                    {visibleRows.length !== total && (
                      <span className="ml-2 text-muted">
                        ({visibleRows.length} {showExcluded ? 'exibidos' : 'visíveis'})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1.5 rounded-lg border border-border bg-panel hover:bg-muted text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={state.page <= 1}
                      onClick={() => setFilter({ page: Math.max(1, state.page - 1) })}
                      aria-label="Página anterior"
                    >
                      Anterior
                    </button>
                    <span className="text-xs text-muted min-w-[100px] text-center">
                      Página <span className="font-semibold text-text">{state.page}</span> de <span className="font-semibold text-text">{totalPages}</span>
                    </span>
                    <button
                      className="px-3 py-1.5 rounded-lg border border-border bg-panel hover:bg-muted text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={state.page >= totalPages}
                      onClick={() => setFilter({ page: Math.min(totalPages, state.page + 1) })}
                      aria-label="Próxima página"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              </div>
              </>
            )}

        </>
      )}

      {/* Aba: Diagnóstico */}
      {tab === 'diag' && (
        <div className="space-y-4">
          {!state.regional ? (
            <div className="rounded-xl border border-border bg-panel p-8 text-center">
              <p className="text-muted text-sm">
                Selecione uma Regional na aba de Lista para ver o diagnóstico por unidade hospitalar.
              </p>
            </div>
          ) : unidadesData === null ? (
            <div className="rounded-xl border border-border bg-panel p-8 text-center">
              <div className="flex flex-col items-center gap-2">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-muted text-sm">Carregando dados...</p>
              </div>
            </div>
          ) : unidadesData.length === 0 ? (
            <div className="rounded-xl border border-border bg-panel p-8 text-center">
              <p className="text-muted text-sm">
                Nenhuma unidade encontrada para a Regional selecionada.
              </p>
            </div>
          ) : (
            <>
            {/* Resumo de EPIs por Tipo */}
            <ResumoEpisPorTipo regional={state.regional} unidadesData={unidadesData} />
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="min-w-full" style={{ fontSize: '11px' }}>
                <thead className="bg-emerald-600 text-white">
                  <tr>
                    <th className="px-3 py-2 text-right border-b border-emerald-700 font-semibold">Unidade</th>
                    <th className="px-3 py-2 text-center border-b border-emerald-700 font-semibold">Qte Prevista</th>
                    <th className="px-3 py-2 text-center border-b border-emerald-700 font-semibold">Janeiro</th>
                    <th className="px-3 py-2 text-center border-b border-emerald-700 font-semibold">Fevereiro</th>
                    <th className="px-3 py-2 text-center border-b border-emerald-700 font-semibold">Março</th>
                    <th className="px-3 py-2 text-center border-b border-emerald-700 font-semibold">Abril</th>
                    <th className="px-3 py-2 text-center border-b border-emerald-700 font-semibold">Maio</th>
                    <th className="px-3 py-2 text-center border-b border-emerald-700 font-semibold">Junho</th>
                    <th className="px-3 py-2 text-center border-b border-emerald-700 font-semibold">Julho</th>
                    <th className="px-3 py-2 text-center border-b border-emerald-700 font-semibold">Agosto</th>
                    <th className="px-3 py-2 text-center border-b border-emerald-700 font-semibold">Setembro</th>
                    <th className="px-3 py-2 text-center border-b border-emerald-700 font-semibold">Outubro</th>
                    <th className="px-3 py-2 text-center border-b border-emerald-700 font-semibold">Novembro</th>
                    <th className="px-3 py-2 text-center border-b border-emerald-700 font-semibold">Dezembro</th>
                    <th className="px-3 py-2 text-center border-b border-emerald-700 font-semibold">Total Realizada</th>
                  </tr>
                </thead>
                <tbody>
                  {unidadesData.map((unidade, idx) => (
                    <tr key={unidade.unidade} className={idx % 2 === 0 ? 'bg-panel/40' : 'bg-card'}>
                      <td className="px-3 py-2 text-right border-b border-border font-medium text-text">{unidade.unidade}</td>
                      <td className="px-3 py-2 text-center border-b border-border text-text">{unidade.qtePrevista.toLocaleString('pt-BR')}</td>
                      <td className="px-3 py-2 text-center border-b border-border text-text">{unidade.meses['01']?.toLocaleString('pt-BR') || '0'}</td>
                      <td className="px-3 py-2 text-center border-b border-border text-text">{unidade.meses['02']?.toLocaleString('pt-BR') || '0'}</td>
                      <td className="px-3 py-2 text-center border-b border-border text-text">{unidade.meses['03']?.toLocaleString('pt-BR') || '0'}</td>
                      <td className="px-3 py-2 text-center border-b border-border text-text">{unidade.meses['04']?.toLocaleString('pt-BR') || '0'}</td>
                      <td className="px-3 py-2 text-center border-b border-border text-text">{unidade.meses['05']?.toLocaleString('pt-BR') || '0'}</td>
                      <td className="px-3 py-2 text-center border-b border-border text-text">{unidade.meses['06']?.toLocaleString('pt-BR') || '0'}</td>
                      <td className="px-3 py-2 text-center border-b border-border text-text">{unidade.meses['07']?.toLocaleString('pt-BR') || '0'}</td>
                      <td className="px-3 py-2 text-center border-b border-border text-text">{unidade.meses['08']?.toLocaleString('pt-BR') || '0'}</td>
                      <td className="px-3 py-2 text-center border-b border-border text-text">{unidade.meses['09']?.toLocaleString('pt-BR') || '0'}</td>
                      <td className="px-3 py-2 text-center border-b border-border text-text">{unidade.meses['10']?.toLocaleString('pt-BR') || '0'}</td>
                      <td className="px-3 py-2 text-center border-b border-border text-text">{unidade.meses['11']?.toLocaleString('pt-BR') || '0'}</td>
                      <td className="px-3 py-2 text-center border-b border-border text-text">{unidade.meses['12']?.toLocaleString('pt-BR') || '0'}</td>
                      <td className="px-3 py-2 text-center border-b border-border font-semibold text-text">{unidade.totalRealizada.toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                  {/* Linha TOTAL */}
                  <tr className="bg-emerald-50 dark:bg-emerald-900/20 font-semibold">
                    <td className="px-3 py-2 text-right border-t-2 border-emerald-600 text-text">TOTAL</td>
                    <td className="px-3 py-2 text-center border-t-2 border-emerald-600 text-text">
                      {unidadesData.reduce((acc, u) => acc + u.qtePrevista, 0).toLocaleString('pt-BR')}
                    </td>
                    {['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(mes => (
                      <td key={mes} className="px-3 py-2 text-center border-t-2 border-emerald-600 text-text">
                        {unidadesData.reduce((acc, u) => acc + (u.meses[mes] || 0), 0).toLocaleString('pt-BR')}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center border-t-2 border-emerald-600 text-text">
                      {unidadesData.reduce((acc, u) => acc + u.totalRealizada, 0).toLocaleString('pt-BR')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}

    {statusModal.open && statusModal.row && (
            <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center p-4 z-50" onClick={() => setStatusModal({ open: false })}>
              <div
                className="bg-white dark:bg-neutral-950 rounded-2xl w-full max-w-md shadow-xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
                  <div>
                    <div className="text-lg font-semibold">Situação do colaborador</div>
                    <div className="text-xs opacity-70 mt-1">
                      Ajuste a situação atual do colaborador para fins de meta e acompanhamento.
                    </div>
                  </div>
                </div>
                <div className="p-4 space-y-3 text-sm">
                  <div>
                    <div className="text-xs opacity-70">Colaborador</div>
                    <div className="font-medium">
                      {statusModal.row?.nome}
                    </div>
                    <div className="text-xs text-neutral-600 dark:text-neutral-400">
                      CPF: {maskCPF(statusModal.row?.id)}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5 text-text">Situação</label>
                    <select
                      value={statusModal.code || 'ATIVO'}
                      onChange={(e) =>
                        setStatusModal((prev) => ({
                          ...prev,
                          code: e.target.value as StatusCode,
                        }))
                      }
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                      aria-label="Situação do colaborador"
                    >
                      <option value="ATIVO">Ativo (conta na meta)</option>
                      <option value="FERIAS">Férias</option>
                      <option value="INSS">INSS</option>
                      <option value="LICENCA_MATERNIDADE">Licença maternidade</option>
                      <option value="DEMITIDO_2025_SEM_EPI">Demitido 2025 sem EPI (fora da meta)</option>
                      <option value="DEMITIDO_2026_SEM_EPI">Demitido 2026 sem EPI (fora da meta)</option>
                      <option value="EXCLUIDO_META">Excluído da meta (outros motivos)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5 text-text">Observação rápida (aparece no 🅘)</label>
                    <input
                      type="text"
                      maxLength={100}
                      value={statusModal.obs || ''}
                      onChange={(e) =>
                        setStatusModal((prev) => ({
                          ...prev,
                          obs: e.target.value,
                        }))
                      }
                      placeholder="Ex.: Férias jan/2025, INSS desde fev/2025, gestante, etc."
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                      aria-label="Observação sobre a situação do colaborador"
                    />
                    <div className="text-[10px] text-muted-foreground mt-1.5">
                      Status marcados como &quot;Demitido 2025/2026 sem EPI&quot; ou &quot;Excluído da meta&quot; ficarão com o botão de entrega desativado, não contarão na meta e podem ser ocultados usando o filtro acima. Para marcar como &quot;Demitido 2026 sem EPI&quot;, o colaborador não pode ter recebido EPI.
                    </div>
                  </div>
                </div>
                <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2">
                  <button 
                    className="px-4 py-2 rounded-xl border border-border bg-panel hover:bg-muted text-sm font-medium transition-colors" 
                    onClick={() => setStatusModal({ open: false })}
                    aria-label="Cancelar alteração de situação"
                  >
                    Cancelar
                  </button>
                  <button
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-sm font-semibold shadow-sm transition-colors"
                    onClick={() => {
                      saveStatusModal();
                    }}
                    aria-label="Salvar situação do colaborador"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          )}

    {modal.open && modal.row && (
            <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center p-4 z-50 overflow-y-auto" onClick={() => setModal({ open: false })}>
              <div className="bg-white dark:bg-neutral-950 rounded-2xl w-full max-w-3xl shadow-xl my-auto max-h-[90vh] overflow-hidden flex flex-col relative" onClick={e => e.stopPropagation()} style={{ isolation: 'isolate' }}>
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex-shrink-0">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="text-lg font-semibold">Entregas de EPI</div>
                      <div className="text-sm font-medium text-muted-foreground mt-0.5">{modal.row.nome}</div>
                      <div className="text-xs text-muted-foreground mt-1">CPF: {maskCPF(modal.row.id)}</div>
                    </div>
                    {kit.length > 0 && (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Kit de EPI</div>
                        <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          {kit.length} item{kit.length !== 1 ? 's' : ''}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {kit.filter(k => isEpiObrigatorio(k.item)).length} obrigatório{kit.filter(k => isEpiObrigatorio(k.item)).length !== 1 ? 's' : ''}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Informações adicionais em formato compacto */}
                  <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Função:</span>
                      <span className="ml-1 font-medium">{modal.row.funcao || '—'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Unidade:</span>
                      <span className="ml-1 font-medium">{modal.row.unidade || '—'}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Regional:</span>
                      <span className="ml-1 font-medium">{modal.row.regional || '—'}</span>
                    </div>
                  </div>
                  
                  {/* Se existir mais de 1 setor para a função, permite selecionar (kit muda automaticamente) */}
                  {kitSectors.length > 1 && (
                    <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-text">Setor</span>
                        <span className="text-[10px] text-muted-foreground">
                          Selecionado: {kitSector || '—'}
                        </span>
                      </div>
                      <select
                        value={kitSector}
                        onChange={async (e) => {
                          const nextSector = e.target.value;
                          setKitSector(nextSector);
                          setSelectedEpis({});

                          const params = new URLSearchParams();
                          params.set('funcao', modal.row?.funcao || '');
                          if (modal.row?.unidade) params.set('pcg', modal.row.unidade);
                          if (nextSector) params.set('unidade', nextSector);

                          const { json: kitJ } = await fetchJSON('/api/entregas/kit?' + params.toString(), {
                            cache: 'no-store',
                          });

                          const items: KitItem[] = (kitJ?.items || kitJ?.itens || []).map((r: any) => ({
                            item: r.item ?? r.epi ?? r.epi_item ?? '',
                            quantidade: Number(r.quantidade ?? 1) || 1,
                            nome_site: r.nome_site ?? null,
                          })).filter((x: any) => x.item);

                          setKit(items);
                        }}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-card text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                        aria-label="Selecionar setor"
                      >
                        {kitSectors.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                  {/* Barra de progresso de entregas */}
                  {kit.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">Progresso de entregas</span>
                        <span className="font-medium">
                          {deliv.reduce((acc, d) => acc + d.qty_delivered, 0)} / {kit.reduce((acc, k) => acc + k.quantidade, 0)} itens
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 transition-all"
                          style={{ 
                            width: `${Math.min(100, (deliv.reduce((acc, d) => acc + d.qty_delivered, 0) / kit.reduce((acc, k) => acc + k.quantidade, 0)) * 100) || 0}%` 
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="p-4 grid md:grid-cols-2 gap-4 overflow-y-auto flex-1 min-h-0">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="font-medium text-sm">Kit esperado</div>
                      <div className="text-xs text-muted-foreground">
                        {Object.keys(selectedEpis).length > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-medium">
                            {Object.keys(selectedEpis).length} selecionado{Object.keys(selectedEpis).length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Toggle para mostrar EPIs não-obrigatórios */}
                    {(() => {
                      const obrigatorios = kit.filter(k => isEpiObrigatorio(k.item));
                      const naoObrigatorios = kit.filter(k => !isEpiObrigatorio(k.item));
                      
                      if (naoObrigatorios.length > 0) {
                        return (
                          <div className="mb-3 flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                              {naoObrigatorios.length} EPI{naoObrigatorios.length !== 1 ? 's' : ''} não-obrigatório{naoObrigatorios.length !== 1 ? 's' : ''} oculto{naoObrigatorios.length !== 1 ? 's' : ''}
                            </div>
                            <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
                              <input
                                type="checkbox"
                                checked={mostrarNaoObrigatorios}
                                onChange={(e) => setMostrarNaoObrigatorios(e.target.checked)}
                                className="rounded border-border text-emerald-600 focus:ring-emerald-500"
                              />
                              <span className="text-muted-foreground">Mostrar EPIs não-obrigatórios</span>
                            </label>
                          </div>
                        );
                      }
                      return null;
                    })()}
                    
                    {/* Agrupar EPIs: Obrigatórios primeiro */}
                    {(() => {
                      const obrigatorios = kit.filter(k => isEpiObrigatorio(k.item));
                      const naoObrigatorios = kit.filter(k => !isEpiObrigatorio(k.item));
                      
                      return (
                        <div className="space-y-3 max-h-[450px] overflow-y-auto">
                          {obrigatorios.length > 0 && (
                            <div>
                              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-2 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5" />
                                EPIs Obrigatórios ({obrigatorios.length})
                              </div>
                              <div className="space-y-2">
                                {obrigatorios.map((k, i) => {
                                  const delivered = deliv.find(d => d.item.toLowerCase() === (k.item||'').toLowerCase());
                                  const isSelected = selectedEpis[k.item] !== undefined;
                                  const selectedData = selectedEpis[k.item] || { qtd: 1, data: new Date().toISOString().substring(0, 10) };
                                  
                                  return (
                                    <div key={`obr-${i}`} className={`border-2 rounded-xl p-3 transition-all ${isSelected ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400 dark:border-emerald-600 shadow-sm' : 'border-emerald-200 dark:border-emerald-800'}`}>
                                      <div className="flex items-start gap-2">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedEpis(prev => ({
                                                ...prev,
                                                [k.item]: { qtd: 1, data: new Date().toISOString().substring(0, 10) }
                                              }));
                                            } else {
                                              setSelectedEpis(prev => {
                                                const next = { ...prev };
                                                delete next[k.item];
                                                return next;
                                              });
                                            }
                                          }}
                                          className="mt-1 rounded border-neutral-300 dark:border-neutral-700 text-emerald-600 focus:ring-emerald-500"
                                          aria-label={`Selecionar ${k.item} para entrega`}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm flex items-center justify-between gap-2">
                                            <span className="font-medium truncate" title={k.item}>{k.item}</span>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 flex-shrink-0">
                                              OBRIGATÓRIO
                                            </span>
                                          </div>
                                          <div className="text-xs text-muted-foreground mt-0.5">
                                            Requerido: <strong>{k.quantidade}</strong> • Entregue: <strong>{delivered?.qty_delivered || 0}</strong>
                                          </div>
                                          {isSelected && (
                                            <div className="mt-2 flex gap-2">
                                              <input
                                                type="number"
                                                min={1}
                                                value={selectedData.qtd}
                                                onChange={(e) => {
                                                  const qtd = Math.max(1, Number(e.target.value) || 1);
                                                  setSelectedEpis(prev => ({
                                                    ...prev,
                                                    [k.item]: { ...prev[k.item], qtd }
                                                  }));
                                                }}
                                                className="w-20 px-2 py-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:ring-1 focus:ring-emerald-500"
                                                placeholder="Qtd"
                                                aria-label="Quantidade"
                                              />
                                              <input
                                                type="date"
                                                value={selectedData.data}
                                                onChange={(e) => {
                                                  setSelectedEpis(prev => ({
                                                    ...prev,
                                                    [k.item]: { ...prev[k.item], data: e.target.value }
                                                  }));
                                                }}
                                                className="flex-1 px-2 py-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:ring-1 focus:ring-emerald-500"
                                                aria-label="Data da entrega"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {naoObrigatorios.length > 0 && mostrarNaoObrigatorios && (
                            <div>
                              <div className="text-xs font-semibold text-muted-foreground mb-2">
                                Outros EPIs ({naoObrigatorios.length})
                              </div>
                              <div className="space-y-2">
                                {naoObrigatorios.map((k, i) => {
                                  const delivered = deliv.find(d => d.item.toLowerCase() === (k.item||'').toLowerCase());
                                  const isSelected = selectedEpis[k.item] !== undefined;
                                  const selectedData = selectedEpis[k.item] || { qtd: 1, data: new Date().toISOString().substring(0, 10) };
                                  
                                  return (
                                    <div key={`nao-${i}`} className={`border rounded-xl p-3 transition-all ${isSelected ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700' : 'border-border'}`}>
                                      <div className="flex items-start gap-2">
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setSelectedEpis(prev => ({
                                                ...prev,
                                                [k.item]: { qtd: 1, data: new Date().toISOString().substring(0, 10) }
                                              }));
                                            } else {
                                              setSelectedEpis(prev => {
                                                const next = { ...prev };
                                                delete next[k.item];
                                                return next;
                                              });
                                            }
                                          }}
                                          className="mt-1 rounded border-neutral-300 dark:border-neutral-700"
                                          aria-label={`Selecionar ${k.item} para entrega`}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="text-sm flex items-center justify-between gap-2">
                                            <span className="font-medium truncate" title={k.item}>{k.item}</span>
                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 text-neutral-600 dark:bg-neutral-900/60 dark:text-neutral-300 flex-shrink-0">
                                              NÃO OBRIGATÓRIO
                                            </span>
                                          </div>
                                          <div className="text-xs text-muted-foreground mt-0.5">
                                            Requerido: <strong>{k.quantidade}</strong> • Entregue: <strong>{delivered?.qty_delivered || 0}</strong>
                                          </div>
                                          {isSelected && (
                                            <div className="mt-2 flex gap-2">
                                              <input
                                                type="number"
                                                min={1}
                                                value={selectedData.qtd}
                                                onChange={(e) => {
                                                  const qtd = Math.max(1, Number(e.target.value) || 1);
                                                  setSelectedEpis(prev => ({
                                                    ...prev,
                                                    [k.item]: { ...prev[k.item], qtd }
                                                  }));
                                                }}
                                                className="w-20 px-2 py-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:ring-1 focus:ring-emerald-500"
                                                placeholder="Qtd"
                                                aria-label="Quantidade"
                                              />
                                              <input
                                                type="date"
                                                value={selectedData.data}
                                                onChange={(e) => {
                                                  setSelectedEpis(prev => ({
                                                    ...prev,
                                                    [k.item]: { ...prev[k.item], data: e.target.value }
                                                  }));
                                                }}
                                                className="flex-1 px-2 py-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:ring-1 focus:ring-emerald-500"
                                                aria-label="Data da entrega"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {kit.length === 0 && (
                            <div className="text-sm text-muted-foreground text-center py-8">
                              Nenhum mapeamento de kit para esta função.
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="overflow-hidden flex flex-col min-h-0">
                    <div className="font-medium text-sm mb-3">Registrar entrega</div>
                    
                    {/* Resumo da seleção */}
                    {Object.keys(selectedEpis).length > 0 && (
                      <div className="mb-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                        <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
                          {Object.keys(selectedEpis).length} EPI{Object.keys(selectedEpis).length !== 1 ? 's' : ''} selecionado{Object.keys(selectedEpis).length !== 1 ? 's' : ''}
                        </div>
                        <div className="text-xs text-emerald-600 dark:text-emerald-400">
                          Total: {Object.values(selectedEpis).reduce((acc, s) => acc + s.qtd, 0)} unidade{Object.values(selectedEpis).reduce((acc, s) => acc + s.qtd, 0) !== 1 ? 's' : ''}
                        </div>
                      </div>
                    )}
                    
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={doDeliver} 
                        disabled={Object.keys(selectedEpis).length === 0}
                        className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 disabled:bg-neutral-300 dark:disabled:bg-neutral-700 disabled:text-neutral-500 disabled:cursor-not-allowed font-semibold text-sm shadow-sm transition-all"
                        aria-label={Object.keys(selectedEpis).length > 0 ? `Registrar entrega de ${Object.keys(selectedEpis).length} EPI(s)` : 'Selecione pelo menos um EPI para continuar'}
                      >
                        <Package className="w-4 h-4" />
                        {Object.keys(selectedEpis).length > 0 
                          ? `Registrar ${Object.keys(selectedEpis).length} EPI${Object.keys(selectedEpis).length !== 1 ? 's' : ''}` 
                          : 'Selecione pelo menos um EPI'}
                      </button>
                      <div className="text-xs text-muted-foreground">
                        {Object.keys(selectedEpis).length > 0 
                          ? 'Clique no botão acima para registrar a entrega de todos os EPIs selecionados.'
                          : 'Marque os checkboxes dos EPIs na lista ao lado para fazer a entrega.'}
                      </div>
                    </div>

                    <div className="mt-4 overflow-y-auto flex-1 min-h-0">
                      <div className="mb-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                        <p className="text-[11px] text-blue-700 dark:text-blue-300">
                          <strong>Importante:</strong> Somente EPIs marcados como <strong>OBRIGATÓRIO</strong> contam para a meta do SESMT.
                        </p>
                      </div>
                      
                      <div className="font-medium text-sm mb-2">Histórico de entregas</div>
                      <div className="space-y-2">
                        {deliv.map((d, i) => {
                          const kitItem = kit.find(k => k.item.toLowerCase() === d.item.toLowerCase());
                          const obrigatorio = kitItem ? isEpiObrigatorio(kitItem.item) : false;
                          const percentual = kitItem && kitItem.quantidade > 0 
                            ? Math.min(100, (d.qty_delivered / kitItem.quantidade) * 100) 
                            : 0;
                          
                          return (
                            <div key={i} className="border rounded-xl p-3 bg-card">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate" title={d.item}>{d.item}</div>
                                  <div className="text-xs text-muted-foreground mt-0.5">
                                    {d.qty_delivered} de {d.qty_required} entregue{d.qty_delivered !== 1 ? 's' : ''}
                                  </div>
                                </div>
                                {obrigatorio && (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 flex-shrink-0">
                                    OBRIGATÓRIO
                                  </span>
                                )}
                              </div>
                              
                              {kitItem && (
                                <div className="mb-2">
                                  <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-800 overflow-hidden">
                                    <div 
                                      className={`h-full transition-all ${percentual >= 100 ? 'bg-emerald-500' : percentual >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                                      style={{ width: `${percentual}%` }}
                                    />
                                  </div>
                                  <div className="text-[10px] text-muted-foreground mt-1">
                                    {percentual.toFixed(0)}% do requerido
                                  </div>
                                </div>
                              )}
                              
                              {Array.isArray(d.deliveries) && d.deliveries.length > 0 && (
                                <div className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">
                                  <div className="flex items-center justify-between gap-2 mb-1">
                                    <div className="font-medium">Lançamentos:</div>
                                    <button
                                      onClick={() => {
                                        if (!modal.row) return;
                                        const safe = (Array.isArray(d.deliveries) ? d.deliveries : []).map((x: any) => ({
                                          date: String(x?.date || '').substring(0, 10),
                                          qty: Number(x?.qty ?? 0) || 0,
                                        }));
                                        setEditLaunch({
                                          open: true,
                                          cpf: modal.row.id,
                                          item: d.item,
                                          qty_required: d.qty_required || 1,
                                          deliveries: safe,
                                        });
                                      }}
                                      className="rounded-md border border-border bg-panel px-2 py-1 text-[10px] font-medium hover:bg-muted text-text"
                                      aria-label={`Editar lançamentos de ${d.item}`}
                                      title="Editar lançamentos"
                                    >
                                      Editar
                                    </button>
                                  </div>
                                  <div className="space-y-0.5">
                                    {d.deliveries.map((x: any, idx: number) => {
                                      const rawDate = String(x?.date || '').substring(0, 10);
                                      const [yy, mm, dd] = rawDate.split('-');
                                      const dateLabel = (dd && mm && yy) ? `${dd}/${mm}/${yy}` : rawDate || '-';
                                      return (
                                      <div key={idx} className="flex items-start justify-between gap-2 text-xs">
                                        <div className="min-w-0">
                                          <span className="font-medium">{dateLabel}</span>
                                          <span className="ml-1 font-medium">{x.qty} unidade{x.qty !== 1 ? 's' : ''}</span>
                                          {(x.entregue_por || x.entregue_em) && (
                                            <div className="text-[10px] text-muted-foreground mt-0.5">
                                              {x.entregue_por && <span title="Quem deu baixa">{x.entregue_por}</span>}
                                              {x.entregue_em && (
                                                <span className="ml-1" title="Data e hora do lançamento">
                                                  {new Date(x.entregue_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                        {deliv.length === 0 && (
                          <div className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-xl">
                            Nenhuma entrega registrada ainda.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2 flex-shrink-0">
                  <button 
                    className="px-4 py-2 rounded-xl border border-border bg-panel hover:bg-muted text-sm font-medium transition-colors" 
                    onClick={() => {
                      setModal({ open: false });
                      setSelectedEpis({});
                    }}
                    aria-label="Fechar modal de entregas"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            </div>
          )}

          {modalNew && (
            <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center p-4 z-50" onClick={()=>setModalNew(false)}>
              <div className="bg-white dark:bg-neutral-950 rounded-2xl w-full max-w-2xl shadow-xl" onClick={e=>e.stopPropagation()}>
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
                  <div className="text-lg font-semibold">Cadastrar colaborador</div>
                  <div className="text-xs opacity-70">Use este cadastro quando o Alterdata ainda não refletiu a admissão.</div>
                </div>
                <div className="p-4 grid md:grid-cols-2 gap-3">
                  
<div className="md:col-span-2">
  <label className="text-xs font-medium block mb-1.5 text-text">CPF *</label>
  <input
    value={newColab.cpf}
    onChange={e => {
      const value = e.target.value.replace(/\D/g, '');
      const formatted = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      setNewColab({ ...newColab, cpf: formatted });
    }}
    onBlur={e => checkManualCpf(e.target.value)}
    className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
    placeholder="000.000.000-00"
    maxLength={14}
    aria-label="CPF do colaborador"
    aria-required="true"
  />
  <div className="mt-1.5 text-[11px] min-h-[1.25rem]">
    {cpfCheck.loading && (
      <span className="inline-flex items-center gap-1.5 text-muted">
        <div className="w-3 h-3 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        Verificando CPF na base...
      </span>
    )}
    {!cpfCheck.loading && cpfCheck.exists === true && (
      <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
        Este CPF já possui cadastro ({cpfCheck.source || 'base oficial/manual'}). Verifique antes de criar um novo registro.
      </span>
    )}
    {!cpfCheck.loading && cpfCheck.exists === false && (
      <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
        CPF não encontrado na base. Pode prosseguir com o cadastro manual.
      </span>
    )}
  </div>
</div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5 text-text">Matrícula</label>
                    <input 
                      value={newColab.matricula||''} 
                      onChange={e=>setNewColab({...newColab, matricula: e.target.value})} 
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" 
                      placeholder="(opcional)"
                      aria-label="Matrícula do colaborador"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium block mb-1.5 text-text">Nome *</label>
                    <input 
                      value={newColab.nome} 
                      onChange={e=>setNewColab({...newColab, nome: e.target.value})} 
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                      placeholder="Nome completo do colaborador"
                      aria-label="Nome do colaborador"
                      aria-required="true"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5 text-text">Função *</label>
                    <input 
                      value={newColab.funcao} 
                      onChange={e=>setNewColab({...newColab, funcao: e.target.value})} 
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all" 
                      placeholder="Ex.: Enfermeiro UTI"
                      aria-label="Função do colaborador"
                      aria-required="true"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5 text-text">Regional *</label>
                    <select 
                      value={newColab.regional} 
                      onChange={e=>setNewColab({...newColab, regional: e.target.value})} 
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                      aria-label="Regional do colaborador"
                      aria-required="true"
                    >
                      <option value="">Selecione…</option>
                      {regionais.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs font-medium block mb-1.5 text-text">Unidade *</label>
                    <select 
                      value={newColab.unidade} 
                      onChange={e=>setNewColab({...newColab, unidade: e.target.value})} 
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                      disabled={!newColab.regional}
                      aria-label="Unidade do colaborador"
                      aria-required="true"
                    >
                      <option value="">{newColab.regional ? 'Selecione…' : 'Selecione a Regional primeiro'}</option>
                      {unidades.filter(u => !newColab.regional || u.regional === newColab.regional).map(u => <option key={u.unidade} value={u.unidade}>{u.unidade}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5 text-text">Admissão</label>
                    <input 
                      type="date" 
                      value={newColab.admissao||''} 
                      onChange={e=>setNewColab({...newColab, admissao: e.target.value})} 
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                      aria-label="Data de admissão"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium block mb-1.5 text-text">Demissão</label>
                    <input 
                      type="date" 
                      value={newColab.demissao||''} 
                      onChange={e=>setNewColab({...newColab, demissao: e.target.value})} 
                      className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                      aria-label="Data de demissão"
                    />
                  </div>
                </div>
                <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2">
                  <button 
                    className="px-4 py-2 rounded-xl border border-border bg-panel hover:bg-muted text-sm font-medium transition-colors" 
                    onClick={()=>setModalNew(false)}
                    aria-label="Cancelar cadastro"
                  >
                    Cancelar
                  </button>
                  <button 
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-400 text-sm font-semibold shadow-sm transition-colors" 
                    onClick={saveNewManual}
                    aria-label="Salvar novo colaborador"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          )}

          {editLaunch.open && (
            <div className="fixed inset-0 bg-black/40 flex items-end md:items-center justify-center p-4 z-[60]" onClick={() => setEditLaunch({ open: false })}>
              <div className="bg-white dark:bg-neutral-950 rounded-2xl w-full max-w-xl shadow-xl" onClick={(e)=>e.stopPropagation()}>
                <div className="p-4 border-b border-neutral-200 dark:border-neutral-800">
                  <div className="text-lg font-semibold">Editar lançamentos</div>
                  <div className="text-xs opacity-70">{editLaunch.item}</div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-medium text-text">Lançamentos (somente 2026+)</div>
                    <button
                      onClick={() => {
                        const next = Array.isArray(editLaunch.deliveries) ? [...editLaunch.deliveries] : [];
                        next.push({ date: new Date().toISOString().substring(0, 10), qty: 1 });
                        setEditLaunch((p) => ({ ...p, deliveries: next }));
                      }}
                      className="rounded-md border border-border bg-panel px-2 py-1 text-xs font-medium hover:bg-muted text-text"
                    >
                      Adicionar
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(editLaunch.deliveries || []).map((x, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="date"
                          value={x.date}
                          onChange={(e) => {
                            const next = [...(editLaunch.deliveries || [])];
                            next[idx] = { ...next[idx], date: e.target.value };
                            setEditLaunch((p) => ({ ...p, deliveries: next }));
                          }}
                          className="flex-1 px-2 py-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                        />
                        <input
                          type="number"
                          min={1}
                          value={x.qty}
                          onChange={(e) => {
                            const q = Math.max(1, Number(e.target.value) || 1);
                            const next = [...(editLaunch.deliveries || [])];
                            next[idx] = { ...next[idx], qty: q };
                            setEditLaunch((p) => ({ ...p, deliveries: next }));
                          }}
                          className="w-20 px-2 py-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                        />
                        <button
                          onClick={() => {
                            const next = [...(editLaunch.deliveries || [])];
                            next.splice(idx, 1);
                            setEditLaunch((p) => ({ ...p, deliveries: next }));
                          }}
                          className="rounded-md border border-red-900 bg-red-900/10 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-900/20"
                          aria-label="Remover lançamento"
                          title="Remover"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                    {(!editLaunch.deliveries || editLaunch.deliveries.length === 0) && (
                      <div className="text-xs text-muted-foreground">Nenhum lançamento.</div>
                    )}
                  </div>
                </div>
                <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end gap-2">
                  <button
                    className="px-4 py-2 rounded-xl border border-border bg-panel hover:bg-muted text-sm font-medium transition-colors"
                    onClick={() => setEditLaunch({ open: false })}
                  >
                    Cancelar
                  </button>
                  <button
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 text-sm font-semibold transition-colors"
                    onClick={saveEditLaunch}
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          )}
    </div>
  );
}
