
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { UNID_TO_REGIONAL, canonUnidade } from '@/lib/unidReg';
import prisma from '@/lib/prisma';

type Row = {
  id: string;
  nome: string;
  funcao: string;
  unidade: string;
  regional: string;
  kit?: string;
  kitEsperado?: string;
  kit_esperado?: string;
};

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

async function fetchRawRows(origin: string, page: number, limit: number, req: Request) {
  const u = new URL('/api/alterdata/raw-rows', origin);
  u.searchParams.set('page', String(page));
  u.searchParams.set('limit', String(limit));
  u.searchParams.set('pageSize', String(limit));
  const cookie = req.headers.get('cookie') || '';
  const auth = req.headers.get('authorization') || '';
  const r = await fetch(u.toString(), {
    cache: 'no-store',
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(auth ? { authorization: auth } : {}),
    },
  });
  if (!r.ok) throw new Error(`alterdata/raw-rows ${r.status}`);
  const data = await r.json().catch(()=>({}));
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  const flat = rows.map((it: any) => ({ row_no: it.row_no, ...(it.data || {}) }));
  const total = Number(data?.total || flat.length);
  const lim = Number(data?.limit || limit);
  return { rows: flat, total, limit: lim };
}

async function loadUnidMapFromDB(): Promise<Record<string,string>> {
  try {
    const rs = await prisma.$queryRaw<any[]>`SELECT unidade, regional FROM stg_unid_reg`;
    const map: Record<string,string> = {};
    for (const r of rs) {
      const uni = String(r.unidade ?? '');
      const reg = String(r.regional ?? '');
      const canon = canonUnidade(uni);
      if (canon && reg) map[canon] = reg;
    }
    return map;
  } catch {
    return {};
  }
}

async function loadKitMap(): Promise<Record<string, {item:string,qtd:number}[]>> {
  try {
    const rs = await prisma.$queryRaw<any[]>`
      SELECT
        COALESCE(alterdata_funcao::text,'') AS func,
        COALESCE(nome_site::text,'')        AS site,
        COALESCE(epi_item::text,'')         AS item,
        COALESCE(quantidade::numeric,0)     AS qtd
      FROM stg_epi_map
    `;
    const map: Record<string, {item:string,qtd:number}[]> = {};
    for (const r of rs) {
      const keyFunc = normKey(r.func);
      const keySite = normKey(r.site);
      if (keyFunc) {
        if (!map[keyFunc]) map[keyFunc] = [];
        map[keyFunc].push({ item: String(r.item || ''), qtd: Number(r.qtd || 0) });
      }
      if (keySite) {
        if (!map[keySite]) map[keySite] = [];
        map[keySite].push({ item: String(r.item || ''), qtd: Number(r.qtd || 0) });
      }
    }
    return map;
  } catch {
    return {};
  }
}

function formatKit(items?: {item:string,qtd:number}[] | undefined): string {
  if (!items || !items.length) return '—';
  return items
    .filter(x => x.item)
    .map(x => `${x.item}${x.qtd ? ` x${x.qtd}` : ''}`)
    .join(' / ');
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const regional = url.searchParams.get('regional') || '';
  const unidade  = url.searchParams.get('unidade')  || '';
  const q        = url.searchParams.get('q')        || '';
  const page     = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(200, Math.max(10, parseInt(url.searchParams.get('pageSize') || '25', 10)));

  try {
    // 1) Carrega **todas** as páginas do raw-rows (sem limite)
    const limit = 1000; // tenta maior para reduzir quantidade de páginas
    const first = await fetchRawRows(url.origin, 1, limit, req);
    let acc = first.rows.slice();
    const pages = Math.max(1, Math.ceil(first.total / first.limit));
    for (let p = 2; p <= pages; p++) {
      const more = await fetchRawRows(url.origin, p, first.limit, req);
      acc = acc.concat(more.rows);
      // proteção simples: se por algum motivo acc já cobre total, para
      if (acc.length >= first.total) break;
    }

    // 2) Detecta chaves
    const cpfKey  = pickKeyByName(acc, ['cpf','matric','cpffunc','cpffuncionario']);
    const nomeKey = pickKeyByName(acc, ['nome','colab','funcionario']);
    const funcKey = pickKeyByName(acc, ['func','cargo']);
    const unidKey = pickKeyByName(acc, ['unid','lotac','setor','hosp','posto','local']);
    const regKey  = pickKeyByName(acc, ['regi','regional','gerencia']); // se existir direto no dataset

    // 3) Carrega mapas auxiliares
    const [unidDBMap, kitMap] = await Promise.all([loadUnidMapFromDB(), loadKitMap()]);

    // 4) Mapeia linhas + regional + kit
    let rows: Row[] = acc.map(r => {
      const idRaw = cpfKey ? r[cpfKey] : '';
      const id = onlyDigits(idRaw).slice(-11);
      const nome = String((nomeKey && r[nomeKey]) ?? '');
      const func = String((funcKey && r[funcKey]) ?? '');
      const un   = String((unidKey && r[unidKey]) ?? '');
      // Regional por prioridade: coluna direta -> lib/unidReg -> tabela stg_unid_reg
      let reg = String((regKey && r[regKey]) ?? '');
      if (!reg) {
        const canon = canonUnidade(un);
        reg = (UNID_TO_REGIONAL as any)[canon] || unidDBMap[canon] || '';
      }
      const k1 = normKey(func);
      const k2 = normKey(un);
      const kitItems = (k1 && kitMap[k1]) || (k2 && kitMap[k2]) || undefined;
      const kitStr = formatKit(kitItems);
      return {
        id, nome, funcao: func, unidade: un, regional: reg || '—',
        kit: kitStr, kitEsperado: kitStr, kit_esperado: kitStr
      };
    }).filter(x => x.id || x.nome || x.unidade);

    // 5) Filtros (regional leniente: aceita vazio/—)
    const nreg = normUp(regional);
    const nuni = normUp(unidade);
    const nq   = normUp(q);
    if (nreg) rows = rows.filter(r => !nreg || normUp(r.regional) === nreg || r.regional === '—');
    if (nuni) rows = rows.filter(r => normUp(r.unidade) === nuni);
    if (nq)   rows = rows.filter(r => normUp(r.nome).includes(nq) || normUp(r.id).includes(nq));

    // 6) Pagina
    rows.sort((a,b)=> a.nome.localeCompare(b.nome));
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);

    return NextResponse.json({ rows: pageRows, total, page, pageSize, source: 'safe_mirror_auth+regional+kit+ALL' });
  } catch (e:any) {
    return NextResponse.json({ rows: [], total: 0, page, pageSize, source: 'error', error: e?.message || String(e) }, { status: 200 });
  }
}
