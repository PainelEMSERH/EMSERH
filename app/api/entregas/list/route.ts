export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { UNID_TO_REGIONAL, canonUnidade } from '@/lib/unidReg';

type Row = { id: string; nome: string; funcao: string; unidade: string; regional: string; nome_site?: string | null; };

function norm(s: any): string {
  return (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
}
function normUp(s: any): string {
  return (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
}
function parseDate(s: any): Date | null {
  if (s == null) return null;
  const str = String(s).trim();
  if (!str) return null;
  let m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}`);
  m = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return new Date(`${m[3]}-${m[2]}-${m[1]}`);
  m = str.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return new Date(`${m[1]}-${m[2]}-${m[3]}`);
  return null;
}

function detectUnidKey(rows: any[], sample = 400): { key: string | null; votes: Record<string, number>} {
  const votes: Record<string, number> = {};
  if (!rows.length) return { key: null, votes };
  const keys = Object.keys(rows[0] || {});
  const top = rows.slice(0, Math.min(sample, rows.length));
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

function pickKeyByName(rows: any[], hints: string[]): string | null {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0] || {});
  const score: Record<string, number> = {};
  for (const k of keys) {
    const n = norm(k);
    let s = 0;
    for (const h of hints) if (n.includes(h)) s++;
    score[k] = s;
  }
  const best = Object.entries(score).sort((a,b)=>b[1]-a[1])[0];
  return (best && best[1] > 0) ? best[0] : null;
}

async function fetchRawRows(origin: string, page: number, limit: number) {
  const u = new URL('/api/alterdata/raw-rows', origin);
  u.searchParams.set('page', String(page));
  u.searchParams.set('limit', String(limit));
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
    const first = await fetchRawRows(url.origin, 1, 200);
    let acc = first.rows.slice();
    const pages = Math.max(1, Math.ceil(first.total / first.limit));
    for (let p = 2; p <= Math.min(pages, 5); p++) {
      const more = await fetchRawRows(url.origin, p, first.limit);
      acc = acc.concat(more.rows);
    }

    const cpfKey  = pickKeyByName(acc, ['cpf','matric']);
    const nomeKey = pickKeyByName(acc, ['nome']);
    const funcKey = pickKeyByName(acc, ['func','cargo']);
    const demKey  = pickKeyByName(acc, ['demi','deslig','rescis','demiss']);
    const detUn   = detectUnidKey(acc);
    const unidKey = detUn.key;

    let rowsTmp: Row[] = [];
    for (const r of acc) {
      const id  = String((cpfKey && r[cpfKey]) || '').replace(/\D/g,'').slice(-11);
      const nome = String((nomeKey && r[nomeKey]) || '');
      if (!id && !nome) continue;
      const func = String((funcKey && r[funcKey]) || '');
      const un   = String((unidKey && r[unidKey]) || '');
      const canon = canonUnidade(un);
      const reg = ((UNID_TO_REGIONAL as any)[canon]) || '';

      // filtro demissão
      const dem = demKey ? parseDate(r[demKey]) : null;
      if (dem && dem < new Date('2025-01-01')) continue;

      rowsTmp.push({ id, nome, funcao: func, unidade: un, regional: reg });
    }

    // filtros
    const nreg = normUp(regional);
    const nuni = normUp(unidade);
    const nq   = normUp(q);
    let rows: Row[] = rowsTmp;
    if (nreg) rows = rows.filter(r => normUp(r.regional) === nreg);
    if (nuni) rows = rows.filter(r => normUp(r.unidade) === nuni);
    if (nq) rows = rows.filter(r => normUp(r.nome).includes(nq) || normUp(r.id).includes(nq));

    rows.sort((a,b)=> a.nome.localeCompare(b.nome));
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);

    return NextResponse.json({ rows: pageRows, total, page, pageSize, source: 'raw-rows+detect' });
  } catch (e: any) {
    return NextResponse.json({ rows: [], total: 0, page, pageSize, error: e?.message || String(e), source: 'error' }, { status: 200 });
  }
}