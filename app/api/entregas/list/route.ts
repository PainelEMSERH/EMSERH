
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

function prettyRegional(reg: any): string {
  const n = normUp(reg);
  if (!n || n === '-' || n === '—') return '—';
  if (n === 'NORTE') return 'Norte';
  if (n === 'SUL') return 'Sul';
  if (n === 'LESTE') return 'Leste';
  if (n === 'CENTRO' || n === 'CENTRAL') return 'Central';
  return (reg ?? '').toString() || '—';
}

function normKey(s: any): string {
  return (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
}
function normFuncKey(s: any): string {
  const raw = (s ?? '').toString();
  const cleaned = raw.replace(/\(A\)/gi, '').replace(/\s+/g, ' ');
  return normKey(cleaned);
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


function esc(s: string): string {
  return (s ?? '').toString().replace(/'/g, "''");
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



type RawRowsCache = { rows: any[]; total: number; limit: number; ts: number };

let RAW_ROWS_CACHE: RawRowsCache | null = null;
let UNID_MAP_CACHE: { map: Record<string, string>; ts: number } | null = null;
let KIT_MAP_CACHE: { map: Record<string, { item: string; qtd: number }[]>; ts: number } | null = null;

const RAW_TTL_MS = 5 * 60 * 1000; // 5 minutos
const MAP_TTL_MS = 60 * 60 * 1000; // 1 hora

async function loadSafeRawRows(origin: string, req: Request): Promise<RawRowsCache> {
  const now = Date.now();
  if (RAW_ROWS_CACHE && now - RAW_ROWS_CACHE.ts < RAW_TTL_MS) {
    return RAW_ROWS_CACHE;
  }

  const limit = 1000; // mesmo limite da chamada original
  const first = await fetchRawRows(origin, 1, limit, req);
  let acc = first.rows.slice();
  const pages = Math.max(1, Math.ceil(first.total / first.limit));
  for (let p = 2; p <= pages; p++) {
    const more = await fetchRawRows(origin, p, first.limit, req);
    acc = acc.concat(more.rows);
    if (acc.length >= first.total) break;
  }

  RAW_ROWS_CACHE = { rows: acc, total: first.total, limit: first.limit, ts: now };
  return RAW_ROWS_CACHE;
}

async function loadUnidMapFromDB(): Promise<Record<string, string>> {
  const now = Date.now();
  if (UNID_MAP_CACHE && now - UNID_MAP_CACHE.ts < MAP_TTL_MS) {
    return UNID_MAP_CACHE.map;
  }
  try {
    const rs = await prisma.$queryRaw<any[]>`SELECT nmdepartamento AS unidade, regional_responsavel AS regional FROM stg_unid_reg`;
    const map: Record<string, string> = {};
    for (const r of rs) {
      const uni = String(r.unidade ?? '');
      const reg = String(r.regional ?? '');
      const canon = canonUnidade(uni);
      if (canon && reg) map[canon] = reg;
    }
    UNID_MAP_CACHE = { map, ts: now };
    return map;
  } catch {
    return UNID_MAP_CACHE?.map || {};
  }
}

async function loadKitMap(): Promise<Record<string, { item: string; qtd: number }[]>> {
  const now = Date.now();
  if (KIT_MAP_CACHE && now - KIT_MAP_CACHE.ts < MAP_TTL_MS) {
    return KIT_MAP_CACHE.map;
  }
  try {
    // Mapa de EPIs por colaborador (CPF), usando a view vw_entregas_epi_unidade,
    // que já aplica o mapeamento Função + Unidade e a regra de demissão.
    const rs = await prisma.$queryRaw<any[]>`
      SELECT
        COALESCE(cpf::text, '')        AS cpf,
        COALESCE(epi_nome::text, '')   AS item,
        COALESCE(quantidade::numeric, 0) AS qtd
      FROM vw_entregas_epi_unidade
    `;

    const map: Record<string, { item: string; qtd: number }[]> = {};

    for (const r of rs) {
      const id = onlyDigits(r.cpf).slice(-11);
      if (!id) continue;

      const itemName = String(r.item || '').trim();
      if (!itemName) continue;

      const qtd = Number(r.qtd || 0) || 0;

      if (!map[id]) {
        map[id] = [];
      }
      const existing = map[id].find(x => x.item === itemName);
      if (!existing) {
        map[id].push({ item: itemName, qtd });
      } else if (qtd > existing.qtd) {
        existing.qtd = qtd;
      }
    }

    KIT_MAP_CACHE = { map, ts: now };
    return map;
  } catch {
    return KIT_MAP_CACHE?.map || {};
  }
}
function formatKit(items?: {item:string,qtd:number}[] | undefined): string {
  if (!items || !items.length) return '—';
  return items
    .filter(x => x.item)
    .map(x => `${x.item}${x.qtd ? ` x${x.qtd}` : ''}`)
    .join(' / ');
}


type FastListResult = { rows: Row[]; total: number };

async function tryFastList(
  regional: string,
  unidade: string,
  page: number,
  pageSize: number
): Promise<FastListResult | null> {
  try {
    const DEMISSAO_LIMITE = '2025-01-01';

    const wh: string[] = [];
    const regTrim = (regional || '').trim();
    const uniTrim = (unidade || '').trim();

    if (regTrim) {
      wh.push(`regional = '${esc(regTrim)}'`);
    }
    if (uniTrim) {
      wh.push(`unidade = '${esc(uniTrim)}'`);
    }

    // Aplica regra de demissão direto no banco: mantém sem demissão ou demitidos a partir de 2025
    wh.push(`(demissao IS NULL OR demissao = '' OR demissao >= '${DEMISSAO_LIMITE}')`);

    const whereSql = wh.length ? `WHERE ${wh.join(' AND ')}` : '';
    const offset = (page - 1) * pageSize;

    const rowsSql = `
      SELECT
        cpf,
        nome,
        funcao,
        cargo,
        unidade,
        regional,
        demissao
      FROM mv_alterdata_flat
      ${whereSql}
      ORDER BY nome ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM mv_alterdata_flat
      ${whereSql}
    `;

    const [rowsRaw, totalRes] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(rowsSql),
      prisma.$queryRawUnsafe<any[]>(countSql),
    ]);

    const total = Number((totalRes as any)?.[0]?.total ?? 0);
    if (!Array.isArray(rowsRaw)) {
      return { rows: [], total: 0 };
    }

    const unidDBMap = await loadUnidMapFromDB();

    const rows: Row[] = (rowsRaw as any[])
      .map((r: any) => {
        const idRaw = r.cpf ?? r.CPF ?? '';
        const id = onlyDigits(idRaw).slice(-11);
        const nome = String(r.nome ?? r.NOME ?? '');
        const func = String(r.funcao ?? r.cargo ?? r.FUNCAO ?? r.CARGO ?? '');
        const un = String(r.unidade ?? r.UNIDADE ?? '');

        let reg = String(r.regional ?? r.REGIONAL ?? '');
        if (!reg) {
          const canon = canonUnidade(un);
          reg = (UNID_TO_REGIONAL as any)[canon] || unidDBMap[canon] || '';
        }
        const regOut = prettyRegional(reg);

        return {
          id,
          nome,
          funcao: func,
          unidade: un,
          regional: regOut,
        } as Row;
      })
      .filter((r) => r.id || r.nome || r.unidade);

    return { rows, total };
  } catch (e) {
    console.error('entregas/fast-list error (mv_alterdata_flat)', e);
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const regional = url.searchParams.get('regional') || '';
  const unidade  = url.searchParams.get('unidade')  || '';
  const q        = url.searchParams.get('q')        || '';
  const page     = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(200, Math.max(10, parseInt(url.searchParams.get('pageSize') || '25', 10)));

  try {
    const hasQ = !!q.trim();
    if (!hasQ) {
      const fast = await tryFastList(regional, unidade, page, pageSize);
      if (fast && Array.isArray(fast.rows)) {
        return NextResponse.json({
          rows: fast.rows,
          total: fast.total,
          page,
          pageSize,
          source: 'mv_alterdata_flat',
        });
      }
    }

    // 1) Carrega todas as páginas do raw-rows (com cache em memória)
    const mirror = await loadSafeRawRows(url.origin, req);
    let acc = mirror.rows.slice();

    // 2) Detecta chaves
    const cpfKey  = pickKeyByName(acc, ['cpf','matric','cpffunc','cpffuncionario']);
    const nomeKey = pickKeyByName(acc, ['nome','colab','funcionario']);
    const funcKey = pickKeyByName(acc, ['func','cargo']);
    const unidKey = pickKeyByName(acc, ['unid','lotac','setor','hosp','posto','local']);
    const regKey  = pickKeyByName(acc, ['regi','regional','gerencia']); // se existir direto no dataset
    const demKey  = pickKeyByName(acc, ['demissao','demiss','dt_demissao','demissao_colab']);

    // 3) Carrega mapa auxiliar unidade -> regional
    const unidDBMap = await loadUnidMapFromDB();

    // 4) Mapeia linhas + regional + captura demissão (sem kit aqui para manter a lista leve)
    type InternalRow = Row & { _demissao?: string };

    const DEMISSAO_LIMITE = '2025-01-01';

    let rowsAll: InternalRow[] = acc.map((r: any) => {
      const idRaw = cpfKey ? (r as any)[cpfKey] : '';
      const id = onlyDigits(idRaw).slice(-11);
      const nome = String((nomeKey && (r as any)[nomeKey]) ?? '');
      const func = String((funcKey && (r as any)[funcKey]) ?? '');
      const un   = String((unidKey && (r as any)[unidKey]) ?? '');
      const demRaw = demKey ? String(((r as any)[demKey] ?? '') as any) : '';
      // Regional por prioridade: coluna direta -> lib/unidReg -> tabela stg_unid_reg
      let reg = String((regKey && (r as any)[regKey]) ?? '');
      if (!reg) {
        const canon = canonUnidade(un);
        reg = (UNID_TO_REGIONAL as any)[canon] || unidDBMap[canon] || '';
      }
      const regOut = prettyRegional(reg);
      return {
        id,
        nome,
        funcao: func,
        unidade: un,
        regional: regOut,
        _demissao: demRaw,
      };
    }).filter(x => x.id || x.nome || x.unidade);

    // 5) Aplica regra de demissão:
    // - demissão vazia -> fica
    // - data < 2025-01-01 -> sai
    // - data >= 2025-01-01 -> fica
    function keepByDemissao(r: InternalRow): boolean {
      const raw = (r._demissao || '').trim();
      if (!raw) return true;
      let d = raw;
      if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
        d = raw.slice(0, 10);
      } else if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) {
        const [dd, mm, yyyy] = raw.slice(0, 10).split('/');
        d = `${yyyy}-${mm}-${dd}`;
      } else {
        // formato desconhecido: não exclui por segurança
        return true;
      }
      return d >= DEMISSAO_LIMITE;
    }

    let rows: Row[] = rowsAll.filter(keepByDemissao).map(({ _demissao, ...rest }) => rest);

    // 6) Filtros (regional leniente: aceita vazio/—)
    const nreg = normUp(regional);
    const nuni = normUp(unidade);
    const nq   = normUp(q);
    if (nreg) rows = rows.filter(r => !nreg || normUp(r.regional) === nreg || r.regional === '—');
    if (nuni) rows = rows.filter(r => normUp(r.unidade) === nuni);
    if (nq)   rows = rows.filter(r => normUp(r.nome).includes(nq) || normUp(r.id).includes(nq));

    // 7) Pagina
    rows.sort((a,b)=> a.nome.localeCompare(b.nome));
    const total = rows.length;
    const start = (page - 1) * pageSize;
    const pageRows = rows.slice(start, start + pageSize);

    return NextResponse.json({ rows: pageRows, total, page, pageSize, source: 'safe_mirror_auth+regional+kit+DEMISS' });
  } catch (e:any) {
    return NextResponse.json({ rows: [], total: 0, page, pageSize, source: 'error', error: e?.message || String(e) }, { status: 200 });
  }
}
