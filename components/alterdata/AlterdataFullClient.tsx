'use client';

import React from 'react';
import { UNID_TO_REGIONAL, REGIONALS, canonUnidade, Regional } from '@/lib/unidReg';

type Row = Record<string, any>;

// Heurística para descobrir o campo de unidade vindo do Alterdata
function guessUnidadeKey(rows: Row[]): string {
  if (!rows?.length) return 'unidade';
  const sample = Object.keys(rows[0]);
  const prefs = ['unidade', 'unid', 'unidade hospitalar', 'hospital', 'setor'];
  for (const k of sample) {
    const norm = k.toLowerCase();
    if (prefs.some(p => norm.includes(p))) return k;
  }
  return sample.find(k => k.toLowerCase().includes('unid')) ?? 'unidade';
}

// Aplica derivação de Regional + normalização
function enrich(rows: Row[]): Row[] {
  const unidadeKey = guessUnidadeKey(rows);
  return rows.map(r => {
    const uni = r[unidadeKey];
    const regional = UNID_TO_REGIONAL[canonUnidade(String(uni || ''))] ?? null;
    return { ...r, __unidadeKey: unidadeKey, regional };
  });
}

function uniqueSorted(arr: (string|null|undefined)[]) {
  return Array.from(new Set(arr.filter(Boolean) as string[])).sort((a,b)=>a.localeCompare(b,'pt-BR'));
}

export default function AlterdataFullClient() {
  const [rows, setRows] = React.useState<Row[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);

  const [q, setQ] = React.useState('');
  const [regional, setRegional] = React.useState<Regional | 'TODAS'>('TODAS');
  const [unidade, setUnidade] = React.useState<string | 'TODAS'>('TODAS');
  const [status, setStatus] = React.useState<string | 'TODOS'>('TODOS');

  const unidadeKey = React.useMemo(()=>guessUnidadeKey(rows), [rows]);

  React.useEffect(() => {
    let abort = false;
    async function load() {
      setLoading(true); setErr(null);
      try {
        // Nota: a rota já existe no projeto
        const r = await fetch('/api/alterdata/raw-rows', { cache: 'no-store' });
        if (!r.ok) throw new Error('Falha ao carregar a base do Alterdata');
        const data = await r.json();
        const list: Row[] = Array.isArray(data?.rows) ? data.rows : Array.isArray(data) ? data : [];
        if (!abort) setRows(enrich(list));
      } catch (e:any) {
        if (!abort) setErr(e.message || 'Erro desconhecido');
      } finally {
        if (!abort) setLoading(false);
      }
    }
    load();
    return () => { abort = true; };
  }, []);

  // Opções de unidade dependentes da Regional
  const unidadeOptions = React.useMemo(() => {
    const base = regional === 'TODAS' ? rows : rows.filter(r => r.regional === regional);
    const opts = uniqueSorted(base.map(r => String(r[unidadeKey] ?? '')).filter(Boolean));
    return opts;
  }, [rows, regional, unidadeKey]);

  // Filtro principal
  const filtered = React.useMemo(() => {
    let list = rows;
    if (regional !== 'TODAS') {
      list = list.filter(r => r.regional === regional);
    }
    if (unidade !== 'TODAS') {
      list = list.filter(r => String(r[unidadeKey] ?? '') === unidade);
    }
    // status opcional – tenta achar coluna por heurística
    if (status !== 'TODOS') {
      const statusKey = Object.keys(rows[0] ?? {}).find(k => k.toLowerCase().includes('status')) ?? null;
      if (statusKey) {
        list = list.filter(r => String(r[statusKey] ?? '').toUpperCase() === String(status).toUpperCase());
      }
    }
    if (q.trim()) {
      const needles = q.toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter(r => {
        const blob = Object.values(r).join(' ').toLowerCase();
        return needles.every(n => blob.includes(n));
      });
    }
    return list;
  }, [rows, regional, unidade, status, q, unidadeKey]);

  // Cabeçalhos/ordem
  const columns = React.useMemo(() => {
    const keys = Object.keys(rows[0] ?? {});
    // Garante coluna 'regional' e joga ela perto de 'unidade'
    const uIdx = keys.findIndex(k => k.toLowerCase().includes('unid'));
    const out = [...keys.filter(k => k !== 'regional'), 'regional'];
    if (uIdx >= 0) {
      // manter ordem aproximada
    }
    return out;
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={q}
          onChange={e=>setQ(e.target.value)}
          placeholder="Buscar por nome, CPF, matrícula, unidade..."
          className="px-3 py-2 rounded-xl bg-neutral-800 text-sm w-full md:w-96 outline-none"
        />
        <select value={regional} onChange={e=>{ setRegional(e.target.value as any); setUnidade('TODAS'); }}
                className="px-3 py-2 rounded-xl bg-neutral-800 text-sm">
          <option value="TODAS">Regional (todas)</option>
          {REGIONALS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={unidade} onChange={e=>setUnidade(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-neutral-800 text-sm">
          <option value="TODAS">Unidade (todas)</option>
          {unidadeOptions.map(u => <option key={u} value={u}>{u}</option>)}
        </select>
        {/* Status opcional mantém compatibilidade sem quebrar */}
        <select value={status} onChange={e=>setStatus(e.target.value as any)}
                className="px-3 py-2 rounded-xl bg-neutral-800 text-sm">
          <option value="TODOS">Status (todos)</option>
          <option value="ATIVO">ATIVO</option>
          <option value="INATIVO">INATIVO</option>
        </select>
        {/* Removido seletor de X/página por solicitação */}
      </div>

      {loading && <div className="text-sm opacity-70">Carregando base...</div>}
      {err && <div className="text-sm text-red-400">Erro: {err}</div>}

      {!loading && !err && (
        <div className="rounded-2xl overflow-hidden border border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-900">
              <tr>
                {columns.map((c,i) => (
                  <th key={i} className="text-left px-3 py-2 font-medium sticky top-0">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {filtered.map((r, idx) => (
                <tr key={idx} className="hover:bg-neutral-900/50">
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
