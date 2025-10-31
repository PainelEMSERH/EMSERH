'use client';

import React from 'react';

export default function EntregasPage() {
  // Esta página assume que o AppShell já vem do layout do grupo (ex.: app/(app)/layout.tsx).
  // Se o menu lateral/cabeçalho não aparecerem, mova esta pasta para o MESMO route group
  // onde estão dashboard/colaboradores (ex.: app/(panel)/entregas) e remova outras cópias de /entregas.

  return (
    <div className="p-6 space-y-6">
      {/* Título */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h1 className="text-2xl font-semibold">Entregas</h1>
        <p className="mt-1 text-sm text-gray-400">
          Registre e acompanhe as entregas de EPI por colaborador. (WIP)
        </p>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="col-span-1 md:col-span-2">
            <input
              type="text"
              placeholder="Buscar por nome ou matrícula"
              className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 outline-none focus:ring-2 focus:ring-white/20"
            />
          </div>
          <select className="rounded-lg bg-black/30 border border-white/10 px-3 py-2">
            <option>Todas as regionais</option>
          </select>
          <select className="rounded-lg bg-black/30 border border-white/10 px-3 py-2">
            <option>Todas as unidades</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="min-w-full overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-300">Nome</th>
                <th className="px-4 py-3 text-left font-medium text-gray-300">Matrícula</th>
                <th className="px-4 py-3 text-left font-medium text-gray-300">Função</th>
                <th className="px-4 py-3 text-left font-medium text-gray-300">Regional</th>
                <th className="px-4 py-3 text-left font-medium text-gray-300">Unidade</th>
                <th className="px-4 py-3 text-left font-medium text-gray-300">Ações</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-400">
                  Nenhum registro por enquanto.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
