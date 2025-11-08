export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { UNID_TO_REGIONAL, canonUnidade } from '@/lib/unidReg';

type Row = { id: string; nome: string; funcao: string; unidade: string; regional: string; nome_site?: string | null };

function normUp(s: any): string {
  return (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
}
function norm(s: any): string {
  return (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
}

function detectUnidKey(rows: any[], sample = 400): string | null {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0] || {});
  const top = rows.slice(0, Math.min(sample, rows.length));
  let bestKey: string | null = null;
  let bestScore = -1;
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
    if (v > bestScore) { bestScore = v; bestKey = v > 0 ? k : bestKey; }
  }
  return bestKey;
}

function pickKeyByName(rows: any[], hints: string[]): string | null {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0] || {});
  let bestKey: string | null = null;
  let bestScore = -1;
  for (const k of keys) {
    const nk = norm(k);
    let s = 0;
    for (const h of hints) if (nk.includes(h)) s++;
    if (s > bestScore) { bestScore = s; bestKey = s > 0 ? k : bestKey; }
  }
  return bestKey;
}

async function fetchRawRows(origin: string, page: number, limit: number) {
  const u = new URL('/api/alterdata/raw-rows', origin);
  u.searchParams.set('page', String(page));
  u.searchParams.set('limit', String(limit));
  u.searchParams.set('pageSize', String(limit));
  const r = await fetch(u.toString(), { cache: 'no-store' });
  const data = await r.json().catch(()=>({}));
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const flat = rows.map((it: any) => ({ row_no: it.row_no, ...(it.data || {}) }));
  const total = Number(data?.total || flat.length);
  const lim = Number(data?.limit || limit);
  return { rows: flat, total, limit: lim };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const regional = url.searchParams.get('regional') || '';
  const unidade  = url.searchParams.get('unidade')  || '';
  const q        = url.searchParams.get('q')        || '';
  const page     = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(200, Math.max(10, parseInt(url.searchParams.get('pageSize') || '25', 10)));

  try {
    const first = await fetchRawRows(url.origin, 1, 500);
    let acc = first.rows.slice();
    const pages = Math.max(1, Math.ceil(first.total / first.limit));
    for (let p = 2; p <= Math.min(pages, 3); p++) {
      const more = await fetchRawRows(url.origin, p, first.limit);
      acc = acc.concat(more.rows);
    }

    const cpfKey  = pickKeyByName(acc, ['cpf','matric']);
    const nomeKey = pickKeyByName(acc, ['nome']);
    const funcKey = pickKeyByName(acc, ['func','cargo']);
    const unidKey = detectUnidKey(acc);

    let rows: Row[] = acc.map(r => {
      const idRaw = cpfKey ? r[cpfKey] : '';
      const id = String(idRaw ?? '').replace(/\D/g,'').slice(-11);
      const nome = String((nomeKey && r[nomeKey]) ?? '');
      const func = String((funcKey && r[funcKey]) ?? '');
      const un   = String((unidKey && r[unidKey]) ?? '');
      const canon = canonUnidade(un);
      const reg = ((UNID_TO_REGIONAL as any)[canon]) || '';
      return { id, nome, funcao: func, unidade: un, regional: reg, nome_site: null };
    }).filter(x => x.id || x.nome || x.unidade);

    const nreg = normUp(regional);
    const nuni = normUp(unidade);
    const nq   = normUp(q);
    if (nreg) rows = rows.filter(r => normUp(r.regional) === nreg);
    if (nuni) rows = rows.filter(r => normUp(r.unidade) === nuni);
    if (nq)   rows = rows.filter(r => normUp(r.nome).includes(nq) || normUp(r.id).includes(nq));

    rows.sort((a,b)=> a.nome.localeCompare(b.nome));
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);

    return NextResponse.json({ rows: pageRows, total, page, pageSize, source: 'mirror_alterdata_no_demis' });
  } catch (e: any) {
    return NextResponse.json({ rows: [], total: 0, page: page, pageSize, error: e?.message || String(e), source: 'mirror_error' }, { status: 200 });
  }
}