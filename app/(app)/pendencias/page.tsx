'use client';
import React, {useEffect, useState} from 'react';

type Row = { id:string; colaboradorId:string; colaborador:string; itemId:string; item:string; quantidade:number; status:string; abertaEm:string; prazo?:string; atendidaEm?:string };
async function fetchJSON<T>(u:string){ const r = await fetch(u, {cache:'no-store'}); if(!r.ok) throw new Error('Falha'); return r.json() as Promise<T>; }
export default function Page(){
  const [status,setStatus] = useState(''); const [q,setQ] = useState(''); const [rows,setRows] = useState<Row[]>([]); const [total,setTotal] = useState(0); const [page,setPage] = useState(1); const [size,setSize] = useState(25);
  useEffect(()=>{ let mounted=true; fetchJSON<{rows:Row[], total:number}>(`/api/pendencias/list?status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}&page=${page}&size=${size}`).then(d=>{ if(mounted){ setRows(d.rows||[]); setTotal(d.total||0)} }); return ()=>{mounted=false}; },[status,q,page,size]);
  return (
    <div className='p-6 space-y-4'>
      <div className='rounded-xl border border-white/10 bg-[#0f172a] p-4'>
        <h1 className='text-xl font-semibold mb-1'>Pendências</h1>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-2'>
          <input className='px-3 py-2 rounded bg-black/20 border border-white/10' placeholder='Buscar colaborador/item' value={q} onChange={e=>{setQ(e.target.value); setPage(1)}}/>
          <select className='px-3 py-2 rounded bg-black/20 border border-white/10' value={status} onChange={e=>{setStatus(e.target.value); setPage(1)}}>
            <option value=''>Todos os status</option>
            <option value='aberta'>Aberta</option>
            <option value='atendida'>Atendida</option>
          </select>
        </div>
      </div>
      <div className='rounded-xl border border-white/10 bg-[#0f172a]'>
        <div className='overflow-x-auto'>
          <table className='min-w-full text-sm'>
            <thead className='bg-white/5'><tr>
              <th className='px-3 py-2 text-left'>Colaborador</th>
              <th className='px-3 py-2 text-left'>Item</th>
              <th className='px-3 py-2 text-right'>Quantidade</th>
              <th className='px-3 py-2 text-left'>Status</th>
              <th className='px-3 py-2 text-left'>Prazo</th>
              <th className='px-3 py-2 text-left'>Aberta em</th>
            </tr></thead>
            <tbody>
              {rows.map(r=> (
                <tr key={r.id} className='border-t border-white/10 hover:bg-white/5'>
                  <td className='px-3 py-2'>{r.colaborador}</td>
                  <td className='px-3 py-2'>{r.item}</td>
                  <td className='px-3 py-2 text-right'>{r.quantidade}</td>
                  <td className='px-3 py-2 capitalize'>{r.status}</td>
                  <td className='px-3 py-2'>{r.prazo ? new Date(r.prazo).toLocaleDateString() : '-'}</td>
                  <td className='px-3 py-2'>{new Date(r.abertaEm).toLocaleDateString()}</td>
                </tr>
              ))}
              {rows.length===0 && <tr><td colSpan={6} className='px-3 py-6 text-center text-white/60'>Sem pendências</td></tr>}
            </tbody>
          </table>
        </div>
        <div className='flex items-center justify-between p-3 text-xs text-white/70'>
          <div>Total: {total}</div>
          <div className='flex items-center gap-2'>
            <button className='px-2 py-1 border border-white/10 rounded disabled:opacity-40' onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>Anterior</button>
            <div>Página {page}</div>
            <button className='px-2 py-1 border border-white/10 rounded disabled:opacity-40' onClick={()=>setPage(p=>p+1)} disabled={rows.length<size}>Próxima</button>
          </div>
        </div>
      </div>
    </div>
  )
}
