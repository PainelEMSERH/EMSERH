
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Lista o estoque por Regional/Unidade/Item (com filtros e paginação).
 * Usa tabelas normalizadas (Estoque, Unidade, Regional, Item).
 * Caso a tabela Estoque não exista, retorna vazio.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const regionalId = (searchParams.get('regionalId') || '').trim();
  const unidadeId  = (searchParams.get('unidadeId')  || '').trim();
  const q          = (searchParams.get('q')          || '').trim();
  const page       = Math.max(1, Number(searchParams.get('page') || '1'));
  const size       = Math.min(100, Math.max(10, Number(searchParams.get('size') || '25')));
  const offset     = (page - 1) * size;

  // Verifica se a tabela existe
  const tableExists = await prisma.$queryRawUnsafe<any[]>(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = current_schema() AND table_name = 'estoque' LIMIT 1
  `);
  if (!tableExists || tableExists.length === 0) {
    return NextResponse.json({ total: 0, rows: [] });
  }

  const where: string[] = [];
  const params: any[] = [];

  if (regionalId) { params.push(regionalId); where.push(`e."unidadeId" IN (SELECT id FROM unidade WHERE "regionalId" = $${params.length})`); }
  if (unidadeId)  { params.push(unidadeId);  where.push(`e."unidadeId" = $${params.length}`); }
  if (q) {
    const like = `%${q.toUpperCase()}%`;
    params.push(like); where.push(`(UPPER(i.nome) LIKE $${params.length} OR UPPER(u.nome) LIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows:any[] = await prisma.$queryRawUnsafe(`
    SELECT e.id,
           r.id   AS "regionalId", r.nome AS regional,
           u.id   AS "unidadeId",  u.nome AS unidade,
           i.id   AS "itemId",     i.nome AS item,
           e.quantidade, e.minimo, COALESCE(e.maximo, 0) AS maximo
    FROM estoque e
    JOIN unidade  u ON u.id = e."unidadeId"
    JOIN regional r ON r.id = u."regionalId"
    JOIN item     i ON i.id = e."itemId"
    ${whereSql}
    ORDER BY r.nome, u.nome, i.nome
    LIMIT ${size} OFFSET ${offset}
  `, ...params);

  const totalRes:any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS c
    FROM estoque e
    JOIN unidade  u ON u.id = e."unidadeId"
    JOIN regional r ON r.id = u."regionalId"
    JOIN item     i ON i.id = e."itemId"
    ${whereSql}
  `, ...params);

  return NextResponse.json({ total: (totalRes?.[0]?.c ?? 0), rows });
}
