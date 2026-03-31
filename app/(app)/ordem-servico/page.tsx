'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { CheckCircle2, XCircle, Info, Search, Filter, RefreshCw, Download, FileText } from 'lucide-react';

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

type OrdemServicoRow = {
  id: string;
  nome: string;
  cpf: string; // mantido para ações (confirmar/desfazer), mas oculto na tabela
  matricula: string;
  unidade: string;
  regional: string;
  funcao: string;
  dataAdmissao: string | null;
  osEntregue: boolean;
  termoRecusa: boolean;
  dataEntregaOS: string | null;
  responsavelEntrega: string | null;
};

type MetaRealData = {
  meta: Record<string, number>;
  metaMensal?: Record<string, number>;
  real: Record<string, number>;
  realAcumulado: Record<string, number>;
  totalColaboradores: number;
  totalMeta: number;
  totalReal: number;
  ano: number;
};

const fetchJSON = async <T = any>(url: string, init?: RequestInit): Promise<T> => {
  const r = await fetch(url, { cache: 'no-store', ...init });
  const data = await r.json();
  if (!r.ok) {
    throw new Error((data && (data.error || data.message)) || 'Erro ao carregar dados');
  }
  return data as T;
};

/** Converte número serial do Excel (dias desde 1899-12-30) para Date */
function excelSerialToDate(serial: number): Date {
  const epoch = new Date(1899, 11, 30);
  return new Date(epoch.getTime() + serial * 86400000);
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return '-';
  const s = String(iso).trim();
  if (!s) return '-';

  // DD/MM/AAAA (4 dígitos no ano) — já correto
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [yyyy, mm, dd] = s.split('-');
    return `${dd}/${mm}/${yyyy}`;
  }

  // DD/MM/ + número serial do Excel (ex: 01/01/43906) — corrige exibição
  const matchSerialSuffix = s.match(/^(\d{2})\/(\d{2})\/(\d{5,})$/);
  if (matchSerialSuffix) {
    const serial = parseInt(matchSerialSuffix[3], 10);
    if (Number.isFinite(serial)) {
      const d = excelSerialToDate(serial);
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
    }
  }

  // Apenas número (serial do Excel)
  if (/^\d{5,}$/.test(s)) {
    const serial = parseInt(s, 10);
    if (Number.isFinite(serial)) {
      const d = excelSerialToDate(serial);
      if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('pt-BR');
    }
  }

  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('pt-BR');
}

function maskCPF(cpf?: string) {
  const d = String(cpf || '').replace(/\D/g, '').padStart(11, '0').slice(-11);
  return d ? `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}` : '';
}

