import { NextResponse } from 'next/server';
import { sql } from '@/src/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [{ count: stg_alterdata }] = await sql`SELECT COUNT(*)::int AS count FROM stg_alterdata`;
    const [{ count: stg_unid_reg }] = await sql`SELECT COUNT(*)::int AS count FROM stg_unid_reg`;
    const [{ count: stg_epi_map }] = await sql`SELECT COUNT(*)::int AS count FROM stg_epi_map`;

    const [{ count: regional }] = await sql`SELECT COUNT(*)::int AS count FROM regional`;
    const [{ count: unidade }] = await sql`SELECT COUNT(*)::int AS count FROM unidade`;
    const [{ count: funcao }]  = await sql`SELECT COUNT(*)::int AS count FROM funcao`;
    const [{ count: item }]    = await sql`SELECT COUNT(*)::int AS count FROM item`;
    const [{ count: colab }]   = await sql`SELECT COUNT(*)::int AS count FROM colaborador`;
    const [{ count: vinc }]    = await sql`SELECT COUNT(*)::int AS count FROM colaborador_vinculo`;

    return NextResponse.json({
      staging: { stg_alterdata, stg_unid_reg, stg_epi_map },
      finais:  { regional, unidade, funcao, item, colaborador: colab, colaborador_vinculo: vinc },
      ok: true
    });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message ?? String(e) }, { status: 500 });
  }
}
