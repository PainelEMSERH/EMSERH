// file: app/api/estoque/items/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type ItemRow = { id: string; nome: string };

export async function GET() {
  try {
    const rows = await prisma.$queryRawUnsafe<ItemRow[]>(`
      SELECT id::text AS id, nome::text AS nome
      FROM "Item"
      WHERE ativo = true
      ORDER BY nome
    `);
    return NextResponse.json({ items: rows || [] });
  } catch (e: any) {
    console.error('Erro em /api/estoque/items', e);
    return NextResponse.json({ items: [] as ItemRow[] });
  }
}
