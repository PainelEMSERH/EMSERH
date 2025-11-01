import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    select distinct regional, unidade
    from stg_unid_reg
  `);
  const regionaisSet = new Set<string>();
  const unidades: { unidade: string; regional: string }[] = [];
  for (const r of rows) {
    if (r.regional) regionaisSet.add(String(r.regional));
    if (r.unidade) unidades.push({ unidade: String(r.unidade), regional: String(r.regional ?? '') });
  }
  const regionais = Array.from(regionaisSet).sort((a,b)=>a.localeCompare(b));
  unidades.sort((a,b)=>a.unidade.localeCompare(b.unidade));
  return NextResponse.json({ regionais, unidades });
}
