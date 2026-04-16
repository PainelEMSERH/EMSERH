'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  Filter,
  Pencil,
  RefreshCw,
  Search,
  Paperclip,
  CheckCircle2,
  XCircle,
  Info,
  ExternalLink,
  Columns2,
  FileText,
  Link2,
} from 'lucide-react';

type Row = {
  id: string;
  item: string | null;
  empresa: string | null;
  unidade: string | null;
  diretoria: string | null;
  gerencia: string | null;
  cod_origem: string | null;
  data_origem: string | null;
  origem: string | null;
  indicador: string | null;
  auxiliar: string | null;
  acao: string | null;
  regional: string | null;
  responsavel: string | null;
  prazo: string | null;
  conclusao: string | null;
  novo_prazo: string | null;
  status: string | null;
  evidencia: string | null;
  comentarios: string | null;
  evidencia_arquivo_nome: string | null;
  evidencia_storage_path: string | null;
};

type ColId =
  | 'item'
  | 'empresa'
  | 'unidade'
  | 'diretoria'
  | 'gerencia'
  | 'cod_origem'
  | 'data_origem'
  | 'origem'
  | 'indicador'
  | 'auxiliar'
  | 'acao'
  | 'regional'
  | 'responsavel'
  | 'prazo'
  | 'conclusao'
  | 'novo_prazo'
  | 'status'
  | 'evidencia'
  | 'comentarios';

/** v3: também oculta Gerência por padrão */
const COLS_LS = 'emserh-gst-acoes-cols-v3';
const HIDDEN_BY_DEFAULT: ColId[] = ['empresa', 'cod_origem', 'diretoria', 'gerencia', 'auxiliar'];

const COL_DEFS: { id: ColId; label: string; className?: string }[] = [
  { id: 'item', label: 'Item', className: 'max-w-[120px]' },
  { id: 'empresa', label: 'Empresa', className: 'max-w-[120px]' },
  { id: 'unidade', label: 'Unidade', className: 'min-w-[300px] max-w-[460px]' },
  { id: 'diretoria', label: 'Diretoria', className: 'max-w-[120px]' },
  { id: 'gerencia', label: 'Gerência', className: 'max-w-[120px]' },
  { id: 'cod_origem', label: 'Cod. origem', className: 'max-w-[90px]' },
  { id: 'data_origem', label: 'Data origem', className: 'whitespace-nowrap' },
  { id: 'origem', label: 'Origem', className: 'max-w-[100px]' },
  { id: 'indicador', label: 'Indicador', className: 'min-w-[160px] max-w-[280px]' },
  { id: 'auxiliar', label: 'Auxiliar', className: 'max-w-[120px]' },
  { id: 'acao', label: 'Ação', className: 'min-w-[260px] max-w-[420px]' },
  { id: 'regional', label: 'Regional', className: 'max-w-[140px]' },
  { id: 'responsavel', label: 'Responsável', className: 'max-w-[140px]' },
  { id: 'prazo', label: 'Prazo', className: 'whitespace-nowrap' },
  { id: 'conclusao', label: 'Conclusão', className: 'whitespace-nowrap' },
  { id: 'novo_prazo', label: 'Novo prazo', className: 'whitespace-nowrap' },
  { id: 'status', label: 'Status', className: 'max-w-[160px]' },
  { id: 'evidencia', label: 'Evidência', className: 'max-w-[160px]' },
  { id: 'comentarios', label: 'Comentários', className: 'min-w-[180px] max-w-[280px]' },
];

/** Colunas que ficam em uma linha (datas). As outras quebram linha para não cortar texto. */
const SINGLE_LINE_COLS: ColId[] = ['prazo', 'conclusao', 'novo_prazo', 'data_origem'];

function defaultColVisibility(): Record<ColId, boolean> {
  const v = {} as Record<ColId, boolean>;
  for (const c of COL_DEFS) {
    v[c.id] = !HIDDEN_BY_DEFAULT.includes(c.id);
  }
  return v;
}

function loadColVisibility(): Record<ColId, boolean> {
  const base = defaultColVisibility();
  if (typeof window === 'undefined') return base;
  try {
    const raw = localStorage.getItem(COLS_LS);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<Record<ColId, boolean>>;
    const merged = { ...base, ...parsed };
    for (const c of COL_DEFS) {
      if (merged[c.id] === undefined) merged[c.id] = base[c.id];
    }
    return merged;
  } catch {
    return base;
  }
}

