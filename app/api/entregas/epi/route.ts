import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const funcao = searchParams.get('funcao');
  if (!funcao) return NextResponse.json({ itens: [] });

  const rows = await prisma.$queryRawUnsafe<any[]>(`
    select coalesce(epi_item, 'SEM EPI') as epi_item, coalesce(quantidade,0) as quantidade
    from stg_epi_map
    where lower(alterdata_funcao) = lower($1)
    order by epi_item asc
  `, funcao);

  // consolidate duplicates (if any) by epi_item
  const map = new Map<string, number>();
  for (const r of rows) {
    const it = String(r.epi_item);
    const q = Number(r.quantidade || 0);
    map.set(it, (map.get(it) || 0) + q);
  }
  const itens = Array.from(map.entries()).map(([epi_item, quantidade]) => ({ epi_item, quantidade }));
  return NextResponse.json({ itens });
}
