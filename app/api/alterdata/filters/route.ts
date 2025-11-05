import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try{
    const sql = `
      WITH latest AS (
        SELECT batch_id FROM stg_alterdata_v2_imports ORDER BY imported_at DESC LIMIT 1
      ),
      base AS (
        SELECT
          COALESCE(r.data->>'Unidade Hospitalar', r.data->>'Unidade', '') AS unidade,
          COALESCE(m.regional, '') AS regional
        FROM stg_alterdata_v2_raw r
        JOIN latest l ON r.batch_id = l.batch_id
        LEFT JOIN stg_unid_reg m ON m.unidade = COALESCE(r.data->>'Unidade Hospitalar', r.data->>'Unidade', '')
      )
      SELECT
        ARRAY(SELECT DISTINCT regional FROM base WHERE regional <> '' ORDER BY regional) AS regionais,
        ARRAY(SELECT DISTINCT unidade  FROM base WHERE unidade  <> '' ORDER BY unidade ) AS unidades
    `;
    const rows: any[] = await prisma.$queryRawUnsafe(sql);
    const payload = rows?.[0] ?? { regionais: [], unidades: [] };
    return NextResponse.json({ ok:true, ...payload });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: String(e?.message||e) }, { status:500 });
  }
}
