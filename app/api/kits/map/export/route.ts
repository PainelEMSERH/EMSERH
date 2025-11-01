import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const rows = await prisma.$queryRawUnsafe<any[]>(`
    select alterdata_funcao, epi_item, quantidade, nome_site
    from stg_epi_map
    order by nome_site, alterdata_funcao, epi_item
  `);

  const header = ['ALTERDATA','ITEM DO EPI','QTD','NOME SITE'];
  const lines = [header.join(',')];
  for (const r of rows) {
    const q = r.quantidade == null ? '' : String(r.quantidade);
    const cols = [r.alterdata_funcao, r.epi_item, q, r.nome_site].map((v:string)=>{
      if (v == null) return '';
      const escaped = String(v).replace(/"/g,'""');
      return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
    });
    lines.push(cols.join(','));
  }
  const csv = lines.join('\n');
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="stg_epi_map.csv"'
    }
  });
}
