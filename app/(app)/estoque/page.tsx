'use client';
import React, {useEffect, useMemo, useState} from 'react';

type Row = { id:string; regionalId:string; regional:string; unidadeId:string; unidade:string; itemId:string; item:string; quantidade:number; minimo:number; maximo:number };

type Opts = { regionais:string[]; unidades:{unidade:string, regional:string}[] };
async function fetchJSON<T>(u:string){ const r = await fetch(u, {cache:'no-store'}); if(!r.ok) throw new Error('Falha'); return r.json() as Promise<T>; }
export default function Page(){
  const [regional,setRegional] = useState(''); const [unidade,setUnidade] = useState(''); const [q,setQ] = useState('');
  const [rows,setRows] = useState<Row[]>([]); const [total,setTotal] = useState(0); const [page,setPage] = useState(1); const [size,setSize] = useState(25);
  const [opts,setOpts] = useState<Opts>({regionais:[],unidades:[]});
  useEffect(()=>{ fetchJSON<Opts>('/api/entregas/options').then(setOpts).catch(()=>{}); },[]);
  useEffect(()=>{ let mounted=true; const url = `/api/estoque/list?regionalId=${encodeURIComponent(regional)}&unidadeId=${encodeURIComponent(unidade)}&q=${encodeURIComponent(q)}&page=${page}&size=${size}`; fetchJSON<{rows:Row[], total:number}>(url).then(d=>{ if(mounted){ setRows(d.rows||[]); setTotal(d.total||0); }}); return ()=>{mounted=false}; },[regional,unidade,q,page,size]);
  const unidadesFiltradas = useMemo(()=> opts.unidades.filter(u=>!regional || u.regional===regional),[opts,regional]);
  return (
    <div className='p-6 space-y-4'>
      <div className='rounded-xl border border-white/10 bg-[#0f172a] p-4'>
        <h1 className='text-xl font-semibold mb-1'>Estoque</h1>
        <p className='text-sm text-white/60 mb-3'>Visão de estoque por Regional / Unidade com alertas de mínimo.</p>
        <div className='grid grid-cols-1 md:grid-cols-4 gap-2'>
          <input className='px-3 py-2 rounded bg-black/20 border border-white/10' placeholder='Buscar item/unidade' value={q} onChange={e=>{setQ(e.target.value); setPage(1)}}/>
          <select className='px-3 py-2 rounded bg-black/20 border border-white/10' value={regional} onChange={e=>{setRegional(e.target.value); setPage(1)}}>
            <option value=''>Todas as Regionais</option>
            {opts.regionais.map(r=> <option key={r} value={r}>{r}</option>)}
          </select>
          <select className='px-3 py-2 rounded bg-black/20 border border-white/10' value={unidade} onChange={e=>{setUnidade(e.target.value); setPage(1)}}>
            <option value=''>Todas as Unidades</option>
            {unidadesFiltradas.map(u=> <option key={u.unidade} value={u.unidade}>{u.unidade}</option>)}
          </select>
        </div>
      </div>
      <div className='rounded-xl border border-white/10 bg-[#0f172a]'>
        <div className='overflow-x-auto'>
          <table className='min-w-full text-sm'>
            <thead className='bg-white/5'><tr>
              <th className='px-3 py-2 text-left'>Regional</th>
              <th className='px-3 py-2 text-left'>Unidade</th>
              <th className='px-3 py-2 text-left'>Item</th>
              <th className='px-3 py-2 text-right'>Qtd</th>
              <th className='px-3 py-2 text-right'>Mín</th>
              <th className='px-3 py-2 text-right'>Máx</th>
            </tr></thead>
            <tbody>
              {rows.map(r=>{
                const low = r.minimo>0 && r.quantidade < r.minimo;
                return (
                  <tr key={r.id} className={'border-t border-white/10 '+(low?'bg-red-500/5':'hover:bg-white/5')}>
                    <td className='px-3 py-2'>{r.regional}</td>
                    <td className='px-3 py-2'>{r.unidade}</td>
                    <td className='px-3 py-2'>{r.item}</td>
                    <td className='px-3 py-2 text-right'>{r.quantidade}</td>
                    <td className='px-3 py-2 text-right'>{r.minimo}</td>
                    <td className='px-3 py-2 text-right'>{r.maximo}</td>
                  </tr>
                )
              })}
              {rows.length===0 && (
                <tr><td colSpan={6} className='px-3 py-6 text-center text-white/60'>Nenhum registro</td></tr>
              )}
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
