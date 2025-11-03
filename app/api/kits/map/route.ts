import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const unidade = (searchParams.get('unidade') || '').trim();
    const size = Math.min(Math.max(parseInt(searchParams.get('size') || '50', 10), 1), 200);
    const page = Math.max(parseInt(searchParams.get('page') || '1', 10), 1);
    const offset = (page - 1) * size;

    const where: string[] = [];
    const params: any[] = [];

    if (q) {
      params.push(`%${q.toUpperCase()}%`);
      params.push(`%${q.toUpperCase()}%`);
      where.push(`(UPPER(alterdata_funcao) LIKE $${params.length - 1} OR UPPER(epi_item) LIKE $${params.length})`);
    }
    if (unidade) {
      params.push(unidade.toUpperCase());
      where.push(`UPPER(nome_site) = $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    // Query itens + total em duas chamadas (p/ evitar window functions se o DB tiver restrição)
    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        alterdata_funcao AS funcao,
        epi_item        AS item,
        COALESCE(quantidade, 0)::int AS quantidade,
        nome_site       AS unidade
      FROM stg_epi_map
      ${whereSql}
      ORDER BY alterdata_funcao, epi_item
      LIMIT ${size} OFFSET ${offset}
    `, ...params);

    const totalRows: Array<{ c: number }> = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS c
      FROM stg_epi_map
      ${whereSql}
    `, ...params);

    return NextResponse.json({ ok: true, items: rows, total: totalRows?.[0]?.c ?? 0, page, size });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
