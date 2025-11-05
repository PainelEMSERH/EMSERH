
'use client';
import React, { useEffect, useState } from 'react';

type Row = { row_no: number; data: Record<string,string> };
type ApiRows = { ok: boolean; rows: Row[]; page: number; limit: number; total: number; error?: string };
type ApiCols = { ok: boolean; columns: string[]; error?: string };

// === Display formatters (visual only; não alteram a base) ===
function stripAccents(s: string){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

function formatDateBR(value: string){
  if(!value) return '';
  // captura YYYY-MM-DD e HH:MM:SS (opcional)
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if(!m) return value;
  const [, y, mo, d, hh, mm] = m;
  const ddmmyyyy = `${d}/${mo}/${y}`;
  if(hh && !(hh === '00' && (mm||'00') === '00')) return `${ddmmyyyy} ${hh}:${mm||'00'}`;
  return ddmmyyyy;
}

function formatCPF(value: string){
  if(!value) return '';
  const digits = value.replace(/\D/g,'');
  if(digits.length !== 11) return value;
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
}

function formatMatricula(value: string){
  if(!value) return '';
  const digits = value.replace(/\D/g,'');
  if(!digits) return value;
  return digits.padStart(5,'0');
}

function formatTelefoneBR(value: string){
  if(!value) return '';
  const d = value.replace(/\D/g,'');
  if(d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  if(d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
  return value;
}

function formatCell(col: string, raw?: string){
  const value = (raw ?? '').trim();
  if(!value) return '';
  const c = stripAccents(col).toLowerCase();

  if(c.includes('cpf')) return formatCPF(value);
  if(c.includes('matricul')) return formatMatricula(value);

  // datas comuns na Alterdata: Admissão, Data Nascimento, Demissão, Data Atestado, etc.
  if(c.startsWith('data') || c.includes('admiss') || c.includes('demiss') || c.includes('nasc') || c.includes('atest')){
    return formatDateBR(value);
  }

  if(c.includes('celular') || c.includes('telefone') || c.includes('fone')){
    return formatTelefoneBR(value);
  }

  return value;
}
// === /formatters ===



export default function AlterdataCompletaPage(){
  const [cols, setCols] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const pages = Math.max(1, Math.ceil(total / limit));

  useEffect(()=>{
    let on = true;
    (async ()=>{
      const r = await fetch('/api/alterdata/raw-columns');
      const j: ApiCols = await r.json();
      if(on && j.ok) setCols(j.columns);
    })();
    return ()=>{ on=false; };
  }, []);

  useEffect(()=>{
    let on = true;
    setLoading(true);
    (async ()=>{
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if(q.trim()) params.set('q', q.trim());
      const r = await fetch(`/api/alterdata/raw-rows?${params.toString()}`);
      const j: ApiRows = await r.json();
      if(on){
        if(j.ok){
          setRows(j.rows);
          setTotal(j.total);
        }else{
          console.error(j.error);
        }
        setLoading(false);
      }
    })();
    return ()=>{ on=false; };
  }, [page, limit, q]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Alterdata — Base Completa (último upload)</h1>
        <p className="text-muted">Exibe exatamente as colunas da planilha importada. Busca por Nome / CPF / Matrícula / Unidade / Função.</p>
      </div>

      <div className="flex gap-2 items-center">
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
      </div>

      <div className="overflow-auto border border-border rounded-xl">
        <table className="min-w-max text-sm">
          <thead className="bg-panel sticky top-0 z-10">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              {cols.map(c => (
                <th key={c} className="px-3 py-2 text-left whitespace-nowrap">{c}</th>
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
                <td className="px-3 py-2">{r.row_no}</td>
                {cols.map(c => (
                  <td key={c} className="px-3 py-2 whitespace-nowrap">{formatCell(c, r.data?.[c])}</td>
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
