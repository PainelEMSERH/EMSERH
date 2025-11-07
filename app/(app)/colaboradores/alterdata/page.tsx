'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UNID_TO_REGIONAL, REGIONALS, canonUnidade, Regional } from '@/lib/unidReg';

const LS_KEY_ALTERDATA = 'alterdata_cache_v7'; // nova chave (evita cache antigo)

const __HIDE_COLS__ = new Set(['Celular', 'Cidade', 'Data Atestado', 'Motivo Afastamento', 'Nome Médico', 'Periodicidade', 'Telefone']);
function __shouldHide(col: string): boolean {
  const n = (col||'').normalize('NFD').replace(/[^a-z0-9]/gi,'').toLowerCase();
  const targets = new Set(['celular', 'cidade', 'dataatestado', 'motivoafastamento', 'nomemedico', 'periodicidade', 'telefone']);
  return targets.has(n);
}
function __fmtDate(val: any): string {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
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

async function fetchJSON(url: string, init?: RequestInit): Promise<{json:any, headers: Headers}> {
  const r = await fetch(url, init);
  const text = await r.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { ok:false, error: 'JSON inválido', raw: text }; }
  return { json, headers: r.headers };
}

async function fetchPage(page: number, limit: number): Promise<{data: ApiRows, headers: Headers}> {
  const params = new URLSearchParams({ page:String(page), limit:String(limit) });
  const { json, headers } = await fetchJSON('/api/alterdata/raw-rows2?' + params.toString(), { cache: 'force-cache' });
  if (!json?.ok) throw new Error(json?.error || 'Falha ao carregar página '+page);
  return { data: json as ApiRows, headers };
}

export default function Page() {
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [routeTag, setRouteTag] = useState<string>('');

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
        const { json: jCols, headers: h1 } = await fetchJSON('/api/alterdata/raw-columns2', { cache: 'force-cache' });
        if (!jCols?.ok) throw new Error(jCols?.error || 'Falha em raw-columns2');
        setRouteTag(h1.get('x-alterdata-route') || '');
        const baseCols = (Array.isArray(jCols?.columns) ? jCols.columns : []) as string[];
        const batchId = jCols?.batch_id || null;

        try{
          const raw = window.localStorage.getItem(LS_KEY_ALTERDATA);
          if (raw) {
            const cached = JSON.parse(raw);
            if (cached && cached.batch_id === batchId && Array.isArray(cached.rows) && Array.isArray(cached.columns)) {
              if(on){
                setColumns(cached.columns);
                setRows(cached.rows);
                setLoading(false);
                return;
              }
            }
          }
        }catch{}

        const first = await fetchPage(1, 200);
        setRouteTag(first.headers.get('x-alterdata-route') || routeTag);
        const total = first.data.total || first.data.rows.length;
        const limit = first.data.limit || 200;
        const pages = Math.max(1, Math.ceil(total / limit));
        const acc: AnyRow[] = [...first.data.rows.map(r => ({ row_no: r.row_no, ...r.data }))];
        if (on) setProgress(`${acc.length}/${total}`);

        for (let p = 2; p <= pages; p++) {
          const res = await fetchPage(p, limit);
          setRouteTag(res.headers.get('x-alterdata-route') || routeTag);
          acc.push(...res.data.rows.map(r => ({ row_no: r.row_no, ...r.data })));
          if (on) setProgress(`${Math.min(acc.length,total)}/${total}`);
        }

        // Mapeia regional no cliente
        const uk = detectUnidadeKey(acc);
        const withReg = acc.map(r => {
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
  }, []);

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
      <div className="flex items-center gap-3">
        <div className="text-lg font-semibold">Alterdata — Base Completa</div>
        {routeTag && <span className="text-xs px-2 py-1 rounded-lg bg-neutral-100">API: {routeTag}</span>}
      </div>
      <p className="text-sm opacity-70">Visual com Regional (join por unidade no cliente), busca livre e filtros de Regional/Unidade. Nada altera a base ou o upload.</p>

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
