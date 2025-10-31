"use client";

import React, { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/layout/AppShell";
import { formatThousands } from "@/components/utils/Utils";

type Colab = {
  cpf: string;
  colaborador: string;
  funcao: string;
  unidade_hospitalar: string;
  regional: string;
};

type Paged<T> = {
  total: number;
  page: number;
  size: number;
  items: T[];
};

type KitItem = {
  item: string;
  quantidade: number;
  nome_site: string;
};

export default function EntregasPage() {
  const [q, setQ] = useState("");
  const [regional, setRegional] = useState<string>("");
  const [unidade, setUnidade] = useState<string>("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<Paged<Colab>>({ total: 0, page: 1, size: 20, items: [] });
  const [regionais, setRegionais] = useState<string[]>([]);
  const [unidades, setUnidades] = useState<string[]>([]);

  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Colab | null>(null);
  const [kit, setKit] = useState<KitItem[]>([]);
  const [entregas, setEntregas] = useState<Record<string, number>>({}); // item -> qtd entregue
  const [salvando, setSalvando] = useState(false);
  const [obs, setObs] = useState("");

  useEffect(() => {
    const fetchFilters = async () => {
      const r = await fetch("/api/colaboradores/filters");
      if (!r.ok) return;
      const j = await r.json();
      setRegionais(j.regionais || []);
      setUnidades(j.unidades || []);
    };
    fetchFilters();
  }, []);

  const fetchPage = async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams({ page: String(page), size: String(size) });
      if (q) sp.set("q", q);
      if (regional) sp.set("regional", regional);
      if (unidade) sp.set("unidade", unidade);
      const r = await fetch(`/api/colaboradores/list?${sp.toString()}`);
      const j = await r.json();
      if (j.ok) setData(j.data);
      else setData({ total: 0, page: 1, size, items: [] });
    } catch {
      setData({ total: 0, page: 1, size, items: [] });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPage(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page, size, regional, unidade]);

  const abrirEntrega = async (c: Colab) => {
    setSel(c);
    setOpen(true);
    setEntregas({});
    setObs("");
    try {
      const r = await fetch(`/api/entregas/kit?funcao=${encodeURIComponent(c.funcao)}`);
      const j = await r.json();
      if (j.ok) setKit(j.items || []);
      else setKit([]);
    } catch {
      setKit([]);
    }
  };

  const salvarEntrega = async () => {
    if (!sel) return;
    setSalvando(true);
    try {
      const body = {
        colaborador: sel,
        itens: kit.map(k => ({
          item: k.item,
          nome_site: k.nome_site,
          qtdSolicitada: k.quantidade,
          qtdEntregue: Number(entregas[k.item] ?? 0)
        })),
        obs,
      };
      const r = await fetch("/api/entregas/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const j = await r.json();
      if (j.ok) {
        alert("Entrega registrada.");
        setOpen(false);
        fetchPage();
      } else {
        alert("Falha ao salvar: " + (j.error || "erro desconhecido"));
      }
    } catch (e:any) {
      alert("Erro ao salvar: " + e?.message);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AppShell title="Entregas">
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <input
          className="px-3 py-2 rounded bg-zinc-900 border border-zinc-700 w-80"
          placeholder="Buscar por nome, matrícula ou CPF"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); fetchPage(); } }}
        />
        <select
          className="px-3 py-2 rounded bg-zinc-900 border border-zinc-700"
          value={regional}
          onChange={(e) => { setRegional(e.target.value); setPage(1); }}
        >
          <option value="">Todas as regionais</option>
          {regionais.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          className="px-3 py-2 rounded bg-zinc-900 border border-zinc-700"
          value={unidade}
          onChange={(e) => { setUnidade(e.target.value); setPage(1); }}
        >
          <option value="">Todas as unidades</option>
          {unidades.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <button
          className="px-3 py-2 rounded bg-zinc-800 border border-zinc-700"
          onClick={() => { setPage(1); fetchPage(); }}
        >
          Filtrar
        </button>
        <div className="ml-auto text-sm opacity-70">
          {loading ? "Carregando..." : `Total: ${formatThousands(data.total || 0)}`}
        </div>
      </div>

      <div className="overflow-auto border border-zinc-800 rounded-lg">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-900/60">
            <tr className="text-left">
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Função</th>
              <th className="px-4 py-3">Regional</th>
              <th className="px-4 py-3">Unidade</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((c) => (
              <tr key={c.cpf} className="border-t border-zinc-800 hover:bg-zinc-900/30">
                <td className="px-4 py-3">{c.colaborador}</td>
                <td className="px-4 py-3">{c.funcao}</td>
                <td className="px-4 py-3">{c.regional}</td>
                <td className="px-4 py-3">{c.unidade_hospitalar}</td>
                <td className="px-4 py-3">
                  <button
                    className="px-3 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600"
                    onClick={() => abrirEntrega(c)}
                  >
                    Entregar
                  </button>
                </td>
              </tr>
            ))}
            {(!loading && data.items.length === 0) && (
              <tr><td className="px-4 py-6 text-center opacity-70" colSpan={5}>Nenhum colaborador encontrado.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Drawer simples */}
      {open && sel && (
        <div className="fixed inset-0 bg-black/60 z-30" onClick={() => setOpen(false)}>
          <div className="absolute right-0 top-0 bottom-0 w-full sm:w-[560px] bg-zinc-950 border-l border-zinc-800 p-5 overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="text-lg font-semibold">Entrega de EPI</div>
                <div className="text-xs opacity-70">{sel.colaborador} • {sel.funcao}</div>
                <div className="text-xs opacity-70">{sel.unidade_hospitalar} • {sel.regional}</div>
              </div>
              <button className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700" onClick={() => setOpen(false)}>Fechar</button>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-medium">Itens do kit</div>
              <div className="rounded border border-zinc-800 overflow-hidden">
                <table className="min-w-full text-sm">
                  <thead className="bg-zinc-900/60">
                    <tr>
                      <th className="px-3 py-2 text-left">Item</th>
                      <th className="px-3 py-2 text-right">Solicitado</th>
                      <th className="px-3 py-2 text-right">Entregue</th>
                      <th className="px-3 py-2 text-right">Pendente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kit.map((k) => {
                      const entregue = Number(entregas[k.item] ?? 0);
                      const pend = Math.max(0, Number(k.quantidade) - entregue);
                      return (
                        <tr key={k.item} className="border-t border-zinc-800">
                          <td className="px-3 py-2">{k.nome_site || k.item}</td>
                          <td className="px-3 py-2 text-right">{k.quantidade}</td>
                          <td className="px-3 py-2 text-right">
                            <input
                              type="number"
                              min={0}
                              className="px-2 py-1 w-24 text-right rounded bg-zinc-900 border border-zinc-700"
                              value={entregas[k.item] ?? ""}
                              onChange={(e) => setEntregas(prev => ({ ...prev, [k.item]: Number(e.target.value) }))}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">{pend}</td>
                        </tr>
                      );
                    })}
                    {kit.length === 0 && (
                      <tr><td className="px-3 py-4 text-center opacity-70" colSpan={4}>Sem itens mapeados para a função.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="text-sm font-medium">Observações</div>
              <textarea
                className="w-full min-h-[80px] rounded bg-zinc-900 border border-zinc-700 p-2 text-sm"
                placeholder="Observação da entrega (opcional)"
                value={obs}
                onChange={(e) => setObs(e.target.value)}
              />

              <div className="flex justify-end gap-2">
                <button className="px-3 py-2 rounded bg-zinc-800 border border-zinc-700" onClick={() => setOpen(false)}>
                  Cancelar
                </button>
                <button
                  disabled={salvando}
                  className="px-3 py-2 rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50"
                  onClick={salvarEntrega}
                >
                  {salvando ? "Salvando..." : "Salvar entrega"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
