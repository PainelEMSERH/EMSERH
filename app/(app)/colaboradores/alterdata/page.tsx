'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UNID_TO_REGIONAL, REGIONALS, canonUnidade, Regional } from '@/lib/unidReg';

// Mantém cache por batch_id; nova chave para evitar resquícios de cache antigo
const LS_KEY_ALTERDATA = 'alterdata_cache_prod_v3';

const __HIDE_COLS__ = new Set(['Celular', 'Cidade', 'Data Atestado', 'Motivo Afastamento', 'Nome Médico', 'Periodicidade', 'Telefone']);
function __shouldHide(col: string): boolean {
  const n = (col||'').normalize('NFD').replace(/[^a-z0-9]/gi,'').toLowerCase();
  const targets = new Set(['celular', 'cidade', 'dataatestado', 'motivoafastamento', 'nomemedico', 'periodicidade', 'telefone']);
  return targets.has(n);
}
function __fmtDate(val: any): string {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  const m = s.match(/^(\\d{4})-(\\d{2})-(\\d{2})(?:[ T].*)?$/);
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

// ---- Regional detection core ----
const _NORM = (s: string) => s.normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();

// Pistas por nome
const NAME_HINTS = [
  'unidade','unid','nmdeunidade','nm_unidade','unidade_lotacao','lotacao','estabelecimento',
  'hospital','empresa','localtrabalho','localdetrabalho','setor','departamento'
];

// Votação por conteúdo (qual coluna parece mais "unidade" olhando os valores)
function detectUnidadeKeyByVoting(rows: AnyRow[], sampleSize = 200): { key: string|null, votes: Record<string, number> } {
  const votes: Record<string, number> = {};
  if (!rows?.length) return { key: null, votes };
  const keys = Object.keys(rows[0] || {});
  const top = rows.slice(0, Math.min(sampleSize, rows.length));
  for (const k of keys) {
    let v = 0;
    for (const r of top) {
      const raw = r?.[k];
      if (raw == null) continue;
      const s = String(raw);
      if (!s) continue;
      const canon = canonUnidade(s);
      if (canon && (UNID_TO_REGIONAL as any)[canon]) v++;
    }
    votes[k] = v;
  }
  const best = Object.entries(votes).sort((a,b)=>b[1]-a[1])[0];
  return { key: (best && best[1] > 0) ? best[0] : null, votes };
}
function detectUnidadeKey(rows: AnyRow[]): { key: string|null, votes: Record<string, number> } {
  const byVote = detectUnidadeKeyByVoting(rows);
  if (byVote.key) return byVote;
  if (!rows?.length) return { key: null, votes: byVote.votes };
  const keys = Object.keys(rows[0] || {});
  const scoreByName: Record<string, number> = {};
  for (const k of keys) {
    const n = _NORM(k);
    let s = 0;
    for (const hint of NAME_HINTS) if (n.includes(hint)) s++;
    scoreByName[k] = s;
  }
  const best = Object.entries(scoreByName).sort((a,b)=>b[1]-a[1])[0];
  return { key: (best && best[1] > 0) ? best[0] : null, votes: byVote.votes };
}

// ---- Fetch helpers ----
async function fetchJSON(url: string, init?: RequestInit): Promise<{json:any, headers: Headers}> {
  const r = await fetch(url, init);
  const text = await r.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { ok:false, error: 'JSON inválido', raw: text }; }
  return { json, headers: r.headers };
}

async function fetchPage(page: number, limit: number): Promise<{data: ApiRows, headers: Headers}> {
  const params = new URLSearchParams({ page:String(page), limit:String(limit) });
  const { json, headers } = await fetchJSON('/api/alterdata/raw-rows?' + params.toString(), { cache: 'force-cache' });
  if (!json?.ok) throw new Error(json?.error || 'Falha ao carregar página '+page);
  return { data: json as ApiRows, headers };
}

