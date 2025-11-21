export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Discover column names dynamically
    const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
      select column_name
      from information_schema.columns
      where table_schema = current_schema()
        and table_name = 'stg_unid_reg'
    `);
    const names = new Set((cols || []).map(c => c.column_name.toLowerCase()));

    const pick = (cands: string[]) => cands.find(c => names.has(c));
    const colRegional = pick(['regional_responsavel','regional','regiao','regional_nome','regiao_nome','nome_regional']);
    const colUnidade  = pick(['nmdepartamento','unidade','unidade_nome','nome_unidade']);

    let regionais: string[] = [];
    let unidades: { unidade: string; regional: string }[] = [];

    if (colRegional && colUnidade) {
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `select distinct ${colRegional} as regional, ${colUnidade} as unidade from stg_unid_reg`
      );
      for (const r of rows) {
        const reg = (r.regional ?? '').toString();
        const uni = (r.unidade ?? '').toString();
        if (reg) regionais.push(reg);
        if (uni) unidades.push({ unidade: uni, regional: reg });
      }
    } else if (colUnidade) {
      // Unidades a partir do stg_unid_reg; regionais fallback padrão (Norte/Sul/Leste/Central)
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `select distinct ${colUnidade} as unidade from stg_unid_reg`
      );
      unidades = rows.map(r => ({ unidade: (r.unidade ?? '').toString(), regional: '' })).filter(r => r.unidade);
      regionais = ['Norte','Sul','Leste','Central'];
    } else {
      // Fallback total: Unidades do stg_alterdata; regionais padrão
      const rows = await prisma.$queryRawUnsafe<any[]>(
        `select distinct unidade from stg_alterdata where unidade is not null`
      );
      unidades = rows.map(r => ({ unidade: (r.unidade ?? '').toString(), regional: '' })).filter(r => r.unidade);
      regionais = ['Norte','Sul','Leste','Central'];
    }

    // Normalize & sort
    regionais = Array.from(new Set(regionais.filter(Boolean))).sort((a,b)=>a.localeCompare(b));
    unidades.sort((a,b)=>a.unidade.localeCompare(b.unidade));
    return NextResponse.json({ regionais, unidades });
  } catch (e: any) {
    // Absolute fallback to avoid build breaks
    const regionais = ['Norte','Sul','Leste','Central'];
    const unidades: { unidade: string; regional: string }[] = [];
    return NextResponse.json({ regionais, unidades });
  }
}
