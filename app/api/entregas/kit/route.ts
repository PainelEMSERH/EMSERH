export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type KitRow = { item: string; quantidade: number; nome_site: string | null };

function normKey(s: any): string {
  return (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function normFuncKey(s: any): string {
  const raw = (s ?? '').toString();
  const cleaned = raw.replace(/\(A\)/gi, '').replace(/\s+/g, ' ');
  return normKey(cleaned);
}

let KIT_CACHE: { map: Record<string, KitRow[]>; ts: number } | null = null;
const KIT_TTL_MS = 60 * 60 * 1000;

async function loadKitMap(): Promise<Record<string, KitRow[]>> {
  const now = Date.now();
  if (KIT_CACHE && now - KIT_CACHE.ts < KIT_TTL_MS) {
    return KIT_CACHE.map;
  }

  const rs = await prisma.$queryRawUnsafe<any[]>(`
    SELECT
      COALESCE(alterdata_funcao::text,'') AS func,
      COALESCE(nome_site::text,'')        AS site,
      COALESCE(epi_item::text,'')         AS item,
      COALESCE(quantidade::numeric,0)     AS qtd
    FROM stg_epi_map
  `);

  const map: Record<string, KitRow[]> = {};
  for (const r of rs) {
    const item = String(r.item || '');
    if (!item) continue;
    const base: KitRow = {
      item,
      quantidade: Number(r.qtd || 0) || 0,
      nome_site: r.site ? String(r.site) : null,
    };
    const keyFunc = normFuncKey(r.func);
    const keySite = normFuncKey(r.site);
    if (keyFunc) {
      if (!map[keyFunc]) map[keyFunc] = [];
      map[keyFunc].push(base);
    }
    if (keySite && keySite !== keyFunc) {
      if (!map[keySite]) map[keySite] = [];
      map[keySite].push(base);
    }
  }

  KIT_CACHE = { map, ts: now };
  return map;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const funcao = (searchParams.get('funcao') || '').trim();
  if (!funcao) {
    return NextResponse.json(
      { ok: false, error: 'funcao inválida' },
      { status: 400 },
    );
  }

  try {
    const map = await loadKitMap();
    const key = normFuncKey(funcao);
    const items = key ? map[key] || [] : [];
    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    console.error('Error in /api/entregas/kit', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'erro' },
      { status: 500 },
    );
  }
}
