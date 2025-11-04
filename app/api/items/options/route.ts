export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(`
      select distinct epi_item
      from stg_epi_map
      where epi_item is not null and upper(epi_item) <> 'SEM EPI'
      order by epi_item asc
    `);
    const options = rows.map(r => ({ value: String(r.epi_item), label: String(r.epi_item) }));
    return NextResponse.json({ options });
  } catch (e: any) {
    // Safe fallback
    return NextResponse.json({ options: [] });
  }
}
