'use client';
import React, { useEffect, useState } from 'react';

type Row = Record<string,string>;
type ApiRows = { ok: boolean; rows: Row[]; page: number; limit: number; total: number; columns: string[]; error?: string };
type ApiFilters = { ok: boolean; regionais: string[]; unidades: string[]; error?: string };
type ApiBatches = { ok: boolean; batches: { batch_id: string; label: string }[]; current?: string };

export default function AlterdataCompletaPage(){
  const [cols, setCols] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [q, setQ] = useState('');
  const [regional, setRegional] = useState('');
  const [unidade, setUnidade] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [regionais, setRegionais] = useState<string[]>([]);
  const [unidades, setUnidades] = useState<string[]>([]);
  const [batches, setBatches] = useState<{batch_id:string; label:string}[]>([]);
  const [batchId, setBatchId] = useState<string>('');
  const pages = Math.max(1, Math.ceil(total / limit));

  useEffect(()=>{ (async ()=>{
    const r = await fetch('/api/alterdata/batches');
    const j: ApiBatches = await r.json();
    if(j.ok){
      setBatches(j.batches||[]);
      if(j.current) setBatchId(j.current);
      else if(j.batches?.length) setBatchId(j.batches[0].batch_id);
    }
  })(); }, []);

  useEffect(()=>{ (async ()=>{
    const r = await fetch('/api/alterdata/filters');
    const j: ApiFilters = await r.json();
    if(j.ok){ setRegionais(j.regionais||[]); setUnidades(j.unidades||[]); }
  })(); }, []);

  useEffect(()=>{ (async ()=>{
    if(!batchId) return;
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit), batch_id: batchId });
    if(q.trim()) params.set('q', q.trim());
    if(regional) params.set('regional', regional);
    if(unidade) params.set('unidade', unidade);
    if(status) params.set('status', status);
    const r = await fetch(`/api/alterdata/full-rows?${params.toString()}`);
    const j: ApiRows = await r.json();
    if(j.ok){ setRows(j.rows); setTotal(j.total); setCols(j.columns); }
    setLoading(false);
  })(); }, [page, limit, q, regional, unidade, status, batchId]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Alterdata — Base Completa (último upload)</h1>
        <p className="text-muted">CPF 000.000.000-00 • Matrícula 00000 • Datas DD/MM/AAAA • Filtros por Regional/Unidade/Status.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <input className="input input-bordered w-80" placeholder="Buscar (nome, CPF, matrícula, unidade, função)"
               value={q} onChange={e=>{ setPage(1); setQ(e.target.value); }} />
        <select className="select select-bordered" value={regional} onChange={e=>{ setPage(1); setRegional(e.target.value); }}>
          <option value="">Todas as Regionais</option>
          {regionais.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="select select-bordered w-80" value={unidade} onChange={e=>{ setPage(1); setUnidade(e.target.value); }}>
          <option value="">Todas as Unidades</option>
          {unidades.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        <select className="select select-bordered" value={status} onChange={e=>{ setPage(1); setStatus(e.target.value); }}>
          <option value="">Todos</option>
          <option value="admitido">Admitidos</option>
          <option value="demitido">Demitidos</option>
        </select>
        <select className="select select-bordered" value={limit} onChange={e=>{ setPage(1); setLimit(parseInt(e.target.value)); }}>
          {[25,50,100,150,200].map(n => <option key={n} value={n}>{n}/página</option>)}
        </select>
        <select className="select select-bordered" value={batchId} onChange={e=>{ setPage(1); setBatchId(e.target.value); }}>
          {batches.map(b => <option key={b.batch_id} value={b.batch_id}>{b.label}</option>)}
        </select>
        <div className="text-muted">Total: {total}</div>
      </div>

      <div className="overflow-auto border border-border rounded-xl">
        <table className="min-w-max text-sm">
          <thead className="bg-panel sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-center">#</th>
              {cols.map(c => <th key={c} className="px-3 py-2 text-center whitespace-nowrap">{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-2 text-center" colSpan={cols.length+1}>Carregando...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="px-3 py-2 text-center" colSpan={cols.length+1}>Nenhum registro</td></tr>
            ) : rows.map((r, idx) => (
              <tr key={idx} className="odd:bg-transparent even:bg-card">
                <td className="px-3 py-2 text-center">{(page-1)*limit + idx + 1}</td>
                {cols.map(c => <td key={c} className="px-3 py-2 text-center whitespace-nowrap">{r[c] ?? ''}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <button className="btn" disabled={page<=1} onClick={()=>setPage(p=>Math.max(1,p-1))}>Anterior</button>
        <div>Página {page} de {pages}</div>
        <button className="btn" disabled={page>=pages} onClick={()=>setPage(p=>Math.min(pages,p+1))}>Próxima</button>
      </div>
    </div>
  );
}
