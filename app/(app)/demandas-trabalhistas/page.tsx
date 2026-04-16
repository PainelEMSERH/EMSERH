'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, Download, ChevronLeft, ChevronRight, ExternalLink, Edit2, Plus } from 'lucide-react';

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
  anosChegada: number[];
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

function buildSeiUrl(numeroSei: string): string {
  const clean = numeroSei.trim();
  if (!clean) return '#';
  if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
  return `https://sei.ma.gov.br/sei/${encodeURIComponent(clean)}`;
}

export default function DemandasTrabalhistasPage() {
  const [regional, setRegional] = useState('');
  const [unidade, setUnidade] = useState('');
  const [tipoDemanda, setTipoDemanda] = useState('');
  const [status, setStatus] = useState('');
  const [statusFinal, setStatusFinal] = useState('');
  const [responsavel, setResponsavel] = useState('');
  const [ano, setAno] = useState<string>('');
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
    anosChegada: [],
    tipos: [],
    responsaveis: [],
    status: [],
    statusFinal: [],
  });

  const [modalDemanda, setModalDemanda] = useState<{
    open: boolean;
    row: Row | null;
    saving: boolean;
  }>({
    open: false,
    row: null,
    saving: false,
  });

  useEffect(() => {
    fetchJSON<OptionsData & { ok: boolean }>('/api/demandas-trabalhistas/options')
      .then((data) =>
        setOptions({
          regionais: data.regionais || [],
          unidades: data.unidades || [],
          unidadesDetalhadas: data.unidadesDetalhadas || [],
          anosChegada: data.anosChegada || [],
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
          anosChegada: [],
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
      if (ano) params.set('ano', ano);
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
  }, [regional, unidade, tipoDemanda, status, statusFinal, responsavel, search, ano, page, pageSize, sortBy, sortDir]);

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
    setAno('');
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
            onClick={() =>
              setModalDemanda({
                open: true,
                saving: false,
                row: {
                  id: 0,
                  numeroSei: '',
                  demandante: '',
                  tipoDemanda: '',
                  origem: '',
                  unidade: '',
                  setor: '',
                  funcao: '',
                  insalIadvh: '',
                  insalEmserh: '',
                  regional: '',
                  dataChegada: null,
                  mesChegada: '',
                  anoChegada: null,
                  responsavel: '',
                  status: '',
                  prazoDias: null,
                  dataLimite: null,
                  dataConclusao: null,
                  mesConclusao: '',
                  destino: '',
                  statusFinal: '',
                  tempoRespostaDias: null,
                  observacoes: '',
                },
              })
            }
            className="px-4 py-2 rounded-lg border border-border bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nova demanda
          </button>
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
            <label className="block text-xs text-muted mb-1">Ano Chegada</label>
            <select
              value={ano}
              onChange={(e) => {
                setAno(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-card text-sm text-text shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todos</option>
              {options.anosChegada.map((item) => (
                <option key={item} value={String(item)}>
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
                    ['acoes', 'Ações'],
                  ].map(([key, label]) => (
                    <th
                      key={key}
                      className={`px-4 py-3 text-center text-[11px] font-semibold text-muted uppercase whitespace-nowrap ${
                        key === 'acoes' ? 'cursor-default' : 'cursor-pointer hover:bg-bg/70'
                      }`}
                      onClick={() => key !== 'acoes' && handleSort(key)}
                    >
                      {label} {key !== 'acoes' && sortBy === key && (sortDir === 'asc' ? '↑' : '↓')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id} className="hover:bg-bg/30 text-[11px] uppercase">
                    <td className="px-4 py-3 text-center whitespace-nowrap">
                      {row.numeroSei ? (
                        <a
                          href={buildSeiUrl(row.numeroSei)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-emerald-600 hover:text-emerald-500 underline-offset-2 hover:underline"
                        >
                          <span>{row.numeroSei}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-center min-w-[220px]">{row.demandante || '-'}</td>
                    <td className="px-4 py-3 text-center min-w-[180px]">{row.tipoDemanda || '-'}</td>
                    <td className="px-4 py-3 text-center">{row.origem || '-'}</td>
                    <td className="px-4 py-3 text-center min-w-[180px]">{row.unidade || '-'}</td>
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
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() =>
                          setModalDemanda({
                            open: true,
                            saving: false,
                            row,
                          })
                        }
                        className="inline-flex items-center justify-center rounded-full border border-border bg-panel px-2 py-1 text-[10px] font-medium text-text hover:bg-bg"
                        title="Editar demanda"
                      >
                        <Edit2 className="w-3 h-3 mr-1" />
                        EDITAR
                      </button>
                    </td>
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

      {modalDemanda.open && modalDemanda.row && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !modalDemanda.saving && setModalDemanda({ open: false, row: null, saving: false })}
        >
          <div
            className="w-full max-w-4xl rounded-2xl border border-border bg-panel shadow-2xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border bg-card px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold">
                  {modalDemanda.row.id ? 'Editar Demanda Trabalhista' : 'Nova Demanda Trabalhista'}
                </h2>
                <p className="text-xs text-muted mt-1">
                  Preencha os campos principais da demanda. Datas são opcionais.
                </p>
              </div>
              <button
                onClick={() => !modalDemanda.saving && setModalDemanda({ open: false, row: null, saving: false })}
                className="p-2 rounded-lg hover:bg-bg transition-colors"
                title="Fechar"
                type="button"
              >
                <ChevronRight className="w-5 h-5 rotate-90" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-muted mb-1">Nº SEI</label>
                  <input
                    type="text"
                    value={modalDemanda.row.numeroSei}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, numeroSei: e.target.value.toUpperCase() } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Demandante</label>
                  <input
                    type="text"
                    value={modalDemanda.row.demandante}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, demandante: e.target.value.toUpperCase() } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Tipo de demanda</label>
                  <input
                    type="text"
                    value={modalDemanda.row.tipoDemanda}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, tipoDemanda: e.target.value.toUpperCase() } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Origem</label>
                  <input
                    type="text"
                    value={modalDemanda.row.origem}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, origem: e.target.value.toUpperCase() } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Unidade</label>
                  <input
                    type="text"
                    value={modalDemanda.row.unidade}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, unidade: e.target.value.toUpperCase() } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Regional</label>
                  <input
                    type="text"
                    value={modalDemanda.row.regional}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, regional: e.target.value.toUpperCase() } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Data chegada</label>
                  <input
                    type="date"
                    value={modalDemanda.row.dataChegada ? modalDemanda.row.dataChegada.slice(0, 10) : ''}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, dataChegada: e.target.value || null } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Data limite</label>
                  <input
                    type="date"
                    value={modalDemanda.row.dataLimite ? modalDemanda.row.dataLimite.slice(0, 10) : ''}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, dataLimite: e.target.value || null } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Data de conclusão</label>
                  <input
                    type="date"
                    value={modalDemanda.row.dataConclusao ? modalDemanda.row.dataConclusao.slice(0, 10) : ''}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, dataConclusao: e.target.value || null } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Responsável</label>
                  <input
                    type="text"
                    value={modalDemanda.row.responsavel}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, responsavel: e.target.value.toUpperCase() } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Status</label>
                  <input
                    type="text"
                    value={modalDemanda.row.status}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, status: e.target.value.toUpperCase() } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Status final</label>
                  <input
                    type="text"
                    value={modalDemanda.row.statusFinal}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, statusFinal: e.target.value.toUpperCase() } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Destino</label>
                  <input
                    type="text"
                    value={modalDemanda.row.destino}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, destino: e.target.value.toUpperCase() } }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Prazo (dias)</label>
                  <input
                    type="number"
                    value={modalDemanda.row.prazoDias ?? ''}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : {
                              ...prev,
                              row: {
                                ...prev.row,
                                prazoDias: e.target.value ? Number(e.target.value) : null,
                              },
                            }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div>
                  <label className="block text-xs text-muted mb-1">Tempo de resposta (dias)</label>
                  <input
                    type="number"
                    value={modalDemanda.row.tempoRespostaDias ?? ''}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : {
                              ...prev,
                              row: {
                                ...prev.row,
                                tempoRespostaDias: e.target.value ? Number(e.target.value) : null,
                              },
                            }
                      )
                    }
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs text-muted mb-1">
                    Observações (só na edição — não aparece na lista)
                  </label>
                  <textarea
                    value={modalDemanda.row.observacoes}
                    onChange={(e) =>
                      setModalDemanda((prev) =>
                        !prev.row
                          ? prev
                          : { ...prev, row: { ...prev.row, observacoes: e.target.value.toUpperCase() } }
                      )
                    }
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-bg text-sm text-text focus:outline-none focus:ring-2 focus:ring-emerald-500/60 resize-y"
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-border bg-card px-6 py-4 flex items-center justify-between">
              <div className="text-xs text-muted">
                Campos em branco serão salvos como vazios (não obrigatórios).
              </div>
              <button
                type="button"
                disabled={modalDemanda.saving}
                onClick={async () => {
                  if (!modalDemanda.row) return;
                  setModalDemanda((prev) => ({ ...prev, saving: true }));
                  try {
                    await fetchJSON('/api/demandas-trabalhistas/save', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        id: modalDemanda.row.id || null,
                        numeroSei: modalDemanda.row.numeroSei,
                        demandante: modalDemanda.row.demandante,
                        tipoDemanda: modalDemanda.row.tipoDemanda,
                        origem: modalDemanda.row.origem,
                        unidade: modalDemanda.row.unidade,
                        regional: modalDemanda.row.regional,
                        dataChegada: modalDemanda.row.dataChegada,
                        dataLimite: modalDemanda.row.dataLimite,
                        dataConclusao: modalDemanda.row.dataConclusao,
                        responsavel: modalDemanda.row.responsavel,
                        status: modalDemanda.row.status,
                        statusFinal: modalDemanda.row.statusFinal,
                        destino: modalDemanda.row.destino,
                        prazoDias: modalDemanda.row.prazoDias,
                        tempoRespostaDias: modalDemanda.row.tempoRespostaDias,
                        observacoes: modalDemanda.row.observacoes,
                        mesConclusao: modalDemanda.row.mesConclusao,
                      }),
                    });
                    setModalDemanda({ open: false, row: null, saving: false });
                    await loadData();
                  } catch (e) {
                    console.error('Erro ao salvar demanda:', e);
                    setModalDemanda((prev) => ({ ...prev, saving: false }));
                  }
                }}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {modalDemanda.saving && (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
