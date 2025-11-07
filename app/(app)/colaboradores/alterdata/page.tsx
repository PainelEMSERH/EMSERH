'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UNID_TO_REGIONAL, REGIONALS, canonUnidade, Regional } from '@/lib/unidReg';

// Patch: ocultar colunas específicas e formatar datas (dd/MM/aaaa)
const __HIDE_COLS__ = new Set(['Celular', 'Cidade', 'Data Atestado', 'Estado Civil', 'Fim Afastamento', 'Início Afastamento', 'Motivo Afastamento', 'Nome Médico', 'Periodicidade', 'Telefone']);
function __shouldHide(col: string): boolean {
  const n = (col||'').normalize('NFD').replace(/[^a-z0-9]/gi,'').toLowerCase();
  const targets = new Set(['celular', 'cidade', 'dataatestado', 'estadocivil', 'fimafastamento', 'inicioafastamento', 'motivoafastamento', 'nomemedico', 'periodicidade', 'telefone']);
  return targets.has(n);
}
function __fmtDate(val: any): string {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  // yyyy-mm-dd or yyyy-mm-dd HH:mm:ss
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/);
  if (m) { return `${m[3]}/${m[2]}/${m[1]}`; }
  // If already dd/mm/yyyy, keep
  const m2 = s.match(/^(\d{2})\/(\d{2})\/(\d{2,4})$/);
  if (m2) { return s; }
  return s;
}
function __renderCell(col: string, val: any): string {
  const n = (col||'').normalize('NFD').toLowerCase();
  if (/data|nascimento|admiss[aã]o|afastamento|atest/.test(n)) { return __fmtDate(val); }
  return String(val ?? '');
}
// /*__HIDE_ALTERDATA__*/

type RowApi = { row_no: number; data: Record<string, string> };
type ApiRows = { ok: boolean; rows: RowApi[]; page: number; limit: number; total: number; error?: string };
type ApiCols = { ok: boolean; columns: string[]; error?: string };

type AnyRow = Record<string, any>;

function flatten(r: RowApi): AnyRow {
  return { row_no: r.row_no, ...r.data };
}

function uniqueSorted(arr: (string|null|undefined)[]) {
  return Array.from(new Set(arr.filter(Boolean) as string[])).sort((a,b)=>a.localeCompare(b,'pt-BR'));
}

function detectUnidadeKey(sample: AnyRow[]): string | null {
  if (!sample?.length) return null;
  const keys = Object.keys(sample[0]);
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const byScore = keys.map(k => {
    const n = norm(k);
    let score = 0;
    if (n.includes('unid')) score += 4;
    if (n.includes('hospital')) score += 3;
    if (n.includes('estab')) score += 2;
    if (/^unidade(\s|$)/.test(n)) score += 5;
    return { k, score };
  }).sort((a,b)=>b.score - a.score);
  return byScore[0]?.score ? byScore[0].k : null;
}

async function fetchPage(page: number, limit: number): Promise<ApiRows> {
  const params = new URLSearchParams({ page:String(page), limit:String(limit) });
  const r = await fetch('/api/alterdata/raw-rows?' + params.toString(), { cache: 'no-store' });
  if(!r.ok) throw new Error('Falha ao carregar página ' + page);
  return r.json();
}

async function fetchAll(onProgress?: (n:number,t:number)=>void): Promise<AnyRow[]> {
  const first = await fetchPage(1, 200);
  const total = first.total || first.rows.length;
  const limit = first.limit || 200;
  const pages = Math.max(1, Math.ceil(total / limit));
  const acc: AnyRow[] = [...first.rows.map(flatten)];
  if (onProgress) onProgress(acc.length, total);

  const concurrency = Math.min(10, Math.max(1, pages-1));
  let next = 2;
  async function worker() {
    while (next <= pages) {
      const p = next++;
      const res = await fetchPage(p, limit);
      acc.push(...res.rows.map(flatten));
      if (onProgress) onProgress(Math.min(acc.length,total), total);
    }
  }
  await Promise.all(Array.from({length: concurrency}, worker));
  return acc.slice(0, total);
}

