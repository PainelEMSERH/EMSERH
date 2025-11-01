'use client'
import { useEffect, useState } from "react";

type KitRow={id:string;nome:string;descricao:string;itens?:{item:string;quantidade:number}[]};

export default function Page(){
  const [rows,setRows]=useState<KitRow[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{(async()=>{try{const r=await fetch('/api/kits/list',{cache:'no-store'});const j=await r.json();if(j?.ok&&Array.isArray(j.rows))setRows(j.rows);}finally{setLoading(false);}})();},[]);
  return(<div className="p-4">
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
      <h1 className="text-xl font-semibold">Kits</h1>
      <p className="text-sm text-zinc-400 mt-2">Lista de kits cadastrados e sua composição.</p>
    </div>
    <div className="mt-4 overflow-x-auto rounded-xl border border-zinc-800">
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-900/50"><tr className="text-left">
          <th className="px-4 py-3">Kit</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Composição</th>
        </tr></thead>
        <tbody>
          {loading?<tr><td className="px-4 py-6 text-zinc-400" colSpan={3}>Carregando...</td></tr>:
           rows.length===0?<tr><td className="px-4 py-6 text-zinc-400" colSpan={3}>Nenhum kit encontrado.</td></tr>:
           rows.map(k=>(<tr key={k.id} className="border-t border-zinc-800">
              <td className="px-4 py-3 font-medium">{k.nome}</td>
              <td className="px-4 py-3 text-zinc-300">{k.descricao||'-'}</td>
              <td className="px-4 py-3 whitespace-pre-wrap text-zinc-300">{k.itens?.length?k.itens.map(i=>`${i.item} × ${i.quantidade}`).join(' • '):'-'}</td>
            </tr>))}
        </tbody>
      </table>
    </div>
  </div>);
}