import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

export async function GET() {
  // Traz TODOS os registros direto do banco (sem limite)
  // Obs: Usa query raw para não depender de modelo Prisma
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    SELECT *
    FROM stg_alterdata
    ORDER BY "Admissão" NULLS LAST, "Colaborador"
  `);
  return NextResponse.json({ rows });
}