export default function Page() {
  const LS_ALTERDATA_ROWS='alt_rows'; const LS_ALTERDATA_COLS='alt_cols'; const LS_ALTERDATA_BATCH='alt_batch'; let batchId: string | null = null;
const [columns, setColumns] = useState<string[]>(()=>{ try{ return typeof window!=='undefined' ? (JSON.parse(localStorage.getItem(LS_ALTERDATA_COLS)||'[]')||[]) : [] }catch{return []} });
  const [rows, setRows] = useState<AnyRow[]>(()=>{ try{ return typeof window!=='undefined' ? (JSON.parse(localStorage.getItem(LS_ALTERDATA_ROWS)||'[]')||[]) : [] }catch{return []} });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');

  const [q, setQ] = useState('');
  const [regional, setRegional] = useState<Regional | 'TODAS'>('TODAS');
  const [unidade, setUnidade] = useState<string | 'TODAS'>('TODAS');

  const unidadeKey = useMemo(()=> detectUnidadeKey(rows), [rows]);

  const fetchedRef = useRef(false);

  useEffect(()=>{
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    let on = true;
    (async ()=>{
      setLoading(true); setError(null); setProgress('');
      try{
        const rCols = await fetch('/api/alterdata/raw-columns', { cache: 'no-store' });
        const jCols: ApiCols = await rCols.json();
        const baseCols = (Array.isArray(jCols?.columns) ? jCols.columns : []) as string[];

        const data = await fetchAll((n,t)=>{ if(on) setProgress(`${n}/${t}`); });
        const uk = detectUnidadeKey(data);
        const withReg = data.map(r => {
          const un = uk ? String(r[uk] ?? '') : '';
          const reg = UNID_TO_REGIONAL[canonUnidade(un)] ?? null;
          return { ...r, regional: reg };
        });

        let cols = [...baseCols.filter(c => c !== 'regional' && !__shouldHide(c))];
        if (uk) {
          const i = cols.findIndex(c => c === uk);
          if (i>=0) cols.splice(i+1,0,'regional'); else cols.push('regional');
        } else if (!cols.includes('regional')) cols.push('regional');

        if(on){
          setColumns(cols);
          setRows(withReg);
          try{ localStorage.setItem(LS_ALTERDATA_ROWS, JSON.stringify(withReg)); localStorage.setItem(LS_ALTERDATA_COLS, JSON.stringify(cols)); if (batchId!==null) localStorage.setItem(LS_ALTERDATA_BATCH, String(batchId)); }catch{}
          try { window.localStorage.setItem(LS_KEY_ALTERDATA, JSON.stringify({ rows: withReg, columns: cols })); } catch {}
        }
      }catch(e:any){
        if(on) setError(String(e?.message||e));
      }finally{
        if(on) setLoading(false);
      }
    })();

    return ()=>{ on=false };
  }, []); // fetch once

  const unidadeOptions = useMemo(()=>{
    const uk = unidadeKey;
    if (!uk) return [];
    const base = regional === 'TODAS' ? rows : rows.filter(r => r.regional === regional);
    return uniqueSorted(base.map(r => String(r[uk] ?? '')).filter(Boolean));
  }, [rows, regional, unidadeKey]);

  const filtered = useMemo(()=>{
    const uk = unidadeKey;
    let list = rows;
    if (regional !== 'TODAS') list = list.filter(r => r.regional === regional);
    if (uk && unidade !== 'TODAS') list = list.filter(r => String(r[uk] ?? '') === unidade);
    if (q.trim()) {
      const needles = q.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter(r => {
        const blob = Object.values(r).join(' ').toLowerCase();
        return needles.every(n => blob.includes(n));
      });
    }
    return list;
  }, [rows, regional, unidade, q, unidadeKey]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="text-lg font-semibold">Alterdata — Base Completa</div>
      <p className="text-sm opacity-70">Visual com Regional (join por Unidade) e filtros de Regional/Unidade. Nada altera a base ou o upload.</p>

      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={e=>setQ(e.target.value)}
          placeholder="Buscar por nome, CPF, matrícula, unidade..."
          className="px-3 py-2 rounded-xl bg-neutral-100 text-sm w-full md:w-96 outline-none text-neutral-900"
        />
        <select value={regional} onChange={e=>{ setRegional(e.target.value as any); setUnidade('TODAS'); }}
                className="px-3 py-2 rounded-xl bg-neutral-100 text-sm text-neutral-900">
          <option value="TODAS">Regional (todas)</option>
          {REGIONALS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={unidade} onChange={e=>setUnidade(e.target.value as any)}
                disabled={!unidadeKey}
                className="px-3 py-2 rounded-xl bg-neutral-100 text-sm text-neutral-900">
          <option value="TODAS">Unidade (todas)</option>
          {unidadeOptions.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
      </div>

      
      {error && rows.length===0 && <div className="text-sm text-red-600">Erro: {error}</div>}
      {error && rows.length>0 && <div className="text-xs text-amber-600">Aviso: {error}. Exibindo dados já carregados.</div>}

      {!loading && rows.length>0 && (
        <div className="rounded-2xl overflow-auto border border-neutral-300">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900 text-white">
              <tr>
                {columns.map((c,i) => (
                  <th key={i} className="text-left px-3 py-2 font-medium sticky top-0">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              {filtered.map((r, idx) => (
                <tr key={idx} className="hover:bg-neutral-50">
                  {columns.map((c,i) => (
                    <td key={i} className="px-3 py-2 whitespace-nowrap">{__renderCell(c, r[c])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs opacity-60">{rows.length} registros carregados (lista completa, sem paginação)</div>
    </div>
  );
}
