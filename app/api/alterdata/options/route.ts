import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

function esc(s: string){ return (s||'').replace(/'/g, "''"); }

export async function GET(req: Request) {
  try{
    const { searchParams } = new URL(req.url);
    const regional = (searchParams.get('regional') || '').trim();

    // Regionais (sempre do dicionário/tabela mestre)
    const regs = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT regional_responsavel AS regional
      FROM stg_unid_reg
      WHERE regional_responsavel IS NOT NULL AND regional_responsavel <> ''
      ORDER BY 1
    `) as Array<{regional: string}>;

    // Unidades - todas ou filtradas pela regional
    const uniSql = regional
      ? `SELECT nmddepartamento AS unidade FROM stg_unid_reg WHERE regional_responsavel = '${esc(regional)}' ORDER BY 1`
      : `SELECT nmddepartamento AS unidade FROM stg_unid_reg ORDER BY 1`;

    const unis = await prisma.$queryRawUnsafe(uniSql) as Array<{unidade: string}>;

    return NextResponse.json({
      ok: true,
      regionais: regs.map(r => r.regional),
      unidades: unis.map(u => u.unidade),
    });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: String(e?.message || e) }, { status:500 });
  }
}
