export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Lista pendências com filtros básicos
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status  = (searchParams.get('status') || '').trim();
  const q       = (searchParams.get('q') || '').trim();
  const page    = Math.max(1, Number(searchParams.get('page') || '1'));
  const size    = Math.min(100, Math.max(10, Number(searchParams.get('size') || '25')));
  const offset  = (page - 1) * size;

  const where: string[] = [];
  const params: any[] = [];

  if (status) { params.push(status); where.push(`p.status = $${params.length}`); }
  if (q) {
    const like = `%${q.toUpperCase()}%`;
    params.push(like);
    where.push(`(UPPER(c.nome) LIKE $${params.length} OR UPPER(i.nome) LIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows:any[] = await prisma.$queryRawUnsafe(`
    SELECT p.id, p.quantidade, p.status, p.abertaEm, p.prazo, p.atendidaEm,
           c.id AS "colaboradorId", c.nome AS colaborador,
           i.id AS "itemId", i.nome AS item
    FROM pendencia p
    JOIN colaborador c ON c.id = p."colaboradorId"
    JOIN item        i ON i.id = p."itemId"
    ${whereSql}
    ORDER BY p.abertaEm DESC
    LIMIT ${size} OFFSET ${offset}
  `, ...params);

  const totalRes:any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS c
    FROM pendencia p
    JOIN colaborador c ON c.id = p."colaboradorId"
    JOIN item        i ON i.id = p."itemId"
    ${whereSql}
  `, ...params);

  return NextResponse.json({ total: (totalRes?.[0]?.c ?? 0), rows });
}
