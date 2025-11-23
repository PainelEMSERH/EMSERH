// file: app/(app)/kits/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';

type KitRow = {
  funcao: string;
  item: string;
  quantidade: number;
  unidade: string;
};

type KitsResponse = {
  rows: KitRow[];
  total: number;
};

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('Erro ao buscar', url, res.status, text);
    throw new Error('Falha ao carregar dados de kits.');
  }
  return (await res.json()) as T;
}

function normalizarTexto(s: string | null | undefined) {
  return (s || '').toString().trim();
}

export default function KitsPage() {
  const [q, setQ] = useState('');
  const [unidade, setUnidade] = useState('');
  const [rows, setRows] = useState<KitRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 200;
  const [loading, setLoading] = useState(false);
  const [selectedFuncao, setSelectedFuncao] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (unidade.trim()) params.set('unidade', unidade.trim());
    params.set('page', String(page));
    params.set('size', String(pageSize));

    setLoading(true);

    fetchJSON<KitsResponse>('/api/kits/map?' + params.toString())
      .then((data) => {
        if (!active) return;
        const safeRows = Array.isArray(data.rows) ? data.rows : [];
        setRows(safeRows);
        const safeTotal =
          typeof data.total === 'number' && Number.isFinite(data.total)
            ? data.total
            : safeRows.length;
        setTotal(safeTotal);
      })
      .catch((err) => {
        if (!active) return;
        console.error(err);
        setRows([]);
        setTotal(0);
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [q, unidade, page]);

  const { gruposComKit, gruposSemKit } = useMemo(() => {
    const map = new Map<string, KitRow[]>();

    rows.forEach((row) => {
      const funcao = normalizarTexto(row.funcao) || 'SEM FUNÇÃO';
      const atual = map.get(funcao) || [];
      atual.push(row);
      map.set(funcao, atual);
    });

    const grupos = Array.from(map.entries()).map(([funcao, itens]) => {
      const totalQtd = itens.reduce((acc, it) => acc + (Number(it.quantidade) || 0), 0);
      const unidadesSet = new Set<string>();
      itens.forEach((it) => {
        const u = normalizarTexto(it.unidade);
        if (u) unidadesSet.add(u);
      });
      const unidadesList = Array.from(unidadesSet);
      return {
        funcao,
        itens,
        totalQtd,
        unidades: unidadesList,
      };
    });

    grupos.sort((a, b) => a.funcao.localeCompare(b.funcao, 'pt-BR'));

    const gruposComKit = [];
    const gruposSemKit = [];

    for (const g of grupos) {
      const temKitValido = g.itens.some((it) => {
        const nome = normalizarTexto(it.item).toUpperCase();
        const qtd = Number(it.quantidade) || 0;
        if (!nome || nome === 'SEM EPI') return false;
        if (qtd <= 0) return false;
        return true;
      });

      if (temKitValido) {
        gruposComKit.push(g);
      } else {
        gruposSemKit.push(g);
      }
    }

    return { gruposComKit, gruposSemKit };
  }, [rows]);

  // Garante que sempre exista uma função selecionada quando houver dados
  useEffect(() => {
    if (!gruposComKit.length) {
      setSelectedFuncao(null);
      return;
    }
    if (!selectedFuncao) {
      setSelectedFuncao(gruposComKit[0].funcao);
      return;
    }
    const stillExists = gruposComKit.some((g) => g.funcao === selectedFuncao);
    if (!stillExists) {
      setSelectedFuncao(gruposComKit[0].funcao);
    }
  }, [gruposComKit, selectedFuncao]);

  const totalFuncoesComKit = useMemo(() => gruposComKit.length, [gruposComKit]);
  const totalFuncoesSemKit = useMemo(() => gruposSemKit.length, [gruposSemKit]);

  const totalPages = useMemo(() => {
    if (total <= 0) return 1;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [total, pageSize]);

  const funcaoSelecionada = useMemo(
    () => gruposComKit.find((g) => g.funcao === selectedFuncao) || null,
    [gruposComKit, selectedFuncao],
  );

  function handleChangePage(delta: number) {
    setPage((prev) => {
      const next = prev + delta;
      if (next < 1) return 1;
      if (next > totalPages) return totalPages;
      return next;
    });
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Mapa de kits por função</h1>
          <p className="text-xs text-muted">
            Visão consolidada dos EPIs previstos para cada função, com base no mapa oficial
            stg_epi_map. Use esta tela como referência de auditoria e planejamento.
          </p>
        </div>
      </div>

      {/* Filtros e resumo */}
      <div className="rounded-xl border border-border bg-panel p-4 text-xs space-y-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="flex flex-col gap-1">
            <span className="font-medium">Buscar função ou EPI</span>
            <input
              type="text"
              className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
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
              className="rounded border border-border bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="Nome da unidade (ex.: HOSPITAL REGIONAL...)"
              value={unidade}
              onChange={(e) => {
                setPage(1);
                setUnidade(e.target.value);
              }}
            />
          </div>

          <div className="flex flex-col justify-end gap-1 text-[11px]">
            <div>
              <span className="text-muted">Funções com kit definido: </span>
              <span className="font-semibold">{totalFuncoesComKit}</span>
            </div>
            <div>
              <span className="text-muted">Funções sem kit (apenas &quot;SEM EPI&quot;): </span>
              <span className="font-semibold">{totalFuncoesSemKit}</span>
            </div>
            <div>
              <span className="text-muted">Página </span>
              <span className="font-semibold">
                {page} / {totalPages}
              </span>
            </div>
          </div>
        </div>

        {loading && (
          <div className="text-[11px] text-muted">
            Carregando mapa de kits...
          </div>
        )}
      </div>

      {/* Tabela de funções e detalhes de kit */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-4">
        <div className="rounded-xl border border-border bg-panel text-xs lg:basis-7/12">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <div className="text-sm font-semibold">Funções com kit cadastrado</div>
              <div className="text-[11px] text-muted">
                Selecione uma função para ver o detalhamento do kit ao lado.
              </div>
            </div>
            {totalPages > 1 && (
              <div className="inline-flex items-center gap-1 text-[11px] text-muted">
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 disabled:opacity-40"
                  onClick={() => handleChangePage(-1)}
                  disabled={page <= 1}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className="rounded border border-border px-2 py-1 disabled:opacity-40"
                  onClick={() => handleChangePage(1)}
                  disabled={page >= totalPages}
                >
                  Próxima
                </button>
              </div>
            )}
          </div>

          <div className="max-h-[520px] overflow-auto rounded-b-xl border-t border-border bg-card">
            <table className="min-w-full text-[11px]">
              <thead className="bg-white/5 text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">Função</th>
                  <th className="px-3 py-2 text-left">Unidades</th>
                  <th className="px-3 py-2 text-right">Itens</th>
                  <th className="px-3 py-2 text-right">Qtd total</th>
                  <th className="px-3 py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {!loading && gruposComKit.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-6 text-center text-[11px] text-muted"
                    >
                      Nenhuma função com kit cadastrada para os filtros atuais.
                    </td>
                  </tr>
                )}
                {gruposComKit.map((g) => {
                  const isSelected = g.funcao === selectedFuncao;
                  return (
                    <tr
                      key={g.funcao}
                      className={`border-t border-border/60 ${
                        isSelected ? 'bg-emerald-500/10' : ''
                      }`}
                    >
                      <td className="px-3 py-2 align-top">
                        <div className="font-semibold">{g.funcao}</div>
                      </td>
                      <td className="px-3 py-2 align-top whitespace-normal break-words">
                        {g.unidades.length ? (
                          <span className="text-[11px] leading-snug">{g.unidades.join(' / ')}</span>
                        ) : (
                          <span className="text-muted">Sem unidade vinculada</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right align-top">
                        {g.itens.length}
                      </td>
                      <td className="px-3 py-2 text-right align-top">
                        {g.totalQtd}
                      </td>
                      <td className="px-3 py-2 text-right align-top">
                        <button
                          type="button"
                          className={`rounded border border-border px-2 py-1 text-[10px] ${
                            isSelected
                              ? 'bg-emerald-600 text-white'
                              : 'hover:bg-emerald-500/10'
                          }`}
                          onClick={() => setSelectedFuncao(g.funcao)}
                        >
                          {isSelected ? 'Selecionada' : 'Ver kit'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detalhes do kit da função selecionada */}
        <div className="rounded-xl border border-border bg-panel text-xs lg:basis-5/12">
          <div className="border-b border-border px-4 py-3">
            <div className="text-sm font-semibold">
              {funcaoSelecionada ? funcaoSelecionada.funcao : 'Detalhamento do kit'}
            </div>
            <div className="text-[11px] text-muted">
              {funcaoSelecionada
                ? 'Lista completa de EPIs previstos para a função selecionada.'
                : 'Selecione uma função ao lado para visualizar o kit correspondente.'}
            </div>
          </div>

          {!funcaoSelecionada && (
            <div className="p-6 text-center text-[11px] text-muted">
              Nenhuma função selecionada. Escolha uma função na tabela ao lado.
            </div>
          )}

          {funcaoSelecionada && (
            <div className="overflow-x-auto rounded-b-xl border-t border-border bg-card">
              <table className="min-w-full text-[11px]">
                <thead className="bg-white/5 text-[10px] uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-3 py-2 text-left">EPI</th>
                    <th className="px-3 py-2 text-right">Quantidade</th>
                    <th className="px-3 py-2 text-left">Unidade de entrega</th>
                  </tr>
                </thead>
                <tbody>
                  {funcaoSelecionada.itens
                    .filter((it) => {
                      const nome = normalizarTexto(it.item).toUpperCase();
                      const qtd = Number(it.quantidade) || 0;
                      if (!nome || nome === 'SEM EPI') return false;
                      if (qtd <= 0) return false;
                      return true;
                    })
                    .map((item, index) => (
                      <tr
                        key={funcaoSelecionada.funcao + '-' + index}
                        className="border-t border-border/60"
                      >
                        <td className="px-3 py-2 align-top">{item.item}</td>
                        <td className="px-3 py-2 text-right align-top">
                          {Number(item.quantidade) || 0}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {normalizarTexto(item.unidade) || '-'}
                        </td>
                      </tr>
                    ))}
                  {funcaoSelecionada.itens.filter((it) => {
                    const nome = normalizarTexto(it.item).toUpperCase();
                    const qtd = Number(it.quantidade) || 0;
                    if (!nome || nome === 'SEM EPI') return false;
                    if (qtd <= 0) return false;
                    return true;
                  }).length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-3 py-6 text-center text-[11px] text-muted"
                      >
                        Esta função está cadastrada apenas como &quot;SEM EPI&quot; ou com
                        quantidades zeradas no mapa. Não há kit definido.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
