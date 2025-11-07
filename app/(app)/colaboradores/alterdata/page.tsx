'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UNID_TO_REGIONAL, REGIONALS, canonUnidade, Regional } from '@/lib/unidReg';

// ==== Config de cache local (persistência entre navegações) ====
const LS_KEY_ALTERDATA = 'alterdata_cache_v4'; // inclui batch_id

// Patch: ocultar colunas específicas e formatar datas (dd/MM/aaaa)
const __HIDE_COLS__ = new Set(['Celular', 'Cidade', 'Data Atestado', 'Motivo Afastamento', 'Nome Médico', 'Periodicidade', 'Telefone']);
function __shouldHide(col: string): boolean {
  const n = (col||'').normalize('NFD').replace(/[^a-z0-9]/gi,'').toLowerCase();
  const targets = new Set(['celular', 'cidade', 'dataatestado', 'motivoafastamento', 'nomemedico', 'periodicidade', 'telefone']);
  return targets.has(n);
}
function __fmtDate(val: any): string {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  // yyyy-mm-dd or yyyy-mm-dd HH:mm:ss
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
}
function __renderCell(col: string, val: any) {
  const n = (col||'').normalize('NFD').replace(/[^a-z0-9]/gi,'').toLowerCase();
  if (n.includes('data')) return __fmtDate(val);
  return String(val ?? '');
}

type RowApi = { row_no: number; data: Record<string, string> };
type ApiRows = { ok: boolean; rows: RowApi[]; page: number; limit: number; total: number; error?: string };
type ApiCols = { ok: boolean; columns: string[]; batch_id?: string | null; error?: string };

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
  const r = await fetch('/api/alterdata/raw-rows?' + params.toString(), { cache: 'force-cache' });
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
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<AnyRow[]>([]);
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
        // 1) Pega colunas + batch_id com cache de CDN
        const rCols = await fetch('/api/alterdata/raw-columns', { cache: 'force-cache' });
        const jCols: ApiCols = await rCols.json();
        const baseCols = (Array.isArray(jCols?.columns) ? jCols.columns : []) as string[];
        const batchId = jCols?.batch_id || null;

        // 2) Tenta carregar do localStorage se batch_id coincide
        try{
          const raw = window.localStorage.getItem(LS_KEY_ALTERDATA);
          if (raw) {
            const cached = JSON.parse(raw);
            if (cached && cached.batch_id === batchId && Array.isArray(cached.rows) && Array.isArray(cached.columns)) {
              const uk = detectUnidadeKey(cached.rows);
              const withReg = cached.rows.map((r:any) => {
                let regional = r.regional;
                if (!regional) {
                  const ukv = uk ? String(r[uk] ?? '') : '';
                  const c = canonUnidade(ukv);
                  regional = (UNID_TO_REGIONAL as any)[c] || '';
                }
                return { ...r, regional };
              });
              const cols = cached.columns.includes('regional') ? cached.columns : ['regional', ...cached.columns];
              if(on){
                setColumns(cols);
                setRows(withReg);
                setLoading(false);
                return; // pronto, sem refetch
              }
            }
          }
        }catch{}

        // 3) Carrega tudo (com progresso) e salva no LS com batch_id
        const data = await fetchAll((n,t)=>{ if(on) setProgress(`${n}/${t}`); });
        const uk = detectUnidadeKey(data);
        const withReg = data.map(r => {
          const un = uk ? String(r[uk] ?? '') : '';
          const c = canonUnidade(un);
          const reg = (UNID_TO_REGIONAL as any)[c] || '';
          return { ...r, regional: reg };
        });

        const cols = baseCols.includes('regional') ? baseCols : ['regional', ...baseCols];

        if(on){
          setColumns(cols);
          setRows(withReg);
          try { window.localStorage.setItem(LS_KEY_ALTERDATA, JSON.stringify({ batch_id: batchId, rows: withReg, columns: cols })); } catch {}
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
      <p className="text-sm opacity-70">Visual com Regional (join por unidade), busca livre e filtros de Regional/Unidade. Nada altera a base ou o upload.</p>

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

        <div className="ml-auto flex items-center gap-2 text-sm">
          {loading && <span className="opacity-60">Carregando {progress && `(${progress})`}…</span>}
          {error && <span className="text-red-600">Erro: {error}</span>}
        </div>
      </div>

      {columns.length > 0 && (
        <div className="overflow-auto rounded-2xl border">
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr>
                {columns.filter(c => !__HIDE_COLS__.has(c) && !__shouldHide(c)).map((c,i) => (
                  <th key={i} className="px-3 py-2 text-left border-b whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, idx) => (
                <tr key={idx} className="odd:bg-neutral-50">
                  {columns.filter(c => !__HIDE_COLS__.has(c) && !__shouldHide(c)).map((c,i) => (
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
