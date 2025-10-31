'use client';

import React, { useEffect, useMemo, useState } from 'react'
import AppShell from '@/components/AppShell'

type Row = {
  matricula: string
  nome: string
  funcao: string
  regional: string
  unidade: string
  status: 'ativo' | 'inativo'
}

export default function ColaboradoresPage() {
  const [q, setQ] = useState('')
  const [regional, setRegional] = useState('')
  const [unidade, setUnidade] = useState('')
  const [status, setStatus] = useState<'ativo' | 'inativo' | ''>('')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)

  async function load(p = page) {
    setLoading(true)
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (regional) params.set('regional', regional)
    if (unidade) params.set('unidade', unidade)
    if (status) params.set('status', status)
    params.set('page', String(p))
    params.set('size', String(size))
    const res = await fetch(`/api/colaboradores/list?${params.toString()}`, { cache: 'no-store' })
    const json = await res.json()
    if (json?.ok) {
      setRows(json.rows || [])
      setTotal(json.total || 0)
      setPage(json.page || 1)
    } else {
      setRows([])
      setTotal(0)
    }
    setLoading(false)
  }

  useEffect(() => { load(1) }, [q, regional, unidade, status, size])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / size)), [total, size])

  return (
    <AppShell active="colaboradores">
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <input
            className="w-full sm:w-1/3 rounded-md bg-gray-900/40 border border-gray-700 px-3 py-2 outline-none focus:border-blue-500"
            placeholder="Buscar por nome, CPF, função..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="rounded-md bg-gray-900/40 border border-gray-700 px-3 py-2" value={regional} onChange={e=>setRegional(e.target.value)}>
            <option value="">Todas as regionais</option>
            <option value="NORTE">Norte</option>
            <option value="SUL">Sul</option>
            <option value="LESTE">Leste</option>
            <option value="CENTRO">Centro</option>
          </select>
          <input className="rounded-md bg-gray-900/40 border border-gray-700 px-3 py-2" placeholder="Filtrar por unidade" value={unidade} onChange={e=>setUnidade(e.target.value)} />
          <select className="rounded-md bg-gray-900/40 border border-gray-700 px-3 py-2" value={status} onChange={e=>setStatus(e.target.value as any)}>
            <option value="">Todos status</option>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-800">
          <table className="min-w-full divide-y divide-gray-800 text-sm">
            <thead className="bg-gray-900/30">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Nome</th>
                <th className="px-4 py-3 text-left font-semibold">Matrícula</th>
                <th className="px-4 py-3 text-left font-semibold">Função</th>
                <th className="px-4 py-3 text-left font-semibold">Regional</th>
                <th className="px-4 py-3 text-left font-semibold">Unidade</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-4 py-3"><div className="h-3 w-40 bg-gray-800 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-28 bg-gray-800 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-48 bg-gray-800 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-20 bg-gray-800 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-3 w-40 bg-gray-800 rounded" /></td>
                    <td className="px-4 py-3"><div className="h-6 w-14 bg-gray-800 rounded-full" /></td>
                    <td className="px-4 py-3"><div className="h-8 w-40 bg-gray-800 rounded" /></td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400">Nenhum colaborador encontrado.</td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr key={`${r.matricula}-${idx}`} className="hover:bg-gray-900/30">
                    <td className="px-4 py-3">{r.nome}</td>
                    <td className="px-4 py-3">{r.matricula}</td>
                    <td className="px-4 py-3">{r.funcao}</td>
                    <td className="px-4 py-3">{r.regional}</td>
                    <td className="px-4 py-3">{r.unidade}</td>
                    <td className="px-4 py-3">
                      <span className={r.status === 'ativo'
                        ? 'inline-flex items-center rounded-full bg-emerald-500/10 text-emerald-400 px-2 py-0.5 text-xs font-medium'
                        : 'inline-flex items-center rounded-full bg-rose-500/10 text-rose-400 px-2 py-0.5 text-xs font-medium'}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button className="rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 px-3 py-1 text-xs">Mover</button>
                        <button className="rounded-md bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 px-3 py-1 text-xs">Situação</button>
                        {r.status === 'inativo' ? (
                          <button className="rounded-md bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 px-3 py-1 text-xs">Reativar</button>
                        ) : (
                          <button className="rounded-md bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 px-3 py-1 text-xs">Desligar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-gray-400">Total: {total}</div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => { const p = Math.max(1, page - 1); load(p) }}
              className="rounded-md border border-gray-700 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-400">pág. {page}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => { const p = Math.min(totalPages, page + 1); load(p) }}
              className="rounded-md border border-gray-700 px-3 py-1.5 text-sm disabled:opacity-40"
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    </AppShell>
  )
}