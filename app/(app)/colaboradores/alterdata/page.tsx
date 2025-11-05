'use client';

import React, { useEffect, useMemo, useState } from 'react';

type Row = { row_no: number; data: Record<string,string> };
type ApiRows = { ok: boolean; rows: Row[]; page: number; limit: number; total: number; error?: string };
type ApiCols = { ok: boolean; columns: string[]; error?: string };
type ApiOpts = { ok: boolean; regionais: string[]; unidades: string[]; error?: string };

function stripAccents(s: string){
  return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}
function formatDateBR(v: string){
  const m = v.match(/\d{4}-\d{2}-\d{2}/) || v.match(/\d{2}\/\d{2}\/\d{4}/);
  if(!m) return v || '';
  let [yy,mm,dd] = [0,0,0];
  if(m[0].includes('-')){ const [y,mn,d] = m[0].split('-'); yy=+y;mm=+mn;dd=+d; }
  else { const [d,mn,y] = m[0].split('/'); yy=+y;mm=+mn;dd=+d; }
  if(!yy||!mm||!dd) return v;
  const ddS = String(dd).padStart(2,'0'), mmS = String(mm).padStart(2,'0');
  return `${ddS}/${mmS}/${yy}`;
}
function formatCPF(raw: string){
  const digits = (raw||'').replace(/\D/g,'').padStart(11,'0').slice(-11);
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
}
function formatMatricula(raw: string){ return String(parseInt((raw||'').replace(/\D/g,'')||'0')).padStart(5,'0'); }
function formatTelefoneBR(raw: string){ const d=(raw||'').replace(/\D/g,''); if(d.length<10)return raw||''; const p=d.length===11?3:2; return `(${d.slice(0,2)}) ${d.slice(2,p+2)}${p===3?' ':''}${d.slice(p+2,p+6)}-${d.slice(p+6)}`; }
function formatCell(col: string, raw?: string){
  const value = (raw ?? '').trim();
  if(!value) return '';
  const c = stripAccents(col).toLowerCase();
  if(c.includes('cpf')) return formatCPF(value);
  if(c.includes('matricul')) return formatMatricula(value);
  if (c.startsWith('data') || c.includes('admiss') || c.includes('demiss') || c.includes('nasc') || c.includes('atest') || c.includes('afast') || c.includes('proximo aso')) {
    return formatDateBR(value);
  }
  if(c.includes('celular') || c.includes('telefone') || c.includes('fone')) return formatTelefoneBR(value);
  return value;
}

export default function AlterdataCompletaPage(){
  const [cols, setCols] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const [fRegional, setFRegional] = useState('');
  const [fUnidade, setFUnidade] = useState('');
  const [fStatus, setFStatus] = useState('');

  const [optsRegionais, setOptsRegionais] = useState<string[]>([]);
  const [optsUnidades, setOptsUnidades] = useState<string[]>([]);

  useEffect(()=>{
    (async ()=>{
      const r = await fetch('/api/alterdata/raw-columns');
      const j: ApiCols = await r.json();
      if(j.ok) setCols(j.columns);
    })();
  }, []);

  useEffect(()=>{
    (async ()=>{
      const r = await fetch('/api/alterdata/options');
      const j: ApiOpts = await r.json();
      if(j.ok){
        setOptsRegionais(j.regionais);
        setOptsUnidades(j.unidades);
      }
    })();
  }, []);

  useEffect(()=>{
    (async ()=>{
      const params = new URLSearchParams();
      if(fRegional) params.set('regional', fRegional);
      const r = await fetch(`/api/alterdata/options?${params.toString()}`);
      const j: ApiOpts = await r.json();
      if(j.ok){
        setOptsUnidades(j.unidades);
      }
    })();
    setPage(1);
    setFUnidade('');
  }, [fRegional]);

  useEffect(()=>{
    let on = true;
    setLoading(true);
    (async ()=>{
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if(q.trim()) params.set('q', q.trim());
      if(fRegional) params.set('regional', fRegional);
      if(fUnidade) params.set('unidade', fUnidade);
      if(fStatus) params.set('status', fStatus);
      const r = await fetch(`/api/alterdata/raw-rows?${params.toString()}`);
      const j: ApiRows = await r.json();
      if(on){
        if(j.ok){ setRows(j.rows); setTotal(j.total); } else { console.error(j.error); }
        setLoading(false);
      }
    })();
    return ()=>{ on=false; };
  }, [page, limit, q, fRegional, fUnidade, fStatus]);

  const pages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Alterdata — Base Completa (último upload)</h1>
        <p className="text-muted">Visual com Regional (join por Unidade) e filtros de Status/Regional/Unidade. Nada altera a base ou o upload.</p>
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <input
          className="input input-bordered w-80"
          placeholder="Buscar (nome, CPF, matrícula, unidade, função)"
          value={q}
          onChange={e=>{ setPage(1); setQ(e.target.value); }}
        />
        <select className="select select-bordered" value={limit} onChange={e=>{ setPage(1); setLimit(parseInt(e.target.value)); }}>
          {[25,50,100,150,200].map(n => <option key={n} value={n}>{n}/página</option>)}
        </select>
        <div className="text-muted">Total: {total}</div>

        <select className="select select-bordered" value={fRegional} onChange={e=> setFRegional(e.target.value)}>
          <option value="">Regional (todas)</option>
          {optsRegionais.map(r => <option key={r} value={r}>{r}</option>)}
        </select>

        <select className="select select-bordered" value={fUnidade} onChange={e=> setFUnidade(e.target.value)}>
          <option value="">Unidade (todas)</option>
          {optsUnidades.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        <select className="select select-bordered" value={fStatus} onChange={e=> { setPage(1); setFStatus(e.target.value); }}>
          <option value="">Status (todos)</option>
          <option value="Admitido">Admitido</option>
          <option value="Demitido">Demitido</option>
          <option value="Afastado">Afastado</option>
        </select>
      </div>

      <div className="overflow-auto border border-border rounded-xl">
        <table className="min-w-max text-sm text-center">
          <thead className="bg-panel sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-center">#</th>
              {cols.map(c => (
                <th key={c} className="px-3 py-2 text-center whitespace-nowrap">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td className="px-3 py-2" colSpan={cols.length+1}>Carregando...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td className="px-3 py-2" colSpan={cols.length+1}>Nenhum registro</td></tr>
            ) : rows.map((r) => (
              <tr key={r.row_no} className="odd:bg-transparent even:bg-card">
                <td className="px-3 py-2 text-center">{r.row_no}</td>
                {cols.map(c => (
                  <td key={c} className="px-3 py-2 whitespace-nowrap text-center">{formatCell(c, r.data?.[c])}</td>
                ))}
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
