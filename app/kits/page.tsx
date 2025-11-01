"use client";

import React, { useEffect, useState } from "react";

type Row = { id: string; nome: string; descricao: string; composicao: string };

export default function KitsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/kits/list", { cache: "no-store" });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error || "Falha ao carregar kits");
        setRows(json.data as Row[]);
      } catch (e: any) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <section className="space-y-3">
      <div className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-5">
        <h1 className="text-xl font-semibold">Kits</h1>
        <p className="mt-1 text-sm text-slate-400">Lista de kits cadastrados e sua composição.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800/60">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-900/60 text-left text-slate-300">
            <tr>
              <th className="px-4 py-3">Kit</th>
              <th className="px-4 py-3">Descrição</th>
              <th className="px-4 py-3">Composição</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-950/30">
            {loading && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-slate-400">
                  Carregando...
                </td>
              </tr>
            )}
            {error && !loading && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-red-400">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-slate-400">
                  Nenhum kit encontrado.
                </td>
              </tr>
            )}
            {!loading &&
              !error &&
              rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-900/40">
                  <td className="px-4 py-3 font-medium text-slate-100">{r.nome}</td>
                  <td className="px-4 py-3 text-slate-300">{r.descricao || "-"}</td>
                  <td className="px-4 py-3 text-slate-300">{r.composicao || "-"}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