type StatsCards = {
  total: { label: string; count: number; pct: number };
  no_prazo: { label: string; count: number; pct: number };
  em_atraso: { label: string; count: number; pct: number };
  concluido: { label: string; count: number; pct: number };
  atraso_reprogramado: { label: string; count: number; pct: number };
  cancelado: { label: string; count: number; pct: number };
};

const STATUS_OPTIONS = [
  'No prazo',
  'Em atraso',
  'Concluído',
  'Em atraso Reprogramado',
  'Cancelado',
] as const;

type Toast = { id: string; message: string; type: 'success' | 'error' | 'info' };

function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  return (
    <div className="fixed top-20 right-4 z-[60] flex flex-col gap-2" role="region" aria-label="Notificações">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex min-w-[280px] max-w-md items-center gap-3 rounded-xl border px-4 py-3 shadow-lg ${
            t.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100'
              : t.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/30 dark:text-red-100'
                : 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-100'
          }`}
        >
          {t.type === 'success' && <CheckCircle2 className="h-5 w-5 shrink-0" />}
          {t.type === 'error' && <XCircle className="h-5 w-5 shrink-0" />}
          {t.type === 'info' && <Info className="h-5 w-5 shrink-0" />}
          <span className="flex-1 text-sm font-medium">{t.message}</span>
          <button type="button" onClick={() => removeToast(t.id)} className="opacity-70 hover:opacity-100" aria-label="Fechar">
            <XCircle className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—';
  const t = String(s).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [y, m, d] = t.split('-');
    return `${d}/${m}/${y}`;
  }
  return s;
}

function cellText(r: Row, col: ColId): string {
  const v = r[col];
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function statusBadgeClass(statusRaw: string): string {
  const s = statusRaw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (s.includes('cancel')) {
    return 'bg-violet-100 text-violet-900 ring-1 ring-violet-200/80 dark:bg-violet-950/55 dark:text-violet-100 dark:ring-violet-800/60';
  }
  if (s.includes('conclu') || s.includes('finaliz')) {
    return 'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80 dark:bg-emerald-950/55 dark:text-emerald-50 dark:ring-emerald-800/60';
  }
  if (s.includes('reprogram')) {
    return 'bg-zinc-200 text-zinc-900 ring-1 ring-zinc-300/80 dark:bg-zinc-800/70 dark:text-zinc-100 dark:ring-zinc-600/50';
  }
  if (s.includes('atraso')) {
    return 'bg-red-100 text-red-900 ring-1 ring-red-200/80 dark:bg-red-950/50 dark:text-red-100 dark:ring-red-800/50';
  }
  if (s.includes('prazo') || s.includes('em dia') || s.includes('andamento')) {
    return 'bg-amber-100 text-amber-950 ring-1 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800/40';
  }
  return 'bg-muted/70 text-text ring-1 ring-border dark:bg-muted/30';
}

function evidenceHref(r: Row): string | null {
  if (r.evidencia_storage_path) {
    const p = String(r.evidencia_storage_path).replace(/^\/+/, '');
    return `/${p}`;
  }
  const ev = cellText(r, 'evidencia');
  if (ev && /^https?:\/\//i.test(ev)) return ev;
  if (ev && ev.startsWith('/')) return ev;
  return null;
}

/** No modal: inclui o que o usuário digitou no campo e ainda não salvou. */
function evidenceUrlForModal(row: Row, formEvidenciaDraft: string): string | null {
  const h = evidenceHref(row);
  if (h) return h;
  const t = formEvidenciaDraft.trim();
  if (/^https?:\/\//i.test(t)) return t;
  if (t.startsWith('/')) return t;
  return null;
}

function renderCell(r: Row, col: ColId): React.ReactNode {
  const t = cellText(r, col);
  if (col === 'evidencia') {
    const href = evidenceHref(r);
    const label =
      r.evidencia_arquivo_nome?.trim() ||
      (t && !t.startsWith('/') && !/^https?:\/\//i.test(t) ? t : '') ||
      (href ? 'Abrir evidência' : '');
    if (href) {
      const isPdf = /\.pdf$/i.test(href) || /\.pdf$/i.test(label);
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center gap-1 text-[10px] font-medium text-emerald-600 hover:text-emerald-700 hover:underline dark:text-emerald-400 dark:hover:text-emerald-300"
          title={label || href}
        >
          {isPdf ? <FileText className="h-3 w-3 shrink-0 opacity-80" aria-hidden /> : <Link2 className="h-3 w-3 shrink-0 opacity-80" aria-hidden />}
          <span className="truncate">{label || 'Abrir'}</span>
          <ExternalLink className="h-2.5 w-2.5 shrink-0 opacity-60" aria-hidden />
        </a>
      );
    }
    if (t && !/^https?:\/\//i.test(t) && t.length > 0) {
      return <span className="line-clamp-2 text-center text-[10px]">{t}</span>;
    }
    return '—';
  }
  if (!t) return '—';
  if (col === 'prazo' || col === 'conclusao' || col === 'novo_prazo' || col === 'data_origem') {
    return <span className="tabular-nums">{fmtDate(t)}</span>;
  }
  if (col === 'status') {
    return (
      <span className={`inline-flex max-w-full rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadgeClass(t)}`}>{t}</span>
    );
  }
  return t;
}

function fmtPct(n: number) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Barra horizontal no topo sincronizada com a de baixo — evita rolar a página inteira
 * só para alcançar o scroll da tabela.
 */
function TableHorizontalScroll({
  children,
  depsKey,
}: {
  children: React.ReactNode;
  depsKey: string;
}) {
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
      <p className="sr-only" id="gst-table-hscroll-hint">
        A tabela é larga: use a barra de rolagem logo acima ou abaixo dela para ver todas as colunas.
      </p>
      <div
        ref={bottomRef}
        className="overflow-x-auto"
        onScroll={onBottomScroll}
        aria-describedby={showTopBar ? 'gst-table-hscroll-hint' : undefined}
      >
        {children}
      </div>
    </div>
  );
}

const CARD_STYLES: Record<keyof StatsCards, { bg: string; text: string; ring: string }> = {
  total: {
    bg: 'bg-sky-100 dark:bg-sky-950/50',
    text: 'text-sky-950 dark:text-sky-100',
    ring: 'ring-sky-300/60 dark:ring-sky-700/50',
  },
  no_prazo: {
    bg: 'bg-amber-100 dark:bg-amber-950/40',
    text: 'text-amber-950 dark:text-amber-100',
    ring: 'ring-amber-300/60 dark:ring-amber-800/40',
  },
  em_atraso: {
    bg: 'bg-red-100 dark:bg-red-950/40',
    text: 'text-red-950 dark:text-red-100',
    ring: 'ring-red-300/60 dark:ring-red-800/40',
  },
  concluido: {
    bg: 'bg-emerald-200 dark:bg-emerald-950/50',
    text: 'text-emerald-950 dark:text-emerald-50',
    ring: 'ring-emerald-400/60 dark:ring-emerald-800/40',
  },
  atraso_reprogramado: {
    bg: 'bg-zinc-200 dark:bg-zinc-800/60',
    text: 'text-zinc-900 dark:text-zinc-100',
    ring: 'ring-zinc-400/50 dark:ring-zinc-600/50',
  },
  cancelado: {
    bg: 'bg-violet-200 dark:bg-violet-950/50',
    text: 'text-violet-950 dark:text-violet-50',
    ring: 'ring-violet-400/60 dark:ring-violet-800/40',
  },
};

export default function CentralAcoesGSTClient() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const pushToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  }, []);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatsCards | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [regionais, setRegionais] = useState<string[]>([]);
  const [regional, setRegional] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [q, setQ] = useState('');

  const [modal, setModal] = useState<Row | null>(null);
  const [formStatus, setFormStatus] = useState('');
  const [formComentarios, setFormComentarios] = useState('');
  const [formEvidencia, setFormEvidencia] = useState('');
  const [formNovoPrazo, setFormNovoPrazo] = useState('');
  const [formConclusao, setFormConclusao] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [colVis, setColVis] = useState<Record<ColId, boolean>>(() => defaultColVisibility());
  const [colPickerOpen, setColPickerOpen] = useState(false);

  useEffect(() => {
    setColVis(loadColVisibility());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(COLS_LS, JSON.stringify(colVis));
    } catch {
      /* ignore */
    }
  }, [colVis]);

  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      qs.set('page', String(page));
      qs.set('pageSize', String(pageSize));
      if (regional) qs.set('regional', regional);
      if (statusFiltro) qs.set('status', statusFiltro);
      if (q.trim()) qs.set('q', q.trim());

      const [sRes, lRes] = await Promise.all([
        fetch('/api/plano-acao-indicadores/stats', { cache: 'no-store' }),
        fetch(`/api/plano-acao-indicadores/list?${qs}`, { cache: 'no-store' }),
      ]);
      const sJson = await sRes.json();
      const lJson = await lRes.json();
      if (!sRes.ok) throw new Error(sJson?.error || 'Indicadores indisponíveis');
      if (!lRes.ok) throw new Error(lJson?.error || 'Lista indisponível');
      setStats(sJson.cards || null);
      setRows(lJson.rows || []);
      setTotal(Number(lJson.total || 0));
      setRegionais(Array.isArray(lJson.regionais) ? lJson.regionais : []);
    } catch (e: any) {
      pushToast(e?.message || 'Erro ao carregar', 'error');
      setStats(null);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, regional, statusFiltro, q, pushToast]);

  useEffect(() => {
    load();
  }, [load]);

  const openModal = (r: Row) => {
    setModal(r);
    setFormStatus(r.status || '');
    setFormComentarios(r.comentarios || '');
    setFormEvidencia(r.evidencia || '');
    setFormNovoPrazo(r.novo_prazo ? String(r.novo_prazo).slice(0, 10) : '');
    setFormConclusao(r.conclusao ? String(r.conclusao).slice(0, 10) : '');
  };

  const closeModal = () => {
    setModal(null);
    setSaving(false);
    setUploading(false);
  };

  const savePatch = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        comentarios: formComentarios,
        evidencia: formEvidencia,
        novo_prazo: formNovoPrazo || null,
        conclusao: formConclusao || null,
      };
      if (formStatus.trim()) body.status = formStatus;
      const r = await fetch(`/api/plano-acao-indicadores/${encodeURIComponent(modal.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j?.error || 'Falha ao salvar');
      pushToast('Registro atualizado.', 'success');
      closeModal();
      await load();
    } catch (e: any) {
      pushToast(e?.message || 'Erro ao salvar', 'error');
    } finally {
      setSaving(false);
    }
  };

  const darBaixa = async () => {
    if (!modal) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/plano-acao-indicadores/${encodeURIComponent(modal.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dar_baixa: true,
          comentarios: formComentarios,
          evidencia: formEvidencia,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j?.error || 'Falha ao dar baixa');
      pushToast('Ação concluída (status Concluído + data de hoje).', 'success');
      closeModal();
      await load();
    } catch (e: any) {
      pushToast(e?.message || 'Erro', 'error');
    } finally {
      setSaving(false);
    }
  };

  const onUploadAnexo = async (file: File | null) => {
    if (!modal || !file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await fetch(`/api/plano-acao-indicadores/${encodeURIComponent(modal.id)}/anexo`, {
        method: 'POST',
        body: fd,
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j?.error || 'Falha no upload');
      const url = typeof j.url === 'string' ? j.url : '';
      pushToast('Evidência salva. Clique no link para abrir no navegador.', 'success');
      setFormEvidencia(url);
      setModal((m) =>
        m && m.id === modal.id
          ? {
              ...m,
              evidencia_arquivo_nome: j.evidencia_arquivo_nome ?? m.evidencia_arquivo_nome,
              evidencia_storage_path: j.evidencia_storage_path ?? m.evidencia_storage_path,
              evidencia: url || m.evidencia,
            }
          : m,
      );
      await load();
    } catch (e: any) {
      pushToast(e?.message || 'Erro no anexo', 'error');
    } finally {
      setUploading(false);
    }
  };

  const cardOrder = useMemo(
    () => ['total', 'no_prazo', 'em_atraso', 'concluido', 'atraso_reprogramado', 'cancelado'] as const,
    [],
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const tableScrollDeps = useMemo(
    () => `${loading}-${rows.length}-${JSON.stringify(colVis)}`,
    [loading, rows.length, colVis],
  );

  return (
    <div className="space-y-6 pb-10">
      <ToastContainer toasts={toasts} removeToast={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">GST · Gestão</p>
          <h1 className="mt-1 flex items-center gap-2 text-xl font-semibold text-text md:text-2xl">
            <ClipboardList className="h-7 w-7 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
            Central de Ações GST
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-muted">
            Ações da tabela <code className="rounded bg-muted px-1 text-xs">plano_acao_indicadores</code> (importação em Admin →
            Importar bases). Indicadores por status, filtros, edição, baixa e anexo de evidência.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/importar-bases"
            className="inline-flex items-center gap-1 rounded-xl border border-border bg-panel px-3 py-2 text-xs font-medium text-text hover:bg-bg"
          >
            Importar planilha
            <ExternalLink className="h-3.5 w-3.5 opacity-70" />
          </Link>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-panel px-3 py-2 text-xs font-medium hover:bg-bg disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {cardOrder.map((key) => {
            const c = stats[key];
            const st = CARD_STYLES[key];
            return (
              <div
                key={key}
                className={`overflow-hidden rounded-2xl border border-border shadow-sm ring-1 ${st.ring} ${st.bg}`}
              >
                <div className={`px-3 py-3 text-center ${st.text}`}>
                  <p className="text-lg font-bold tabular-nums md:text-xl">{fmtPct(c.pct)}%</p>
                  <p className="mt-1 text-[11px] font-bold leading-tight md:text-xs">{c.label}</p>
                </div>
                <div className="border-t border-black/5 bg-panel/90 px-3 py-2 text-center dark:border-white/10">
                  <p className="text-base font-bold tabular-nums text-text">{c.count.toLocaleString('pt-BR')}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-border bg-panel p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <Filter className="h-4 w-4" />
          Filtros
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text">Regional</label>
            <select
              value={regional}
              onChange={(e) => {
                setRegional(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
            >
              <option value="">Todas</option>
              {regionais.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text">Status</label>
            <select
              value={statusFiltro}
              onChange={(e) => {
                setStatusFiltro(e.target.value);
                setPage(1);
              }}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
            >
              <option value="">Todos</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-medium text-text">Busca livre</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Item, ação, indicador, responsável, comentários…"
                className="w-full rounded-xl border border-border bg-card py-2.5 pl-9 pr-3 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-panel">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-bg/50 px-4 py-3">
          <span className="text-sm font-semibold text-text">Linhas ({total.toLocaleString('pt-BR')})</span>
          <div className="relative">
            <button
              type="button"
              onClick={() => setColPickerOpen((o) => !o)}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-text hover:bg-bg"
            >
              <Columns2 className="h-4 w-4" aria-hidden />
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
                <div className="absolute right-0 z-40 mt-1 max-h-72 w-56 overflow-y-auto rounded-xl border border-border bg-panel py-2 shadow-lg">
                  <p className="border-b border-border px-3 pb-2 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Marque para exibir
                  </p>
                  {COL_DEFS.map((c) => (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/30"
                    >
                      <input
                        type="checkbox"
                        checked={colVis[c.id] !== false}
                        onChange={() =>
                          setColVis((v) => ({
                            ...v,
                            [c.id]: !(v[c.id] !== false),
                          }))
                        }
                      />
                      {c.label}
                    </label>
                  ))}
                  <div className="flex flex-col gap-1 border-t border-border px-3 pt-2">
                    <button
                      type="button"
                      className="text-left text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                      onClick={() => setColVis(defaultColVisibility())}
                    >
                      Layout padrão (oculta Empresa, Cod. origem, Diretoria, Gerência, Auxiliar)
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
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted">
              <RefreshCw className="h-5 w-5 animate-spin" />
              Carregando…
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-muted">
              Nenhum registro. Importe a planilha em Admin → Importar bases → Plano de ação / Indicadores.
            </div>
          ) : (
            <table className="w-full min-w-[720px] text-center text-[10px]">
              <thead className="border-b border-border bg-muted/30 text-[10px] font-semibold uppercase tracking-wide text-muted">
                <tr>
                  {COL_DEFS.filter((c) => colVis[c.id] !== false).map((c) => (
                    <th key={c.id} className={`px-3 py-3 text-center ${c.className || ''}`}>
                      {c.label}
                    </th>
                  ))}
                  <th className="w-28 px-3 py-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20">
                    {COL_DEFS.filter((c) => colVis[c.id] !== false).map((c) => {
                      const singleLine = SINGLE_LINE_COLS.includes(c.id);
                      return (
                        <td
                          key={c.id}
                          className={`px-3 text-center align-middle ${
                            singleLine
                              ? 'truncate py-3'
                              : 'py-3.5 whitespace-normal break-words leading-relaxed [word-break:break-word]'
                          } ${
                            c.id === 'item'
                              ? 'font-medium text-text'
                              : c.id === 'status' || c.id === 'evidencia'
                                ? 'text-text'
                                : 'text-muted'
                          } ${c.className || ''}`}
                          title={cellText(r, c.id) || undefined}
                        >
                          {singleLine ? (
                            <div className="flex w-full justify-center">{renderCell(r, c.id)}</div>
                          ) : (
                            <div className="mx-auto block w-full text-center">{renderCell(r, c.id)}</div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-3 py-3.5 text-center align-middle">
                      <button
                        type="button"
                        onClick={() => openModal(r)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[10px] font-medium hover:bg-bg"
                      >
                        <Pencil className="h-3 w-3" />
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </TableHorizontalScroll>
        {total > pageSize && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs text-muted">
            <span>
              Página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-border px-3 py-1 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-border px-3 py-1 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-panel p-5 shadow-xl">
            <h2 className="text-base font-semibold text-text">Atualizar ação</h2>
            <p className="mt-1 line-clamp-2 text-xs text-muted">{modal.item || modal.acao || modal.id}</p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-text">Status</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
                >
                  <option value="">(manter / livre)</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text">Comentários</label>
                <textarea
                  value={formComentarios}
                  onChange={(e) => setFormComentarios(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                  placeholder="Observações, andamento, pendências…"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-text">Evidência (texto ou link)</label>
                <input
                  value={formEvidencia}
                  onChange={(e) => setFormEvidencia(e.target.value)}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                  placeholder="https://… ou descrição"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-text">Novo prazo</label>
                  <input
                    type="date"
                    value={formNovoPrazo}
                    onChange={(e) => setFormNovoPrazo(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-text">Conclusão</label>
                  <input
                    type="date"
                    value={formConclusao}
                    onChange={(e) => setFormConclusao(e.target.value)}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="rounded-xl border border-border bg-bg/40 p-3">
                <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-text">
                  <Paperclip className="h-3.5 w-3.5" aria-hidden />
                  Anexar evidência (PDF, imagem — até 8 MB)
                </label>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.heic"
                  onChange={(e) => onUploadAnexo(e.target.files?.[0] || null)}
                  disabled={uploading}
                  className="block w-full text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-3 file:py-1.5 file:text-white file:font-medium"
                />
                {uploading ? (
                  <p className="mt-2 flex items-center gap-2 text-xs text-muted">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    Enviando e gravando no servidor…
                  </p>
                ) : null}
                {evidenceUrlForModal(modal, formEvidencia) ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <a
                      href={evidenceUrlForModal(modal, formEvidencia)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                    >
                      <FileText className="h-4 w-4" aria-hidden />
                      Abrir evidência no navegador
                      <ExternalLink className="h-3.5 w-3.5 opacity-90" aria-hidden />
                    </a>
                    <span className="max-w-[220px] truncate text-[11px] text-muted" title={modal.evidencia_arquivo_nome || modal.evidencia || ''}>
                      {modal.evidencia_arquivo_nome || 'Link / arquivo'}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <button
                type="button"
                disabled={saving || uploading}
                onClick={() => savePatch()}
                className="flex-1 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
              <button
                type="button"
                disabled={saving || uploading}
                onClick={() => darBaixa()}
                className="flex-1 rounded-xl border border-emerald-600 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 disabled:opacity-50"
              >
                Dar baixa (Concluído)
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => closeModal()}
                className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-bg"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
