export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

type Row = { id: string; nome: string; funcao: string; unidade: string; regional: string };

function normUp(s: any): string {
  return (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
}
function normKey(s: any): string {
  return (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
}
function onlyDigits(v: any): string {
  const s = String(v ?? '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 48 && c <= 57) out += s[i];
  }
  return out;
}

function pickKeyByName(rows: any[], hints: string[]): string | null {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0] || {});
  let bestKey: string | null = null;
  let bestScore = -1;
  for (const k of keys) {
    const nk = normKey(k);
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
  if (!r.ok) throw new Error(`alterdata/raw-rows ${r.status}`);
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
    for (let p = 2; p <= Math.min(pages, 5); p++) {
      const more = await fetchRawRows(url.origin, p, first.limit);
      acc = acc.concat(more.rows);
    }

    const cpfKey  = pickKeyByName(acc, ['cpf','matric','cpffunc','cpffuncionario']);
    const nomeKey = pickKeyByName(acc, ['nome','colab','funcionario']);
    const funcKey = pickKeyByName(acc, ['func','cargo']);
    const unidKey = pickKeyByName(acc, ['unid','lotac','setor','hosp','posto','local']);

    let rows: Row[] = acc.map(r => {
      const idRaw = cpfKey ? r[cpfKey] : '';
      const id = onlyDigits(idRaw).slice(-11);
      const nome = String((nomeKey && r[nomeKey]) ?? '');
      const func = String((funcKey && r[funcKey]) ?? '');
      const un   = String((unidKey && r[unidKey]) ?? '');
      const regKey = pickKeyByName([r], ['regi','regional','gerencia']);
      const reg = String((regKey && r[regKey]) ?? '');
      return { id, nome, funcao: func, unidade: un, regional: reg };
    }).filter(x => x.id || x.nome || x.unidade);

    const nreg = normUp(regional);
    const nuni = normUp(unidade);
    const nq   = normUp(q);
    if (nreg) rows = rows.filter(r => !nreg || normUp(r.regional) === nreg || !r.regional);
    if (nuni) rows = rows.filter(r => normUp(r.unidade) === nuni);
    if (nq)   rows = rows.filter(r => normUp(r.nome).includes(nq) || normUp(r.id).includes(nq));

    rows.sort((a,b)=> a.nome.localeCompare(b.nome));
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);

    return NextResponse.json({ rows: pageRows, total, page, pageSize, source: 'safe_mirror' });
  } catch (e:any) {
    return NextResponse.json({ rows: [], total: 0, page, pageSize, source: 'error', error: e?.message || String(e) }, { status: 200 });
  }
}