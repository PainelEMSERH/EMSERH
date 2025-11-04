// file: app/(app)/kits/page.tsx
'use client';
import React, { useEffect, useMemo, useState } from 'react';

type KitRow = { funcao:string; item:string; quantidade:number; unidade:string };
async function fetchJSON<T>(u:string){ const r = await fetch(u, { cache:'no-store' }); if(!r.ok) throw new Error('Falha'); return r.json() as Promise<T>; }

export default function Page(){
  const [q, setQ] = useState('');
  const [unidade, setUnidade] = useState('');
  const [rows, setRows] = useState<KitRow[]>([]);
  const [page, setPage] = useState(1);
  const [size] = useState(100);

  useEffect(()=>{
    let mounted = true;
    const url = `/api/kits/map?q=${encodeURIComponent(q)}&unidade=${encodeURIComponent(unidade)}&page=${page}&size=${size}`;
    fetchJSON<{ rows: KitRow[] }>(url).then(d => { if(mounted){ const arr:any = (d as any).rows || d; setRows(Array.isArray(arr)?arr:[]); } }).catch(()=>{});
    return () => { mounted = false };
  }, [q, unidade, page, size]);

  const porFuncao = useMemo(()=> {
    const map = new Map<string, KitRow[]>();
    rows.forEach(r => { const k = r.funcao || 'SEM FUNÇÃO'; map.set(k, [...(map.get(k) || []), r]); });
    return Array.from(map.entries());
  }, [rows]);

  return (
    <div className="p-6 space-y-4">
      <div className="rounded-xl border border-border bg-panel p-4">
        <h1 className="text-xl font-semibold mb-1">Kits de EPI por Função</h1>
        <p className="text-sm text-muted mb-3">Baseado em <code>stg_epi_map</code> (quantidade por item e função).</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input className="px-3 py-2 rounded bg-card border border-border" placeholder="Filtrar por função ou item" value={q} onChange={e=>{setQ(e.target.value); setPage(1)}}/>
          <input className="px-3 py-2 rounded bg-card border border-border" placeholder="Filtrar por unidade (nome_site)" value={unidade} onChange={e=>{setUnidade(e.target.value); setPage(1)}}/>
        </div>
      </div>

      {porFuncao.map(([func, itens]) => (
        <div key={func} className="rounded-xl border border-border bg-panel">
          <div className="px-4 py-3 border-b border-border font-semibold">{func}</div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-white/10"><tr>
                <th className="px-3 py-2 text-left">Item</th>
                <th className="px-3 py-2 text-right">Quantidade</th>
                <th className="px-3 py-2 text-left">Unidade (nome_site)</th>
              </tr></thead>
              <tbody>
                {itens.map((r, idx) => (
                  <tr key={idx} className="border-t border-border hover:bg-white/10">
                    <td className="px-3 py-2">{r.item}</td>
                    <td className="px-3 py-2 text-right">{r.quantidade}</td>
                    <td className="px-3 py-2">{r.unidade || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {rows.length===0 && (
        <div className="rounded-xl border border-border bg-panel p-6 text-center text-muted">Nenhum registro</div>
      )}
    </div>
  );
}
