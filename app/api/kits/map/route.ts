// file: app/api/kits/map/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * GET /api/kits/map
 * Query params:
 *  - q: string       (filtro por função OU item) [opcional]
 *  - unidade: string (filtra por nome_site)      [opcional]
 *  - page, size: paginação                       [opcionais]
 *
 * Retorna linhas no formato:
 *  { funcao: string, item: string, quantidade: number, unidade: string }
 * a partir da tabela public.stg_epi_map:
 *  - alteredata_funcao -> funcao
 *  - epi_item          -> item
 *  - quantidade        -> quantidade
 *  - nome_site         -> unidade
 */
export async function GET(req: Request){
  const { searchParams } = new URL(req.url);
  const q        = (searchParams.get('q') || '').trim();
  const unidade  = (searchParams.get('unidade') || '').trim();
  const page     = Math.max(1, Number(searchParams.get('page') || '1'));
  const size     = Math.min(500, Math.max(10, Number(searchParams.get('size') || '100')));
  const offset   = (page - 1) * size;

  const where: string[] = [];
  const params: any[] = [];

  if (q){
    const like = `%${q.toUpperCase()}%`;
    params.push(like);
    where.push(`(UPPER(m.alterdata_funcao) LIKE $${params.length} OR UPPER(m.epi_item) LIKE $${params.length})`);
  }
  if (unidade){
    params.push(`%${unidade.toUpperCase()}%`);
    where.push(`UPPER(m.nome_site) LIKE $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  // Nota: usamos $queryRawUnsafe para flexibilidade sem depender do schema Prisma.
  const rows: any[] = await prisma.$queryRawUnsafe(`
    SELECT
      m.alterdata_funcao  AS funcao,
      m.epi_item          AS item,
      COALESCE(m.quantidade, 0)::float AS quantidade,
      m.nome_site         AS unidade
    FROM stg_epi_map m
    ${whereSql}
    ORDER BY m.alterdata_funcao, m.epi_item
    LIMIT ${size} OFFSET ${offset}
  `, ...params);

  // Opcional: total para paginação futura
  const totalRes: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS c FROM stg_epi_map m ${whereSql}
  `, ...params);

  return NextResponse.json({ rows, total: (totalRes?.[0]?.c ?? rows.length) });
}
