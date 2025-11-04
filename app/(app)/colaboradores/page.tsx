'use client';
import React, {useEffect, useMemo, useState} from 'react';

type Colab = { id:string; nome:string; matricula?:string; funcao:string; unidade:string; regional:string; status?:string };
type Opts = { regionais:string[]; unidades:{unidade:string, regional:string}[] };

async function fetchJSON<T>(u:string, init?:RequestInit){
  const r = await fetch(u, {cache:'no-store', ...init});
  if(!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

export default function Page(){
  const [q,setQ] = useState('');
  const [regional,setRegional] = useState('');
  const [unidade,setUnidade] = useState('');
  const [items,setItems] = useState<Colab[]>([]);
  const [page,setPage] = useState(1);
  const [size,setSize] = useState(25);
  const [total,setTotal] = useState(0);
  const [opts,setOpts] = useState<Opts>({regionais:[],unidades:[]});
  const [loading,setLoading] = useState(false);
  const [error,setError] = useState<string | null>(null);

  useEffect(()=>{
    fetchJSON<Opts>('/api/entregas/options')
    .then(setOpts)
    .catch(()=>{});
  },[]);

  useEffect(()=>{
    let mounted=true;
    setLoading(true); setError(null);
    const url = `/api/colaboradores/list?q=${encodeURIComponent(q)}&regionalId=${encodeURIComponent(regional)}&unidadeId=${encodeURIComponent(unidade)}&page=${page}&size=${size}`;
    fetchJSON<{rows:Colab[], total:number}>(url)
      .then(d=>{ if(mounted){ setItems(d.rows||[]); setTotal(d.total||0); } })
      .catch(e=>{ if(mounted){ setError('Falha ao carregar colaboradores.'); setItems([]); setTotal(0); } })
      .finally(()=>{ if(mounted) setLoading(false); });
    return ()=>{mounted=false};
  },[q,regional,unidade,page,size]);

  const unidadesFiltradas = useMemo(()=> opts.unidades.filter(u=>!regional || u.regional===regional),[opts,regional]);

  return (
    <div className='p-6 space-y-4 text-white'>
      <div className='rounded-xl border border-border bg-panel p-4'>
        <h1 className='text-xl font-semibold mb-1'>Colaboradores</h1>
        <div className='grid grid-cols-1 md:grid-cols-4 gap-2'>
          <input className='px-3 py-2 rounded bg-card border border-border' placeholder='Buscar por nome/matrícula' value={q} onChange={e=>{setQ(e.target.value); setPage(1)}}/>
          <select className='px-3 py-2 rounded bg-card border border-border' value={regional} onChange={e=>{setRegional(e.target.value); setPage(1)}}>
            <option value=''>Todas as Regionais</option>
            {opts.regionais.map(r=> <option key={r} value={r}>{r}</option>)}
          </select>
          <select className='px-3 py-2 rounded bg-card border border-border' value={unidade} onChange={e=>{setUnidade(e.target.value); setPage(1)}}>
            <option value=''>Todas as Unidades</option>
            {unidadesFiltradas.map(u=> <option key={u.unidade} value={u.unidade}>{u.unidade}</option>)}
          </select>
        </div>
        {!!error && <div className="mt-2 text-red-300 text-sm">{error}</div>}
      </div>
      <div className='rounded-xl border border-border bg-panel'>
        <div className='overflow-x-auto'>
          <table className='min-w-full text-sm'>
            <thead className='bg-white/10'><tr>
              <th className='px-3 py-2 text-left'>Nome</th>
              <th className='px-3 py-2 text-left'>Matrícula</th>
              <th className='px-3 py-2 text-left'>Função</th>
              <th className='px-3 py-2 text-left'>Unidade</th>
              <th className='px-3 py-2 text-left'>Regional</th>
            </tr></thead>
            <tbody>
              {items.map((c)=> (
                <tr key={c.id} className='border-t border-border hover:bg-white/10'>
                  <td className='px-3 py-2'>{c.nome}</td>
                  <td className='px-3 py-2'>{c.matricula||''}</td>
                  <td className='px-3 py-2'>{c.funcao}</td>
                  <td className='px-3 py-2'>{c.unidade}</td>
                  <td className='px-3 py-2'>{c.regional}</td>
                </tr>
              ))}
              {!loading && items.length===0 && !error && (
                <tr><td colSpan={5} className='px-3 py-6 text-center text-muted'>Nenhum colaborador encontrado</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className='flex items-center justify-between p-3 text-xs text-text'>
          <div>Total: {total}</div>
          <div className='flex items-center gap-2'>
            <button className='px-2 py-1 border border-border rounded disabled:opacity-40' onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1}>Anterior</button>
            <div>Página {page}</div>
            <button className='px-2 py-1 border border-border rounded disabled:opacity-40' onClick={()=>setPage(p=>p+1)} disabled={items.length<size}>Próxima</button>
          </div>
        </div>
      </div>
    </div>
  )
}