function formatMatricula(mat?: string) {
  const digits = String(mat || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.padStart(6, '0').slice(-6);
}

export default function OrdemServicoPage() {
  const { user } = useUser();
  const responsavelLogado = user?.fullName ?? (user?.primaryEmailAddress?.emailAddress ?? 'Sistema');

  // Filtros
  const [regional, setRegional] = useState<string>('');
  const [unidade, setUnidade] = useState<string>('');
  const [entregue, setEntregue] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  // Dados
  const [rows, setRows] = useState<OrdemServicoRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<string>('nome');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Meta vs Real
  const [metaReal, setMetaReal] = useState<MetaRealData | null>(null);
  const [metaRealLoading, setMetaRealLoading] = useState(false);
  const [anoMetaReal, setAnoMetaReal] = useState<string>(String(new Date().getFullYear()));

  // Opções para filtros
  const [regionais, setRegionais] = useState<string[]>([]);
  const [unidades, setUnidades] = useState<Array<{ unidade: string; regional: string }>>([]);

  // Modal de confirmação
  const [modalConfirmacao, setModalConfirmacao] = useState<{
    open: boolean;
    row: OrdemServicoRow | null;
  }>({ open: false, row: null });
  const [saving, setSaving] = useState(false);
  const [dataEntrega, setDataEntrega] = useState<string>('');
  const [tipoLancamento, setTipoLancamento] = useState<'entregue' | 'recusado'>('entregue');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    setToasts((p) => [...p, { id, message: msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((x) => x.id !== id)), 5000);
  };
  const removeToast = (id: string) => setToasts((p) => p.filter((x) => x.id !== id));

  // Carrega opções
  useEffect(() => {
    fetchJSON<{ regionais: string[]; unidades: Array<{ unidade: string; regional: string }> }>('/api/ordem-servico/options')
      .then((d) => {
        setRegionais(d.regionais || []);
        setUnidades(d.unidades || []);
      })
      .catch(() => {
        setRegionais([]);
        setUnidades([]);
      });
  }, []);

  // Carrega lista
  useEffect(() => {
    loadData();
  }, [regional, unidade, entregue, search, page, pageSize, sortBy, sortDir]);

  // Carrega Meta vs Real
  useEffect(() => {
    loadMetaReal();
  }, [regional, anoMetaReal]);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (regional) params.set('regional', regional);
      if (unidade) params.set('unidade', unidade);
      if (entregue) params.set('entregue', entregue);
      if (search) params.set('search', search);
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      params.set('sortBy', sortBy);
      params.set('sortDir', sortDir);

      const data = await fetchJSON<{ rows: OrdemServicoRow[]; total: number }>(`/api/ordem-servico/list?${params.toString()}`);
      const list = (data.rows || []).map((r: any) => ({
        ...r,
        termoRecusa: Boolean(r.termoRecusa),
      }));
      setRows(list);
      setTotal(data.total || 0);
    } catch (error: any) {
      console.error('Erro ao carregar dados:', error);
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

      const data = await fetchJSON<MetaRealData>(`/api/ordem-servico/meta-real?${params.toString()}`);
      setMetaReal(data);
    } catch (error: any) {
      console.error('Erro ao carregar meta/real:', error);
    } finally {
      setMetaRealLoading(false);
    }
  };

  const unidadesFiltradas = useMemo(() => {
    if (!regional) return unidades;
    return unidades
      .filter((u) => u.regional === regional)
      .map((u) => u.unidade)
      .filter((u, i, arr) => arr.indexOf(u) === i)
      .sort();
  }, [regional, unidades]);

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('asc');
    }
    setPage(1);
  };

  const abrirModalConfirmacao = (row: OrdemServicoRow) => {
    setModalConfirmacao({ open: true, row });
    setDataEntrega(row.dataEntregaOS || new Date().toISOString().split('T')[0]);
    setTipoLancamento('entregue');
  };

  const fecharModalConfirmacao = () => {
    setModalConfirmacao({ open: false, row: null });
    setDataEntrega('');
    setTipoLancamento('entregue');
  };

  const salvarConfirmacao = async () => {
    if (!modalConfirmacao.row) return;

    setSaving(true);
    try {
      await fetchJSON('/api/ordem-servico/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colaboradorCpf: modalConfirmacao.row.cpf,
          entregue: true,
          dataEntrega: dataEntrega,
          responsavel: responsavelLogado,
          termoRecusa: tipoLancamento === 'recusado',
        }),
      });

      fecharModalConfirmacao();
      loadData();
      loadMetaReal();
      showToast(
        tipoLancamento === 'recusado' ? 'Termo de recusa registrado.' : 'Entrega da OS confirmada.',
        'success'
      );
    } catch (error: any) {
      showToast('Erro ao salvar: ' + (error.message || 'Erro desconhecido'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const marcarNaoEntregue = async (row: OrdemServicoRow) => {
    if (!confirm('Deseja marcar como NÃO entregue?')) return;

    setSaving(true);
    try {
      await fetchJSON('/api/ordem-servico/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          colaboradorCpf: row.cpf,
          entregue: false,
          dataEntrega: null,
          responsavel: null,
        }),
      });

      loadData();
      loadMetaReal();
      showToast('Marcado como não entregue.', 'success');
    } catch (error: any) {
      showToast('Erro ao salvar: ' + (error.message || 'Erro desconhecido'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const exportarExcel = async () => {
    if (!rows.length) return;
    const { utils, writeFile } = await import('xlsx');

    const headers = [
      'Nome',
      'CPF',
      'Matrícula',
      'Unidade',
      'Regional',
      'Função',
      'Data Admissão',
      'Situação',
      'Data (OS ou termo)',
      'Responsável',
    ];

    const data = rows.map((r) => [
      r.nome,
      maskCPF(r.cpf),
      formatMatricula(r.matricula),
      r.unidade,
      r.regional,
      r.funcao,
      formatDate(r.dataAdmissao),
      !r.osEntregue ? 'Pendente' : r.termoRecusa ? 'Recusado (termo)' : 'Entregue',
      formatDate(r.dataEntregaOS),
      r.responsavelEntrega || '',
    ]);

    const ws = utils.aoa_to_sheet([headers, ...data]);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'OrdemServico');
    writeFile(wb, `ordem-servico-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      {/* Header — igual ao de Entregas de EPI */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-medium tracking-wide text-muted uppercase">
            SST • Ordem de Serviço
          </p>
          <h1 className="mt-1 text-lg font-semibold">Ordem de Serviço</h1>
          <p className="mt-1 text-xs text-muted">
            Colaboradores ativos em {anoMetaReal} - Controle de entrega de Ordem de Serviço
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-2 rounded-full border border-border bg-panel px-3 py-1.5 text-xs text-muted">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>Colaboradores ativos em {anoMetaReal}</span>
          </div>
          <button
            onClick={exportarExcel}
            className="p-2 rounded-lg border border-border bg-panel hover:bg-bg text-sm font-medium transition-colors flex items-center"
            title="Exportar para Excel"
            aria-label="Exportar para Excel"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              loadData();
              loadMetaReal();
            }}
            disabled={loading || metaRealLoading}
            className="px-4 py-2 rounded-lg border border-border bg-panel hover:bg-bg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading || metaRealLoading ? 'animate-spin' : ''}`}
            />
            Atualizar
          </button>
        </div>
      </div>

      {/* Abas — mesma estrutura de Entregas (uma aba ativa) */}
      <div className="border-b border-border">
        <nav className="-mb-px flex gap-4 text-xs">
          <button
            type="button"
            className="border-b-2 border-emerald-500 text-emerald-500 px-3 py-2"
          >
            Lista de colaboradores
          </button>
        </nav>
      </div>

      {/* Meta vs Real — primeiro, igual ao de Entregas */}
      {metaReal && (() => {
        const meses = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
        const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

        const metaTotal = Number(metaReal.totalMeta || 0);
        const totalReal = Number(metaReal.totalReal || 0);
        const metasIncrementais = meses.map((_, idx) => ((idx + 1) / 12) * 100);
        const percentualRealAtual = metaTotal > 0 ? (totalReal / metaTotal) * 100 : 0;

        return (
          <div className="rounded-xl border border-border bg-panel p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold">Meta vs Real - Ordem de Serviço</h2>
              <select
                value={anoMetaReal}
                onChange={(e) => setAnoMetaReal(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-border bg-bg text-xs"
              >
                {[2024, 2025, 2026, 2027].map((a) => (
                  <option key={a} value={String(a)}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              {/* Linha META — fundo cinza como em Entregas */}
              <div className="flex items-center gap-2">
                <div className="w-20 font-bold text-sm text-text">META</div>
                <div className="flex-1 grid grid-cols-12 gap-1">
                  {metasIncrementais.map((metaPct, idx) => (
                    <div
                      key={meses[idx]}
                      className="text-center text-xs font-medium text-text bg-muted/30 py-1.5 rounded"
                    >
                      {metaPct.toFixed(2)}%
                    </div>
                  ))}
                </div>
              </div>

              {/* Linha REAL */}
              <div className="flex items-center gap-2">
                <div className="w-20 font-bold text-sm text-emerald-600 dark:text-emerald-400">
                  REAL
                </div>
                <div className="flex-1 grid grid-cols-12 gap-1">
                  {meses.map((mes, idx) => {
                    const metaIncremental = metasIncrementais[idx];
                    const estaAcima = percentualRealAtual >= metaIncremental;
                    return (
                      <div
                        key={mes}
                        className={`text-center text-xs font-bold py-1.5 rounded ${
                          estaAcima ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                        }`}
                        title={`${mesesNomes[idx]}: ${percentualRealAtual.toFixed(
                          2,
                        )}% (Meta: ${metaIncremental.toFixed(2)}%)`}
                      >
                        {percentualRealAtual.toFixed(2)}%
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Botões mensais — alinhados com as colunas, igual Entregas */}
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <div className="w-20" />
                <div className="flex-1 grid grid-cols-12 gap-1">
                  {meses.map((mes, idx) => (
                    <div
                      key={mes}
                      className="px-2 py-1.5 rounded-lg text-[10px] font-medium text-center text-muted bg-panel border border-border"
                    >
                      {mesesNomes[idx]}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-muted">
                <div>
                  Total: <span className="font-semibold text-text">{totalReal}</span> de{' '}
                  <span className="font-semibold text-text">{metaTotal}</span> OS entregues
                </div>
                <div>
                  {metaReal.totalColaboradores} colaborador(es) ativo(s) em {anoMetaReal}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Filtros — mesmo card e divisória de Entregas */}
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
              value={regional}
              onChange={(e) => {
                setRegional(e.target.value);
                setUnidade('');
                setPage(1);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
              aria-label="Selecione a Regional"
            >
              <option value="">Selecione…</option>
              {regionais.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium block mb-1.5 text-text">Unidade</label>
            <select
              value={unidade}
              onChange={(e) => {
                setUnidade(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!regional}
              aria-label="Selecione a Unidade"
            >
              <option value="">(todas)</option>
              {unidadesFiltradas.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium block mb-1.5 text-text">Status</label>
            <select
              value={entregue}
              onChange={(e) => {
                setEntregue(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
              aria-label="Filtrar por situação de entrega"
            >
              <option value="">Todos</option>
              <option value="sim">Concluído (entregue ou recusa)</option>
              <option value="entregue">Entregue (assinou OS)</option>
              <option value="recusado">Recusado (termo)</option>
              <option value="nao">Pendente</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-medium block mb-1.5 text-text">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Nome, CPF ou Matrícula"
                className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text placeholder:text-muted shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                aria-label="Buscar por nome, CPF ou matrícula"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
          <button
            onClick={() => {
              setRegional('');
              setUnidade('');
              setEntregue('');
              setSearch('');
              setPage(1);
            }}
            className="px-4 py-2.5 rounded-xl border border-border bg-panel hover:bg-bg text-sm font-medium transition-colors flex items-center gap-2"
          >
              <Filter className="w-4 h-4" />
              Limpar
            </button>
          </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-border bg-panel shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-center py-8 text-muted">
            <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
            <div>Carregando colaboradores...</div>
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-muted mb-2">Nenhum registro encontrado</div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead className="bg-bg/50 border-b border-border">
                  <tr>
                    <th
                      className="px-4 py-3 text-left text-[11px] font-semibold text-muted uppercase cursor-pointer hover:bg-bg/70"
                      onClick={() => handleSort('nome')}
                    >
                      Nome {sortBy === 'nome' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase">Matrícula</th>
                    <th
                      className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase cursor-pointer hover:bg-bg/70"
                      onClick={() => handleSort('unidade')}
                    >
                      Unidade {sortBy === 'unidade' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th
                      className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase cursor-pointer hover:bg-bg/70"
                      onClick={() => handleSort('regional')}
                    >
                      Regional {sortBy === 'regional' && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase">Função</th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase">Data Admissão</th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase">Status OS</th>
                    <th className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-bg/30">
                      <td className="px-4 py-3 text-left text-[11px] font-medium">{row.nome}</td>
                      <td className="px-4 py-3 text-center text-[11px]">{formatMatricula(row.matricula)}</td>
                      <td className="px-4 py-3 text-center text-[11px]">{row.unidade}</td>
                      <td className="px-4 py-3 text-center text-[11px]">{row.regional}</td>
                      <td className="px-4 py-3 text-center text-[11px]">{row.funcao}</td>
                      <td className="px-4 py-3 text-center text-[11px]">{formatDate(row.dataAdmissao)}</td>
                      <td className="px-4 py-3 text-center">
                        {!row.osEntregue ? (
                          <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-medium bg-red-50 dark:bg-red-500/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-500/50">
                            <XCircle className="w-3 h-3 mr-1" />
                            Pendente
                          </span>
                        ) : row.termoRecusa ? (
                          <span
                            className="inline-flex items-center px-2 py-1 rounded text-[11px] font-medium bg-amber-50 dark:bg-amber-500/15 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-500/40"
                            title="Assinou termo de recusa da OS — contabilizado como concluído"
                          >
                            <FileText className="w-3 h-3 mr-1 shrink-0" />
                            Recusado
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/50">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Entregue
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {row.osEntregue ? (
                            <button
                              onClick={() => marcarNaoEntregue(row)}
                              className="px-2 py-1 rounded text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                              title="Marcar como não entregue"
                            >
                              Desfazer
                            </button>
                          ) : (
                            <button
                              onClick={() => abrirModalConfirmacao(row)}
                              className="px-2 py-1 rounded text-[10px] bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                              title="Confirmar entrega da OS"
                            >
                              Confirmar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div className="border-t border-border bg-bg/30 px-4 py-3 flex items-center justify-between">
              <div className="text-xs text-muted">
                Mostrando {rows.length} de {total} registro(s)
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 rounded border border-border bg-panel hover:bg-bg text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="text-xs text-muted">
                  Página {page} de {Math.ceil(total / pageSize) || 1}
                </span>
                <button
                  onClick={() => setPage(Math.min(Math.ceil(total / pageSize), page + 1))}
                  disabled={page >= Math.ceil(total / pageSize)}
                  className="px-3 py-1 rounded border border-border bg-panel hover:bg-bg text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Próxima
                </button>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="px-2 py-1 rounded border border-border bg-panel text-xs"
                >
                  <option value={10}>10/página</option>
                  <option value={25}>25/página</option>
                  <option value={50}>50/página</option>
                  <option value={100}>100/página</option>
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Modal de Confirmação */}
      {modalConfirmacao.open && modalConfirmacao.row && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={fecharModalConfirmacao}>
          <div
            className="w-full max-w-md rounded-2xl border border-border bg-panel shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-border bg-card px-6 py-4 flex-shrink-0">
              <h2 className="text-lg font-semibold">Registrar Ordem de Serviço</h2>
              <p className="text-xs text-muted mt-1">
                Entregue ou termo de recusa — ambos contam no acompanhamento; o status na lista diferencia cada caso.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <div className="text-sm font-medium text-muted mb-1">Colaborador</div>
                <div className="text-base font-semibold text-text">{modalConfirmacao.row.nome}</div>
                <div className="text-xs text-muted mt-0.5">
                  Matrícula: {modalConfirmacao.row.matricula}
                </div>
              </div>

              <div>
                <div className="text-sm font-medium text-muted mb-1">Unidade</div>
                <div className="text-sm text-text">{modalConfirmacao.row.unidade}</div>
                <div className="text-xs text-muted mt-0.5">Regional: {modalConfirmacao.row.regional}</div>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-muted mb-2 block">Situação</legend>
                <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-border bg-bg/50 px-3 py-2 has-[:checked]:border-emerald-500/50 has-[:checked]:bg-emerald-500/5">
                  <input
                    type="radio"
                    name="tipo-os-ordem"
                    className="mt-1"
                    checked={tipoLancamento === 'entregue'}
                    onChange={() => setTipoLancamento('entregue')}
                  />
                  <span>
                    <span className="text-sm font-medium text-text block">Entregue</span>
                    <span className="text-xs text-muted">Colaborador assinou a ordem de serviço.</span>
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-border bg-bg/50 px-3 py-2 has-[:checked]:border-amber-500/50 has-[:checked]:bg-amber-500/5">
                  <input
                    type="radio"
                    name="tipo-os-ordem"
                    className="mt-1"
                    checked={tipoLancamento === 'recusado'}
                    onChange={() => setTipoLancamento('recusado')}
                  />
                  <span>
                    <span className="text-sm font-medium text-text block">Recusado (termo de recusa)</span>
                    <span className="text-xs text-muted">
                      Assinou apenas o termo de recusa; conta como concluído e aparece como &quot;Recusado&quot; na lista.
                    </span>
                  </span>
                </label>
              </fieldset>

              <div>
                <label className="text-sm font-medium text-muted block mb-1.5">
                  {tipoLancamento === 'recusado' ? 'Data do termo de recusa' : 'Data da entrega / assinatura da OS'}
                </label>
                <input
                  type="date"
                  value={dataEntrega}
                  onChange={(e) => setDataEntrega(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            <div className="border-t border-border bg-card px-6 py-4 flex items-center justify-end gap-3 flex-shrink-0">
              <button
                onClick={fecharModalConfirmacao}
                className="px-4 py-2 rounded-lg border border-border bg-panel hover:bg-bg text-sm font-medium transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvarConfirmacao}
                disabled={saving || !dataEntrega}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Salvando...' : tipoLancamento === 'recusado' ? 'Registrar termo' : 'Confirmar entrega'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
