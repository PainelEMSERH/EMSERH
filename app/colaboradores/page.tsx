'use client'
import { useEffect, useState } from 'react'
import AppShell from '@/components/AppShell'

function SearchIcon(props: React.SVGProps<SVGSVGElement>){
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...props}>
      <path d="M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

type Row = {
  id: string, nome: string, matricula: string, email?: string|null, telefone?: string|null, status: string,
  funcaoId: string, funcao: string, unidadeId: string, unidade: string, regionalId: string, regional: string
}
type Opt = { id: string, nome: string }

async function json<T>(res: Response){ if(!res.ok) throw new Error('http'); return res.json() as Promise<T> }

export default function ColaboradoresPage(){
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(20)
  const [q, setQ] = useState('')
  const [regionais, setRegionais] = useState<Opt[]>([])
  const [unidades, setUnidades] = useState<Opt[]>([])
  const [regionalId, setRegionalId] = useState('')
  const [unidadeId, setUnidadeId] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)

  async function loadOptions(){
    const o = await fetch('/api/colaboradores/options', { cache: 'no-store' }).then(json<{ok:boolean, regionais:Opt[], funcoes:Opt[]}>)
    if(o.ok){ setRegionais(o.regionais as any) }
    const u = await fetch('/api/colaboradores/unidades', { cache: 'no-store' }).then(json<{ok:boolean, unidades:Opt[]}>)
    if(u.ok) setUnidades(u.unidades as any)
  }
  async function load(){
    setLoading(true)
    const params = new URLSearchParams({ page:String(page), size:String(size) })
    if(q) params.set('q', q)
    if(regionalId) params.set('regionalId', regionalId)
    if(unidadeId) params.set('unidadeId', unidadeId)
    if(status) params.set('status', status)
    const r = await fetch('/api/colaboradores/list?'+params.toString(), { cache: 'no-store' }).then(json<{ok:boolean, rows:Row[], total:number, page:number, size:number}>)
    if(r.ok){ setRows(r.rows); setTotal(r.total) } else { setRows([]); setTotal(0) }
    setLoading(false)
  }
  useEffect(()=>{ loadOptions() },[])
  useEffect(()=>{ load() },[page, size, q, regionalId, unidadeId, status])

  async function onChangeRegional(id:string){
    setRegionalId(id); setUnidadeId('')
    const u = await fetch('/api/colaboradores/unidades?regionalId='+encodeURIComponent(id||''), { cache: 'no-store' })
      .then(json<{ok:boolean, unidades:Opt[]}>)
    if(u.ok) setUnidades(u.unidades as any)
  }

  async function move(id:string){
    const nova = prompt('Mover para unidade (cole o ID da unidade):\n'+unidades.map(u=>`${u.nome} — ${u.id}`).join('\n'))
    if(!nova) return
    const res = await fetch('/api/colaboradores/move', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ colaboradorId: id, novaUnidadeId: nova }) }).then(r=>r.json())
    if(res.ok){ alert('Movido com sucesso'); load() } else { alert('Falha ao mover') }
  }
  async function situacao(id:string){
    const tipo = prompt('Tipo (afastamento, ferias, licenca_maternidade, licenca_medica, outro):')
    if(!tipo) return
    const inicio = prompt('Início (YYYY-MM-DD):', new Date().toISOString().substring(0,10))
    if(!inicio) return
    const fim = prompt('Fim (YYYY-MM-DD) — opcional:') || null
    const res = await fetch('/api/colaboradores/situacao', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ colaboradorId: id, tipo, inicio, fim }) }).then(r=>r.json())
    if(res.ok){ alert('Situação registrada'); } else { alert('Falha ao registrar situação') }
  }
  async function toggle(id:string, cur:string){
    const novo = cur === 'ativo' ? 'inativo' : 'ativo'
    const res = await fetch('/api/colaboradores/status', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ colaboradorId: id, status: novo }) }).then(r=>r.json())
    if(res.ok){ load() } else { alert('Falha ao atualizar status') }
  }

  return (
    <AppShell>
      <div className="space-y-4">
        <div className="rounded-2xl bg-slate-900/40 ring-1 ring-slate-800 p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative">
              <SearchIcon className="absolute left-2 top-2 opacity-60" />
              <input value={q} onChange={e=>{ setQ(e.target.value); setPage(1) }}
                placeholder="Buscar por nome ou matrícula" className="pl-8 pr-3 py-2 rounded-xl bg-slate-800 text-sm outline-none ring-1 ring-slate-700 focus:ring-sky-500" />
            </div>
            <select value={regionalId} onChange={e=>onChangeRegional(e.target.value)} className="px-3 py-2 rounded-xl bg-slate-800 text-sm ring-1 ring-slate-700">
              <option value="">Todas as regionais</option>
              {regionais.map(r=><option key={r.id} value={r.id}>{r.nome}</option>)}
            </select>
            <select value={unidadeId} onChange={e=>{ setUnidadeId(e.target.value); setPage(1) }} className="px-3 py-2 rounded-xl bg-slate-800 text-sm ring-1 ring-slate-700 max-w-[320px]">
              <option value="">Todas as unidades</option>
              {unidades.map(u=><option key={u.id} value={u.id}>{u.nome}</option>)}
            </select>
            <select value={status} onChange={e=>{ setStatus(e.target.value); setPage(1) }} className="px-3 py-2 rounded-xl bg-slate-800 text-sm ring-1 ring-slate-700">
              <option value="">Todos status</option>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </div>
        </div>

        <div className="rounded-2xl bg-slate-900/40 ring-1 ring-slate-800">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-800/60">
                <tr className="text-left">
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Matrícula</th>
                  <th className="px-4 py-3">Função</th>
                  <th className="px-4 py-3">Regional</th>
                  <th className="px-4 py-3">Unidade</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="px-4 py-16 text-center text-slate-400">Carregando…</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-16 text-center text-slate-400">Nenhum colaborador encontrado.</td></tr>
                ) : rows.map(r => (
                  <tr key={r.id} className="border-t border-slate-800">
                    <td className="px-4 py-3 font-medium">{r.nome}</td>
                    <td className="px-4 py-3">{r.matricula}</td>
                    <td className="px-4 py-3">{r.funcao}</td>
                    <td className="px-4 py-3">{r.regional || '-'}</td>
                    <td className="px-4 py-3">{r.unidade}</td>
                    <td className="px-4 py-3">
                      <span className={"px-2 py-1 rounded-full text-xs " + (r.status==='ativo'?'bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-600/40':'bg-rose-500/15 text-rose-300 ring-1 ring-rose-600/40')}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={()=>move(r.id)} className="px-2 py-1 rounded-lg ring-1 ring-slate-700 hover:ring-sky-500">Mover</button>
                        <button onClick={()=>situacao(r.id)} className="px-2 py-1 rounded-lg ring-1 ring-slate-700 hover:ring-sky-500">Situação</button>
                        <button onClick={()=>toggle(r.id, r.status)} className="px-2 py-1 rounded-lg ring-1 ring-slate-700 hover:ring-sky-500">{r.status==='ativo'?'Desligar':'Reativar'}</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between p-4 border-t border-slate-800">
            <div className="text-xs opacity-70">Total: {total}</div>
            <div className="flex items-center gap-2">
              <button disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-1 rounded-lg ring-1 ring-slate-700 disabled:opacity-40">Anterior</button>
              <div className="text-xs">pág. {page}</div>
              <button disabled={(page*size)>=total} onClick={()=>setPage(p=>p+1)} className="px-3 py-1 rounded-lg ring-1 ring-slate-700 disabled:opacity-40">Próxima</button>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
