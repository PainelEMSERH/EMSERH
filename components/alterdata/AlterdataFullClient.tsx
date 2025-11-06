'use client';

import React from 'react';
import { UNID_TO_REGIONAL, REGIONALS, canonUnidade, Regional } from '@/lib/unidReg';

type AnyRow = Record<string, any>;

// Normalize object: if row has a `data` object, flatten it; keep row_id if present
function flattenRow(r: AnyRow): AnyRow {
  const data = (r && typeof r.data === 'object' && r.data !== null) ? r.data : r;
  const out: AnyRow = { ...(data || {}) };
  if ('row_id' in r && !('row_id' in out)) out.row_id = r.row_id;
  return out;
}

// Guess which column is Unidade
function findUnidadeKey(rows: AnyRow[]): string | null {
  if (!rows?.length) return null;
  const keys = Object.keys(rows[0]);
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const byScore = keys.map(k => {
    const n = norm(k);
    let score = 0;
    if (n.includes('unid')) score += 4;
    if (n.includes('hospital')) score += 3;
    if (n.includes('estab')) score += 2;
    if (/^unidade(\s|$)/.test(n)) score += 5;
    if (n.includes('setor')) score += 1;
    return { k, score };
  }).sort((a,b)=>b.score - a.score);
  return byScore[0]?.score ? byScore[0].k : null;
}

// Guess optional Status key (if exists)
function findStatusKey(rows: AnyRow[]): string | null {
  if (!rows?.length) return null;
  const keys = Object.keys(rows[0]);
  const norm = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const cand = keys.find(k => norm(k).includes('status')) || null;
  return cand;
}

function uniqueSorted(arr: (string|null|undefined)[]) {
  return Array.from(new Set(arr.filter(Boolean) as string[])).sort((a,b)=>a.localeCompare(b,'pt-BR'));
}

// Coerce unknown arrays to string[] safely
function asStringArray(a: any): string[] {
  return Array.isArray(a) ? a.map((x: any) => String(x)) : [];
}

export default function AlterdataFullClient() {
  const [rows, setRows] = React.useState<AnyRow[]>([]);
  const [columns, setColumns] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const [q, setQ] = React.useState('');
  const [regional, setRegional] = React.useState<Regional | 'TODAS'>('TODAS');
  const [unidade, setUnidade] = React.useState<string | 'TODAS'>('TODAS');
  const [status, setStatus] = React.useState<string | 'TODOS'>('TODOS');

  const unidadeKey = React.useMemo(()=> findUnidadeKey(rows), [rows]);
  const statusKey = React.useMemo(()=> findStatusKey(rows), [rows]);

  React.useEffect(() => {
    let abort = false;
    async function load() {
      setLoading(true); setErr(null);
      try {
        const [colsRes, rowsRes] = await Promise.all([
          fetch('/api/alterdata/raw-columns', { cache: 'no-store' }),
          fetch('/api/alterdata/raw-rows', { cache: 'no-store' })
        ]);
        if (!colsRes.ok) throw new Error('Falha ao carregar colunas');
        if (!rowsRes.ok) throw new Error('Falha ao carregar linhas');
        const colsJson = await colsRes.json();
        const rowsJson = await rowsRes.json();

        // Normalize columns to string[]
        const colsArrCandidate = Array.isArray(colsJson?.columns) ? colsJson.columns
                              : Array.isArray(colsJson) ? colsJson
                              : Object.values(colsJson || {});
        const colsArr: string[] = asStringArray(colsArrCandidate);
        const baseCols: string[] = Array.from(new Set(colsArr.map(String)));

        // Normalize rows and flatten
        const rowsArrCandidate = Array.isArray(rowsJson?.rows) ? rowsJson.rows
                               : Array.isArray(rowsJson) ? rowsJson
                               : Array.isArray(rowsJson?.data) ? rowsJson.data
                               : [];
        const rawArr: AnyRow[] = Array.isArray(rowsArrCandidate) ? rowsArrCandidate as AnyRow[] : [];
        const flat = rawArr.map(flattenRow);

        // inject regional
        const uk = findUnidadeKey(flat);
        const withRegional = flat.map(r => {
          const un = uk ? (r[uk] ?? '') : '';
          const reg = UNID_TO_REGIONAL[canonUnidade(String(un))] ?? null;
          return { ...r, regional: reg };
        });

        // final columns: move 'regional' next to unidade (if any)
        let cols: string[] = [...baseCols.filter(c => c !== 'regional')];
        if (uk && !cols.includes('regional')) {
          const idx = cols.findIndex(c => c === uk);
          if (idx >= 0) cols.splice(idx + 1, 0, 'regional');
          else cols.push('regional');
        } else if (!cols.includes('regional')) {
          cols.push('regional');
        }

        if (!abort) {
          setRows(withRegional);
          setColumns(cols);
        }
      } catch (e:any) {
        if (!abort) setErr(e.message || 'Erro desconhecido');
      } finally {
        if (!abort) setLoading(false);
      }
    }
    load();
    return () => { abort = true; };
  }, []);

  // Unidade options depend on Regional
  const unidadeOptions = React.useMemo(() => {
    const uk = unidadeKey;
    if (!uk) return [];
    const base = regional === 'TODAS' ? rows : rows.filter(r => r.regional === regional);
    const opts = uniqueSorted(base.map(r => String(r[uk] ?? '')).filter(Boolean));
    return opts;
  }, [rows, regional, unidadeKey]);

  // Filtering
  const filtered = React.useMemo(() => {
    const uk = unidadeKey;
    let list = rows;
    if (regional !== 'TODAS') list = list.filter(r => r.regional === regional);
    if (uk && unidade !== 'TODAS') list = list.filter(r => String(r[uk] ?? '') === unidade);
    if (statusKey && status !== 'TODOS') {
      list = list.filter(r => String(r[statusKey] ?? '').toUpperCase() === String(status).toUpperCase());
    }
    if (q.trim()) {
      const needles = q.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter(r => {
        const blob = Object.values(r).join(' ').toLowerCase();
        return needles.every(n => blob.includes(n));
      });
    }
    return list;
  }, [rows, regional, unidade, status, q, unidadeKey, statusKey]);

  return (
    <div className="space-y-4">
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
        {statusKey && (
          <select value={status} onChange={e=>setStatus(e.target.value as any)}
                  className="px-3 py-2 rounded-xl bg-neutral-100 text-sm text-neutral-900">
            <option value="TODOS">Status (todos)</option>
            <option value="ATIVO">ATIVO</option>
            <option value="INATIVO">INATIVO</option>
          </select>
        )}
        {/* Sem seletor de paginação */}
      </div>

      {loading && <div className="text-sm opacity-70">Carregando base...</div>}
      {err && <div className="text-sm text-red-600">Erro: {err}</div>}

      {!loading && !err && (
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
                    <td key={i} className="px-3 py-2 whitespace-nowrap">{String(r[c] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="text-xs opacity-60">{filtered.length} registros (lista completa, sem paginação)</div>
    </div>
  );
}
