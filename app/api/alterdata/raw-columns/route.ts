
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try{
    const sql = `
      WITH latest AS (
        SELECT batch_id FROM stg_alterdata_v2_imports ORDER BY imported_at DESC LIMIT 1
      )
      SELECT DISTINCT jsonb_object_keys(data) AS key
      FROM stg_alterdata_v2_raw r, latest
      WHERE r.batch_id = latest.batch_id
      ORDER BY 1
    `;
    const rows: any[] = await prisma.$queryRawUnsafe(sql);
    const columns = rows.map((r: any) => r.key);
const batch = await prisma.$queryRawUnsafe(`SELECT batch_id, imported_at FROM stg_alterdata_v2_imports ORDER BY imported_at DESC LIMIT 1`);
const batch_id = batch?.[0]?.batch_id || null;
return NextResponse.json({ ok:true, columns, batch_id });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: String(e?.message||e) }, { status:500 });
  }
}
