'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Download, ChevronLeft, ChevronRight } from 'lucide-react';

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
  tipos: string[];
  responsaveis: string[];
  status: string[];
  statusFinal: string[];
};

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

export default function DemandasTrabalhistasPage() {
  const [regional, setRegional] = useState('');
  const [unidade, setUnidade] = useState('');
  const [tipoDemanda, setTipoDemanda] = useState('');
  const [status, setStatus] = useState('');
  const [statusFinal, setStatusFinal] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('dataChegada');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<OptionsData>({
    regionais: [],
    unidades: [],
    unidadesDetalhadas: [],
    tipos: [],
    responsaveis: [],
    status: [],
    statusFinal: [],
  });

  useEffect(() => {
    fetchJSON<OptionsData & { ok: boolean }>('/api/demandas-trabalhistas/options')
      .then((data) =>
        setOptions({
          regionais: data.regionais || [],
          unidades: data.unidades || [],
          unidadesDetalhadas: data.unidadesDetalhadas || [],
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
      if (tipoDemanda) params.set('tipoDemanda', tipoDemanda);
      if (status) params.set('status', status);
      if (statusFinal) params.set('statusFinal', statusFinal);
      if (responsavel) params.set('responsavel', responsavel);
      if (search) params.set('search', search);
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

  useEffect(() => {
    loadData();
  }, [regional, unidade, tipoDemanda, status, statusFinal, responsavel, search, page, pageSize, sortBy, sortDir]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

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
    setTipoDemanda('');
    setStatus('');
    setStatusFinal('');
    setResponsavel('');
    setSearch('');
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
      'Setor',
      'Função',
      'INSAL. IADVH',
      'INSAL. EMSERH',
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
      row.setor,
      row.funcao,
      row.insalIadvh,
      row.insalEmserh,
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

      <div className="rounded-xl border border-border bg-panel p-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold text-muted uppercase tracking-wide px-2">Filtros</span>
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
            <label className="block text-xs text-muted mb-1">Tipo de demanda</label>
            <select
              value={tipoDemanda}
              onChange={(e) => {
                setTipoDemanda(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todas</option>
              {options.tipos.map((item) => (
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

          <div>
            <label className="block text-xs text-muted mb-1">Responsável</label>
            <select
              value={responsavel}
              onChange={(e) => {
                setResponsavel(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todos</option>
              {options.responsaveis.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>

        {(regional || unidade || tipoDemanda || status || statusFinal || responsavel || search) && (
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
        <div className="overflow-x-auto">
          {loading ? (
            <div className="text-center py-8 text-muted">
              <div className="inline-block w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-2" />
              <div>Carregando demandas trabalhistas...</div>
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-8 text-muted">Nenhum registro encontrado</div>
          ) : (
            <table className="w-full text-[11px]">
              <thead className="bg-bg/50 border-b border-border">
                <tr>
                  {[
                    ['numeroSei', 'Nº SEI'],
                    ['demandante', 'Demandante'],
                    ['tipoDemanda', 'Tipo de demanda'],
                    ['origem', 'Origem'],
                    ['unidade', 'Unidade'],
                    ['setor', 'Setor'],
                    ['funcao', 'Função'],
                    ['insalIadvh', 'INSAL. IADVH'],
                    ['insalEmserh', 'INSAL. EMSERH'],
                    ['regional', 'Regional'],
                    ['dataChegada', 'Data chegada'],
                    ['mesChegada', 'Mês Chegada'],
                    ['anoChegada', 'Ano Chegada'],
                    ['responsavel', 'Responsável'],
                    ['status', 'Status'],
                    ['prazoDias', 'Prazo (dias)'],
                    ['dataLimite', 'Data limite'],
                    ['dataConclusao', 'Data conclusão'],
                    ['mesConclusao', 'Mês Conclusão'],
                    ['destino', 'Destino'],
                    ['statusFinal', 'Status Final'],
                    ['tempoRespostaDias', 'Tempo Resp. (dias)'],
                    ['observacoes', 'Observações'],
                  ].map(([key, label]) => (
                    <th
                      key={key}
                      className="px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase cursor-pointer hover:bg-bg/70 whitespace-nowrap"
                      onClick={() => handleSort(key)}
                    >
                      {label} {sortBy === key && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-bg/30">
                    <td className="px-4 py-3 text-center whitespace-nowrap">{row.numeroSei || '-'}</td>
                    <td className="px-4 py-3 text-center min-w-[220px]">{row.demandante || '-'}</td>
                    <td className="px-4 py-3 text-center min-w-[180px]">{row.tipoDemanda || '-'}</td>
                    <td className="px-4 py-3 text-center">{row.origem || '-'}</td>
                    <td className="px-4 py-3 text-center min-w-[180px]">{row.unidade || '-'}</td>
                    <td className="px-4 py-3 text-center">{row.setor || '-'}</td>
                    <td className="px-4 py-3 text-center">{row.funcao || '-'}</td>
                    <td className="px-4 py-3 text-center">{row.insalIadvh || '-'}</td>
                    <td className="px-4 py-3 text-center">{row.insalEmserh || '-'}</td>
                    <td className="px-4 py-3 text-center">{row.regional || '-'}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">{formatDate(row.dataChegada)}</td>
                    <td className="px-4 py-3 text-center">{row.mesChegada || '-'}</td>
                    <td className="px-4 py-3 text-center">{row.anoChegada ?? '-'}</td>
                    <td className="px-4 py-3 text-center">{row.responsavel || '-'}</td>
                    <td className="px-4 py-3 text-center">{row.status || '-'}</td>
                    <td className="px-4 py-3 text-center">{row.prazoDias ?? '-'}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">{formatDate(row.dataLimite)}</td>
                    <td className="px-4 py-3 text-center whitespace-nowrap">{formatDate(row.dataConclusao)}</td>
                    <td className="px-4 py-3 text-center">{row.mesConclusao || '-'}</td>
                    <td className="px-4 py-3 text-center">{row.destino || '-'}</td>
                    <td className="px-4 py-3 text-center">{row.statusFinal || '-'}</td>
                    <td className="px-4 py-3 text-center">{row.tempoRespostaDias ?? '-'}</td>
                    <td className="px-4 py-3 text-center min-w-[260px]">{row.observacoes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

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
    </div>
  );
}
