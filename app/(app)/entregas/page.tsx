'use client'
import React, { useEffect, useMemo, useState } from 'react'
import { AppShell } from '@/components/layout/AppShell'
import { formatThousands } from '@/lib/format'

type Row = {
  cpf: string
  nome: string
  funcao: string
  regional: string
  unidade: string
  item: string | null
  qtd: number | null
  entregue: boolean
  sem_kit?: boolean
}

async function fetchList(params: Record<string,any>) {
  const sp = new URLSearchParams(params as any)
  const res = await fetch(`/api/entregas/list?` + sp.toString(), { cache: 'no-store' })
  return res.json()
}

async function registrarEntrega(payload: {cpf:string,item:string,ano:number}) {
  const res = await fetch('/api/entregas/registrar', { method:'POST', body: JSON.stringify(payload) })
  return res.json()
}

export default function EntregasPage() {
  const [q, setQ] = useState('')
  const [regional, setRegional] = useState<string | null>(null)
  const [unidade, setUnidade] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [ano, setAno] = useState<number>(new Date().getFullYear())
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(100)
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)

  const params = { q, regional, unidade, status, ano, page, perPage }

  const load = async () => {
    const data = await fetchList(params)
    if (data?.ok) { setRows(data.rows || []); setTotal(data.total || 0) }
    else { console.error(data) }
  }

  useEffect(() => { load() }, [q, regional, unidade, status, ano, page, perPage])

  const onEntregar = async (r: Row) => {
    if (!r.item) return
    const resp = await registrarEntrega({ cpf: r.cpf, item: r.item, ano })
    if (resp?.ok) load()
    else alert(resp?.error || 'Falha ao registrar entrega')
  }

  return (
    <AppShell title="Entregas" subtitle="Liste colaboradores elegíveis por função (mapeada em stg_epi_map), filtre por Regional/Unidade e registre as entregas de EPI aqui mesmo.">
      <div className="space-y-3">
        <div className="flex gap-2 items-center">
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar por nome, CPF, função, unidade" className="bg-[#0f172a] border border-[#1f2937] px-3 py-2 rounded-md w-[360px]" />
          <select value={status||''} onChange={e=>setStatus(e.target.value||null)} className="bg-[#0f172a] border border-[#1f2937] px-3 py-2 rounded-md">
            <option value="">Todos status</option>
            <option value="pendente">Pendentes</option>
            <option value="entregue">Entregues</option>
          </select>
          <select value={perPage} onChange={e=>setPerPage(parseInt(e.target.value))} className="bg-[#0f172a] border border-[#1f2937] px-3 py-2 rounded-md">
            <option value={50}>50/pág</option>
            <option value={100}>100/pág</option>
          </select>
          <select value={ano} onChange={e=>setAno(parseInt(e.target.value))} className="bg-[#0f172a] border border-[#1f2937] px-3 py-2 rounded-md">
            {Array.from({length:4}).map((_,i)=>{
              const y = new Date().getFullYear() - i
              return <option key={y} value={y}>{y}</option>
            })}
          </select>
          <div className="text-sm text-gray-400 ml-auto">Total: {formatThousands(total)}</div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#1f2937]">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-[#0b1220] text-gray-300">
                <th className="text-left px-3 py-2">Nome</th>
                <th className="text-left px-3 py-2">Função</th>
                <th className="text-left px-3 py-2">Regional</th>
                <th className="text-left px-3 py-2">Unidade</th>
                <th className="text-left px-3 py-2">Item</th>
                <th className="text-right px-3 py-2">Qtd</th>
                <th className="text-center px-3 py-2">Status</th>
                <th className="text-center px-3 py-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td className="px-3 py-6 text-center text-gray-400" colSpan={8}>
                    Nenhum registro encontrado. Dica: verifique o mapeamento de kits na tabela <b>stg_epi_map</b> (função → item, qtd).
                  </td>
                </tr>
              )}
              {rows.map((r, idx) => (
                <tr key={idx} className="border-t border-[#1f2937]">
                  <td className="px-3 py-2">{r.nome}</td>
                  <td className="px-3 py-2">{r.funcao}</td>
                  <td className="px-3 py-2">{r.regional}</td>
                  <td className="px-3 py-2">{r.unidade}</td>
                  <td className="px-3 py-2">{r.item || <span className="text-gray-500">— sem kit —</span>}</td>
                  <td className="px-3 py-2 text-right">{r.qtd ?? '—'}</td>
                  <td className="px-3 py-2 text-center">
                    {r.item ? (r.entregue ? <span className="text-green-400">entregue</span> : <span className="text-yellow-300">pendente</span>) : <span className="text-gray-500">sem kit</span>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.item ? (
                      r.entregue ? (
                        <span className="text-gray-500">—</span>
                      ) : (
                        <button onClick={()=>onEntregar(r)} className="px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700">Entregar</button>
                      )
                    ) : (
                      <span className="text-gray-500">Mapear kit</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  )
}
