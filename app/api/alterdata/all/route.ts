import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const revalidate = 0;

export async function GET() {
  try {
    const latest = await prisma.$queryRawUnsafe(`
      SELECT batch_id, imported_at
      FROM stg_alterdata_v2_imports
      ORDER BY imported_at DESC
      LIMIT 1
    `);
    const batch_id = latest?.[0]?.batch_id || null;

    const rows = await prisma.$queryRawUnsafe(`
      WITH latest AS (
        SELECT batch_id FROM stg_alterdata_v2_imports ORDER BY imported_at DESC LIMIT 1
      )
      SELECT row_no, data
      FROM stg_alterdata_v2_raw r, latest
      WHERE r.batch_id = latest.batch_id
      ORDER BY row_no
    `);

    const cols = await prisma.$queryRawUnsafe(`
      WITH latest AS (
        SELECT batch_id FROM stg_alterdata_v2_imports ORDER BY imported_at DESC LIMIT 1
      )
      SELECT DISTINCT jsonb_object_keys(data) AS key
      FROM stg_alterdata_v2_raw r, latest
      WHERE r.batch_id = latest.batch_id
      ORDER BY 1
    `);
    const columns = Array.isArray(cols) ? cols.map((r:any)=>r.key) : [];

    const res = NextResponse.json({ ok:true, batch_id, columns, rows }, { status: 200 });
    res.headers.set('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    return res;
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: String(e?.message||e) }, { status:500 });
  }
}
