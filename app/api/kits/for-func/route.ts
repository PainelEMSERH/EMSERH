
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function normKey(s: any): string {
  return (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const func = url.searchParams.get('func') || '';
  const unidade = url.searchParams.get('unidade') || '';
  const k1 = normKey(func);
  const k2 = normKey(unidade);

  try {
    const rs: any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        COALESCE(alterdata_funcao::text,'') AS func, 
        COALESCE(nome_site::text,'')        AS site,
        COALESCE(epi_item::text,'')         AS item,
        COALESCE(quantidade::numeric,0)     AS qtd
      FROM stg_epi_map
    `);
    const items = rs.filter(r => {
      const f = normKey(r.func);
      const s = normKey(r.site);
      return (k1 && f === k1) || (k2 && s === k2);
    }).map(r => ({ item: String(r.item || ''), qtd: Number(r.qtd || 0) }));

    return NextResponse.json({ items, source: 'kit-map' }, { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' } });
  } catch (e: any) {
    return NextResponse.json({ items: [], error: e?.message || String(e) }, { status: 200 });
  }
}
