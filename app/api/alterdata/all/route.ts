// AUTO-GENERATED: paginated entregas list route
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const regional = (url.searchParams.get('regional') || '').trim();
    const unidade  = (url.searchParams.get('unidade') || '').trim();
    const q        = (url.searchParams.get('q') || '').trim();
    const page     = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(10, parseInt(url.searchParams.get('pageSize') || '25', 10)));
    const offset = (page - 1) * pageSize;

    const wh: string[] = [];
    const params: any[] = [];

    if (regional) {
      params.push(regional);
      wh.push(`upper(coalesce(regional,'')) = upper($${params.length})`);
    }
    if (unidade) {
      params.push(unidade);
      wh.push(`upper(coalesce(unidade,'')) = upper($${params.length})`);
    }
    if (q) {
      params.push(`%${q.toUpperCase().replace(/%/g,'')}%`);
      wh.push(`(upper(coalesce(nome,'')) LIKE $${params.length} OR matricula::text LIKE $${params.length})`);
    }
    const whereSql = wh.length ? `WHERE ${wh.join(' AND ')}` : '';

    const rows = await prisma.$queryRawUnsafe(`
      SELECT
        id,
        matricula::text as matricula,
        nome,
        funcao,
        unidade,
        regional,
        admissao::date as admissao,
        demissao::date as demissao
      FROM vw_colaboradores
      ${whereSql}
      ORDER BY nome
      LIMIT ${pageSize} OFFSET ${offset}
    `, ...params);

    const totalRes = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as c FROM vw_colaboradores ${whereSql}
    `, ...params);

    return NextResponse.json({
      rows,
      total: (totalRes?.[0]?.c ?? rows.length),
      page,
      pageSize,
      source: 'db_pagination'
    });
  } catch (err: any) {
    return NextResponse.json({ rows: [], total: 0, page: 1, pageSize: 25, error: String(err?.message || err) }, { status: 200 });
  }
}
