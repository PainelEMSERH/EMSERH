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

export default function KitsPage() {
  const [q, setQ] = useState('');
  const [unidade, setUnidade] = useState('');
  const [rows, setRows] = useState<KitRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 100;
  const [loading, setLoading] = useState(false);

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

  const agrupado = useMemo(() => {
    const map = new Map<string, KitRow[]>();

    rows.forEach((row) => {
      const key = row.funcao || 'SEM FUNÇÃO';
      const atual = map.get(key) || [];
      atual.push(row);
      map.set(key, atual);
    });

    const result = Array.from(map.entries()).map(([funcao, itens]) => {
      const totalQtd = itens.reduce((acc, it) => acc + (Number(it.quantidade) || 0), 0);
      const unidadesSet = new Set<string>();
      itens.forEach((it) => {
        if (it.unidade) {
          unidadesSet.add(it.unidade);
        }
      });
      const unidadesList = Array.from(unidadesSet);
      return {
        funcao,
        itens,
        totalQtd,
        unidades: unidadesList,
      };
    });

    result.sort((a, b) => a.funcao.localeCompare(b.funcao, 'pt-BR'));

    return result;
  }, [rows]);

  const totalFuncoes = useMemo(() => agrupado.length, [agrupado]);
  const totalItens = useMemo(() => rows.length, [rows]);

  const totalPages = useMemo(() => {
    if (total <= 0) return 1;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [total, pageSize]);

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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold">Mapa de kits por função</h1>
          <p className="text-xs text-muted">
            Consulta dos EPIs previstos por função, com base no mapa oficial de EPIs por função (stg_epi_map).
          </p>
        </div>
      </div>

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
              placeholder="Nome da unidade (ex.: HOSPITAL REGIONAL DE ...)"
              value={unidade}
              onChange={(e) => {
                setPage(1);
                setUnidade(e.target.value);
              }}
            />
          </div>

          <div className="flex flex-col justify-end gap-1 text-[11px]">
            <div>
              <span className="text-muted">Funções encontradas: </span>
              <span className="font-semibold">{totalFuncoes}</span>
            </div>
            <div>
              <span className="text-muted">Linhas de kit nesta página: </span>
              <span className="font-semibold">{totalItens}</span>
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
            Carregando kits...
          </div>
        )}
      </div>

      {agrupado.length === 0 && !loading && (
        <div className="rounded-xl border border-border bg-panel p-6 text-center text-xs text-muted">
          Nenhum kit encontrado para os filtros informados.
        </div>
      )}

      {agrupado.map((grupo) => (
        <div key={grupo.funcao} className="rounded-xl border border-border bg-panel text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div>
              <div className="text-sm font-semibold">{grupo.funcao}</div>
              {grupo.unidades.length > 0 && (
                <div className="text-[11px] text-muted">
                  Unidades com este kit: {grupo.unidades.join(' / ')}
                </div>
              )}
            </div>
            <div className="text-right text-[11px] text-muted">
              <div>
                Itens no kit:{' '}
                <span className="font-semibold">{grupo.itens.length}</span>
              </div>
              <div>
                Quantidade total:{' '}
                <span className="font-semibold">{grupo.totalQtd}</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto rounded-b-xl bg-card">
            <table className="min-w-full text-[11px]">
              <thead className="bg-white/5 text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 text-left">EPI</th>
                  <th className="px-3 py-2 text-right">Quantidade</th>
                  <th className="px-3 py-2 text-left">Unidade de entrega</th>
                </tr>
              </thead>
              <tbody>
                {grupo.itens.map((item, index) => (
                  <tr key={grupo.funcao + '-' + index} className="border-t border-border/60">
                    <td className="px-3 py-2 align-top">{item.item}</td>
                    <td className="px-3 py-2 text-right align-top">
                      {Number(item.quantidade) || 0}
                    </td>
                    <td className="px-3 py-2 align-top">{item.unidade || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-2 text-[11px]">
          <div>
            Página{' '}
            <span className="font-semibold">
              {page} / {totalPages}
            </span>
          </div>
          <div className="inline-flex items-center gap-1">
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
        </div>
      )}
    </div>
  );
}
