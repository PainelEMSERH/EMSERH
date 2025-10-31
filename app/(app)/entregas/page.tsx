"use client";

import React, { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";

type Row = {
  cpf: string;
  nome: string;
  funcao: string;
  regional: string | null;
  unidade: string | null;
  item: string;
  quantidade: number;
  entregasNoAno: number;
};

type ListResponse = {
  ok: boolean;
  rows: Row[];
  total: number;
  page: number;
  size: number;
  regions: string[];
  units: string[];
};

export default function EntregasPage() {
  return (
    <AppShell>
      <div className="space-y-4">
        <header className="bg-[#0f1629] border border-gray-800 rounded-lg px-6 py-5">
          <h1 className="text-2xl font-semibold">Entregas</h1>
          <p className="text-gray-400 text-sm">
            Liste colaboradores elegíveis por função (mapeada em <code>stg_epi_map</code>), filtre por
            Regional/Unidade e registre as entregas de EPI aqui mesmo.
          </p>
        </header>
        <ClientTable />
      </div>
    </AppShell>
  );
}

function ClientTable() {
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState("");
  const [regional, setRegional] = useState<string>("");
  const [unidade, setUnidade] = useState<string>("");
  const [status, setStatus] = useState<string>("todos"); // todos | pendente | entregue
  const [regions, setRegions] = useState<string[]>([]);
  const [units, setUnits] = useState<string[]>([]);
  const [year, setYear] = useState<number>(new Date().getFullYear());

  const params = useMemo(() => {
    const u = new URLSearchParams();
    u.set("page", String(page));
    u.set("size", String(size));
    u.set("year", String(year));
    if (q) u.set("q", q);
    if (regional) u.set("regional", regional);
    if (unidade) u.set("unidade", unidade);
    if (status) u.set("status", status);
    return u.toString();
  }, [page, size, q, regional, unidade, status, year]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/entregas/list?${params}`)
      .then((r) => r.json())
      .then((resp: ListResponse) => {
        if (resp.ok) {
          setData(resp.rows);
          setTotal(resp.total);
          if (resp.regions) setRegions(resp.regions);
          if (resp.units) setUnits(resp.units);
        } else {
          console.error(resp);
        }
      })
      .finally(() => setLoading(false));
  }, [params]);

  const maxPage = Math.max(1, Math.ceil(total / size));

  async function entregar(row: Row) {
    const body = {
      cpf: row.cpf,
      nome: row.nome,
      funcao: row.funcao,
      regional: row.regional,
      unidade: row.unidade,
      item: row.item,
      quantidade: row.quantidade,
      year,
    };
    const res = await fetch("/api/entregas/registrar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    if (!j.ok) {
      alert(j.error || "Falha ao registrar entrega");
      return;
    }
    // refresh
    fetch(`/api/entregas/list?${params}`)
      .then((r) => r.json())
      .then((resp: ListResponse) => {
        if (resp.ok) {
          setData(resp.rows);
          setTotal(resp.total);
        }
      });
  }

  return (
    <div className="bg-[#0b1220] border border-gray-800 rounded-lg p-4">
      {/* filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nome, CPF, função, unidade..."
          className="px-3 py-2 rounded-md bg-[#0f1629] border border-gray-800 w-72 outline-none"
        />
        <select
          value={regional}
          onChange={(e) => {
            setRegional(e.target.value);
            setUnidade("");
            setPage(1);
          }}
          className="px-3 py-2 rounded-md bg-[#0f1629] border border-gray-800"
        >
          <option value="">Todas as regionais</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={unidade}
          onChange={(e) => {
            setUnidade(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-md bg-[#0f1629] border border-gray-800"
        >
          <option value="">Todas as unidades</option>
          {units
            .filter((u) => !regional || u.startsWith(regional + " :: "))
            .map((u) => (
              <option key={u} value={u.split(" :: ").slice(-1)[0]}>
                {u.split(" :: ").slice(-1)[0]}
              </option>
            ))}
        </select>

        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="px-3 py-2 rounded-md bg-[#0f1629] border border-gray-800"
        >
          <option value="todos">Todos status</option>
          <option value="pendente">Pendentes</option>
          <option value="entregue">Entregues no ano</option>
        </select>

        <select
          value={size}
          onChange={(e) => {
            setSize(parseInt(e.target.value));
            setPage(1);
          }}
          className="px-3 py-2 rounded-md bg-[#0f1629] border border-gray-800"
        >
          {[10, 20, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}/pág
            </option>
          ))}
        </select>

        <select
          value={year}
          onChange={(e) => {
            setYear(parseInt(e.target.value));
            setPage(1);
          }}
          className="px-3 py-2 rounded-md bg-[#0f1629] border border-gray-800"
        >
          {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <div className="ml-auto text-sm text-gray-400">
          Total: <span className="font-semibold text-gray-200">{total}</span>
        </div>
      </div>

      {/* tabela */}
      <div className="overflow-x-auto rounded-md border border-gray-800">
        <table className="min-w-full text-sm">
          <thead className="bg-[#0f1629]">
            <tr className="text-left text-gray-400">
              <th className="px-3 py-2">Nome</th>
              <th className="px-3 py-2">Função</th>
              <th className="px-3 py-2">Regional</th>
              <th className="px-3 py-2">Unidade</th>
              <th className="px-3 py-2">Item</th>
              <th className="px-3 py-2">Qtd</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && data.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-gray-400">
                  Nenhum registro encontrado.
                </td>
              </tr>
            )}
            {!loading &&
              data.map((r, idx) => (
                <tr key={`${r.cpf}-${r.item}-${idx}`} className="border-t border-gray-800">
                  <td className="px-3 py-2 text-gray-100">{r.nome}</td>
                  <td className="px-3 py-2 text-gray-300">{r.funcao}</td>
                  <td className="px-3 py-2">{r.regional || "-"}</td>
                  <td className="px-3 py-2">{r.unidade || "-"}</td>
                  <td className="px-3 py-2">{r.item}</td>
                  <td className="px-3 py-2">{r.quantidade}</td>
                  <td className="px-3 py-2">
                    {r.entregasNoAno > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-900/40 text-emerald-300 px-2 py-0.5">
                        entregue
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-900/40 text-yellow-300 px-2 py-0.5">
                        pendente
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      className="px-3 py-1 rounded-md border border-gray-700 hover:border-gray-500 disabled:opacity-50"
                      disabled={r.entregasNoAno > 0}
                      onClick={() => entregar(r)}
                      title={r.entregasNoAno > 0 ? "Já entregue no ano" : "Registrar entrega"}
                    >
                      Entregar
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* paginação */}
      <div className="flex items-center justify-between mt-3 text-sm">
        <div className="text-gray-400">
          Página {page} de {maxPage}
        </div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 rounded-md border border-gray-700 hover:border-gray-500 disabled:opacity-50"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            Anterior
          </button>
          <button
            className="px-3 py-1 rounded-md border border-gray-700 hover:border-gray-500 disabled:opacity-50"
            onClick={() => setPage((p) => Math.min(maxPage, p + 1))}
            disabled={page >= maxPage}
          >
            Próxima
          </button>
        </div>
      </div>
    </div>
  );
}
