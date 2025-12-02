'use client';

import React, { useEffect, useMemo, useState } from 'react';

type KitMapRow = {
  funcao: string;
  item: string;
  quantidade: number;
  unidade: string;
};

type KitMapResponse = {
  rows: KitMapRow[];
  total: number;
};

const fetchJSON = async <T = any>(url: string, init?: RequestInit): Promise<T> => {
  const r = await fetch(url, { cache: 'no-store', ...init });
  const data = await r.json();
  if (!r.ok) {
    throw new Error((data && (data.error || data.message)) || 'Erro ao carregar dados');
  }
  return data as T;
};

const PAGE_SIZE = 400;

export default function KitsPage() {
  const [q, setQ] = useState('');
  const [unidade, setUnidade] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<KitMapRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  // Carrega dados do mapa de kits
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (unidade.trim()) params.set('unidade', unidade.trim());
        params.set('page', String(page));
        params.set('size', String(PAGE_SIZE));

        const data = await fetchJSON<KitMapResponse>(`/api/kits/map?${params.toString()}`);

        if (cancelled) return;

        const novasLinhas = data?.rows ?? [];
        setRows(novasLinhas);
        setTotal(typeof data?.total === 'number' ? data.total : novasLinhas.length);

        if (novasLinhas.length > 0) {
          setSelectedKey((prev) => {
            if (prev) {
              const stillExists = novasLinhas.some((r) => {
                const func = (r.funcao || '').trim();
                const un = (r.unidade || '').trim();
                const key = `${func}|||${un}`;
                return key === prev;
              });
              if (stillExists) return prev;
            }
            const first = novasLinhas[0];
            const func = (first.funcao || '').trim();
            const un = (first.unidade || '').trim();
            return `${func}|||${un}`;
          });
        } else {
          setSelectedKey(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Erro ao carregar dados');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [q, unidade, page]);

  // Agrupa linhas por função
  type GrupoFuncaoUnidade = {
    key: string;
    funcao: string;
    unidade: string;
    itens: KitMapRow[];
  };

  const gruposPorFuncao = useMemo<GrupoFuncaoUnidade[]>(() => {
    const map = new Map<string, GrupoFuncaoUnidade>();

    for (const row of rows) {
      const funcao = (row.funcao || 'SEM FUNÇÃO').trim();
      const unidade = (row.unidade || '—').trim();
      const key = `${funcao}|||${unidade}`;

      if (!map.has(key)) {
        map.set(key, { key, funcao, unidade, itens: [] });
      }
      map.get(key)!.itens.push(row);
    }

    const entries = Array.from(map.values());
    entries.sort((a, b) => {
      const byFunc = a.funcao.localeCompare(b.funcao, 'pt-BR');
      if (byFunc !== 0) return byFunc;
      return a.unidade.localeCompare(b.unidade, 'pt-BR');
    });

    return entries;
  }, [rows]);

  const funcoesResumo = useMemo(() => {
    let comKit = 0;
    let apenasSemEpi = 0;

    for (const grupo of gruposPorFuncao) {
      const temEpiReal = grupo.itens.some((i) => {
        const nome = (i.item || '').toUpperCase();
        const qtd = i.quantidade ?? 0;
        return nome !== 'SEM EPI' && qtd > 0;
      });

      if (temEpiReal) {
        comKit += 1;
      } else {
        apenasSemEpi += 1;
      }
    }

    return {
      funcoesTotal: gruposPorFuncao.length,
      comKit,
      apenasSemEpi,
    };
  }, [gruposPorFuncao]);

  const funcoesLista = useMemo(
    () =>
      gruposPorFuncao.map((grupo) => {
        const qtdItens = grupo.itens.length;
        const qtdTotal = grupo.itens.reduce((acc, it) => acc + (it.quantidade ?? 0), 0);

        return {
          key: grupo.key,
          funcao: grupo.funcao,
          unidade: grupo.unidade,
          qtdItens,
          qtdTotal,
        };
      }),
    [gruposPorFuncao],
  );

  const totalPages = Math.max(1, Math.ceil((total || 0) / PAGE_SIZE) || 1);

  const grupoSelecionado = useMemo(
    () => (selectedKey ? gruposPorFuncao.find((g) => g.key === selectedKey) || null : null),
    [selectedKey, gruposPorFuncao],
  );

  const funcaoSelecionada = grupoSelecionado?.itens ?? null;

  const selectedLabel = grupoSelecionado
    ? `${grupoSelecionado.funcao} • ${grupoSelecionado.unidade || '—'}`
    : 'Nenhuma função selecionada';

  return (
    <div className="space-y-4">
      {/* Cabeçalho - seguindo padrão do Estoque */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Mapa de kits por função</h1>
          <p className="text-xs text-muted">
            Visão consolidada dos EPIs previstos para cada função, com base no mapa oficial
            stg_epi_map. Use esta tela como referência de auditoria e planejamento.
          </p>
        </div>
      </div>

      {/* Linha de separação para manter o mesmo alinhamento visual do Estoque */}
      <div className="border-b border-border" />

            {/* Bloco principal: filtros, funções e kit selecionado */}
      <div className="space-y-4">
        {/* Filtros principais */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-panel p-4 text-xs md:flex-row md:items-end md:justify-between md:gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-medium">Buscar função ou EPI</span>
            <input
              type="text"
              className="w-full max-w-xs rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Digite parte da função (ex.: ENFERMEIRO) ou do EPI (ex.: MÁSCARA)..."
              value={q}
              onChange={(e) => {
                setPage(1);
                setQ(e.target.value);
              }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-medium">Filtrar por unidade (opcional)</span>
            <input
              type="text"
              className="w-full max-w-xs rounded border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Nome da unidade (ex.: HOSPITAL REGIONAL...)"
              value={unidade}
              onChange={(e) => {
                setPage(1);
                setUnidade(e.target.value);
              }}
            />
          </div>

          <div className="flex flex-col gap-0.5 text-[11px] text-muted md:ml-auto md:items-end">
            <span>
              Funções com kit definido:{' '}
              <span className="font-semibold text-text">{funcoesResumo.comKit}</span>
            </span>
            <span>
              Funções sem kit (apenas &quot;SEM EPI&quot;):{' '}
              <span className="font-semibold text-text">{funcoesResumo.apenasSemEpi}</span>
            </span>
            <span>
              Página{' '}
              <span className="font-semibold text-text">
                {page} / {totalPages}
              </span>
            </span>
          </div>
        </div>

{/* Conteúdo principal: lista de funções e detalhes do kit */}
        <div className="space-y-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
            {/* Funções com kit */}
            <div className="rounded-xl border border-border bg-panel text-xs lg:flex-1">
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-xs font-semibold">Funções com kit cadastrado</h2>
                  <p className="text-[11px] text-muted">
                    Selecione uma função para ver o detalhamento do kit ao lado.
                  </p>
                </div>
                <div className="text-[11px] text-muted">
                  <span className="font-semibold text-text">{funcoesResumo.funcoesTotal}</span>{' '}
                  funções encontradas
                </div>
              </div>
            </div>

            <div className="max-h-[440px] overflow-auto">
              <table className="w-full table-fixed border-separate border-spacing-0 text-[11px]">
                <thead className="bg-muted/40 text-[11px] uppercase text-muted">
                  <tr>
                    <th className="sticky left-0 z-10 w-[32%] border-b border-border bg-muted/40 px-3 py-2 text-left">
                      Função
                    </th>
                    <th className="w-[40%] border-b border-border px-3 py-2 text-left">Unidade</th>
                    <th className="w-[8%] border-b border-border px-3 py-2 text-center">Itens</th>
                    <th className="w-[20%] border-b border-border px-3 py-2 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {funcoesLista.map((linha) => {
                    const selecionada = linha.key === selectedKey;
                    return (
                      <tr
                        key={linha.key}
                        className={`cursor-pointer border-b border-border/60 text-[11px] ${
                          selecionada
                            ? 'bg-emerald-50/70 dark:bg-emerald-500/10'
                            : 'hover:bg-muted/40'
                        }`}
                        onClick={() => setSelectedKey(linha.key)}
                      >
                        <td className="sticky left-0 z-10 bg-panel px-3 py-2 text-left align-top">
                          <div className="whitespace-normal break-words font-medium">{linha.funcao}</div>
                        </td>
                        <td className="px-3 py-2 text-left align-top">
                          <div className="whitespace-normal break-words text-[11px]">
                            {linha.unidade || '—'}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center font-medium">{linha.qtdItens}</td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            className={`rounded-full px-3 py-1 text-[11px] ${
                              selecionada
                                ? 'bg-emerald-500 text-white'
                                : 'border border-border bg-card hover:bg-muted/60'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedKey(linha.key);
                            }}
                          >
                            {selecionada ? 'Selecionada' : 'Ver kit'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {funcoesLista.length === 0 && !loading && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-8 text-center text-[11px] text-muted"
                      >
                        Nenhuma função encontrada para os filtros informados.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação simples */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[11px] text-muted">
                <div>
                  Mostrando{' '}
                  <span className="font-semibold text-text">{rows.length}</span>{' '}
                  registros na página atual.
                </div>
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded border border-border px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Anterior
                  </button>
                  <span className="px-1">
                    Página{' '}
                    <span className="font-semibold text-text">
                      {page} / {totalPages}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="rounded border border-border px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Detalhes do kit da função selecionada */}
          <div className="rounded-xl border border-border bg-panel text-xs lg:w-80 lg:shrink-0 xl:w-96 2xl:w-[420px]">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-xs font-semibold">
                {selectedLabel}
              </h2>
              <p className="text-[11px] text-muted">
                Lista completa de EPIs previstos para a função/unidade selecionada.
              </p>
            </div>

            <div className="max-h-[440px] overflow-auto">
              {loading && (
                <div className="px-4 py-8 text-center text-[11px] text-muted">
                  Carregando kit da função selecionada...
                </div>
              )}

              {!loading && !funcaoSelecionada && (
                <div className="px-4 py-8 text-center text-[11px] text-muted">
                  Selecione uma função na tabela ao lado para ver o kit detalhado.
                </div>
              )}

              {!loading && funcaoSelecionada && (
                <table className="w-full table-fixed border-separate border-spacing-0 text-[11px]">
                  <thead className="bg-muted/40 text-[11px] uppercase text-muted">
                    <tr>
                      <th className="border-b border-border px-3 py-2 text-left">EPI</th>
                      <th className="border-b border-border px-3 py-2 text-center">
                        Quantidade
                      </th>
                      <th className="border-b border-border px-3 py-2 text-left">
                        Unidade de entrega
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {funcaoSelecionada.map((item, idx) => (
                      <tr
                        key={`${item.item}-${idx}`}
                        className="border-b border-border/60 text-[11px]"
                      >
                        <td className="px-3 py-2 text-left">
                          {item.item || 'SEM EPI'}
                        </td>
                        <td className="px-3 py-2 text-center font-medium">
                          {item.quantidade ?? 0}
                        </td>
                        <td className="px-3 py-2 text-left">
                          {item.unidade || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

        {/* Estado de erro global */}
        {error && (
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-800">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}