export default function Page() {
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<AnyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [unidKey, setUnidKey] = useState<string | null>(null);
  const [votePeek, setVotePeek] = useState<string>(''); // diagnóstico leve

  // Paginação (cliente)
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);

  const [q, setQ] = useState('');
  const [regional, setRegional] = useState<Regional | 'TODAS'>('TODAS');
  const [unidade, setUnidade] = useState<string | 'TODAS'>('TODAS');

  const fetchedRef = useRef(false);

  // Resetar página quando filtros mudarem
  useEffect(()=>{ setPage(1); }, [q, regional, unidade, pageSize]);

  useEffect(()=>{
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    let on = true;
    (async ()=>{
      setLoading(true); setError(null); setProgress('');
      try{
        const { json: jCols } = await fetchJSON('/api/alterdata/raw-columns', { cache: 'force-cache' });
        if (!jCols?.ok) throw new Error(jCols?.error || 'Falha em raw-columns');
        const baseCols = (Array.isArray(jCols?.columns) ? jCols.columns : []) as string[];
        const batchId = jCols?.batch_id || null;

        // Cache por batch_id
        try{
          const raw = window.localStorage.getItem(LS_KEY_ALTERDATA);
          if (raw) {
            const cached = JSON.parse(raw);
            if (cached && cached.batch_id === batchId && Array.isArray(cached.rows) && Array.isArray(cached.columns)) {
              if(on){
                setColumns(cached.columns);
                setRows(cached.rows);
                setUnidKey(cached.unidKey || null);
                setVotePeek(cached.votePeek || '');
                setLoading(false);
                return;
              }
            }
          }
        }catch{}

        // Carrega todas as páginas
        const first = await fetchPage(1, 200);
        const total = first.data.total || first.data.rows.length;
        const limit = first.data.limit || 200;
        const pages = Math.max(1, Math.ceil(total / limit));
        const acc: AnyRow[] = [...first.data.rows.map(r => ({ row_no: r.row_no, ...r.data }))];
        if (on) setProgress(`${acc.length}/${total}`);

        for (let p = 2; p <= pages; p++) {
          const res = await fetchPage(p, limit);
          acc.push(...res.data.rows.map(r => ({ row_no: r.row_no, ...r.data })));
          if (on) setProgress(`${Math.min(acc.length,total)}/${total}`);
        }

        // Detecta coluna de unidade por votação
        const det = detectUnidadeKey(acc);
        const uk = det.key;

        // Mapeia regional
        const withReg = acc.map(r => {
          const rawUn = uk ? String(r[uk] ?? '') : '';
          const canon = canonUnidade(rawUn);
          const reg = (UNID_TO_REGIONAL as any)[canon] || '';
          return { ...r, regional: reg };
        });

        const cols = baseCols.includes('regional') ? baseCols : ['regional', ...baseCols];
        const peek = uk ? `unidKey=${uk} votes=${JSON.stringify(det.votes)}` : `unidKey=? votes=${JSON.stringify(det.votes)}`;

        if(on){
          setColumns(cols);
          setRows(withReg);
          setUnidKey(uk);
          setVotePeek(peek);
          try { window.localStorage.setItem(LS_KEY_ALTERDATA, JSON.stringify({ batch_id: batchId, rows: withReg, columns: cols, unidKey: uk, votePeek: peek })); } catch {}
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
    const uk = unidKey;
    if (!uk) return [];
    const base = regional === 'TODAS' ? rows : rows.filter(r => r.regional === regional);
    return uniqueSorted(base.map(r => String(r[uk] ?? '')).filter(Boolean));
  }, [rows, regional, unidKey]);

  // Aplica filtros (client-side)
  const filtered = useMemo(()=>{
    const uk = unidKey;
    let list = rows;
    if (regional !== 'TODAS') list = list.filter(r => r.regional === regional);
    if (uk && unidade !== 'TODAS') list = list.filter(r => String(r[uk] ?? '') === unidade);
    if (q.trim()) {
      const needles = q.toLowerCase().split(/\\s+/).filter(Boolean);
      list = list.filter(r => {
        const blob = Object.values(r).join(' ').toLowerCase();
        return needles.every(n => blob.includes(n));
      });
    }
    return list;
  }, [rows, regional, unidade, q, unidKey]);

  // Paginação (client-side) sobre os filtrados
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(page, pageCount);
  const start = (pageSafe - 1) * pageSize;
  const end = start + pageSize;
  const paged = filtered.slice(start, end);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="text-lg font-semibold">Alterdata — Base Completa</div>
        {/* Selo de diagnóstico */}
        {votePeek && <span className="text-[10px] px-2 py-1 rounded bg-neutral-100">{votePeek}</span>}
      </div>
      <p className="text-sm opacity-70">Visual com Regional (join no cliente), busca livre, filtros e **paginação no cliente**. Nada altera a base ou o upload.</p>

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
                disabled={!unidKey}
                className="px-3 py-2 rounded-xl bg-neutral-100 text-sm text-neutral-900">
          <option value="TODAS">Unidade (todas)</option>
          {unidadeOptions.map(u => <option key={u} value={u}>{u}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-3 text-sm">
          {/* Controles de paginação */}
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 rounded border disabled:opacity-40"
                    disabled={pageSafe<=1}
                    onClick={()=>setPage(p=>Math.max(1, p-1))}>
              ◀
            </button>
            <div>Página {pageSafe} / {pageCount}</div>
            <button className="px-3 py-1 rounded border disabled:opacity-40"
                    disabled={pageSafe>=pageCount}
                    onClick={()=>setPage(p=>Math.min(pageCount, p+1))}>
              ▶
            </button>
          </div>
          <select value={pageSize} onChange={e=>setPageSize(parseInt(e.target.value,10))}
                  className="px-2 py-1 rounded border text-sm">
            {[25,50,100,200,500].map(n=> <option key={n} value={n}>{n}/página</option>)}
          </select>
          <div className="opacity-60">{filtered.length.toLocaleString()} registros</div>
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
              {paged.map((r, idx) => (
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

      <div className="text-xs opacity-60">
        Exibindo {start+1}–{Math.min(end, filtered.length)} de {filtered.length} registros (lista completa em cache, paginação no cliente)
      </div>
    </div>
  );
}
