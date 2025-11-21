// file: app/api/estoque/options/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type RegionalRow = { id: string; nome: string };
type UnidadeRow = { id: string; nome: string; regionalId: string };

export async function GET() {
  try {
    const regionais = await prisma.$queryRawUnsafe<RegionalRow[]>(`
      SELECT id::text AS id, nome::text AS nome
      FROM "Regional"
      ORDER BY nome
    `);

    const unidades = await prisma.$queryRawUnsafe<UnidadeRow[]>(`
      SELECT id::text AS id, nome::text AS nome, "regionalId"::text AS "regionalId"
      FROM "Unidade"
      ORDER BY nome
    `);

    return NextResponse.json({
      regionais: regionais || [],
      unidades: unidades || [],
    });
  } catch (e: any) {
    console.error('Erro em /api/estoque/options', e);
    // Fallback simples para não quebrar build
    return NextResponse.json({
      regionais: [] as RegionalRow[],
      unidades: [] as UnidadeRow[],
    });
  }
}
