import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try{
    const sql = `
      WITH by_import AS (
        SELECT i.batch_id, i.imported_at, i.source_file, COALESCE(cnt.c,0) AS rows
        FROM stg_alterdata_v2_imports i
        LEFT JOIN (
          SELECT batch_id, COUNT(*)::int AS c
          FROM stg_alterdata_v2_raw GROUP BY 1
        ) cnt ON cnt.batch_id = i.batch_id
        ORDER BY i.imported_at DESC NULLS LAST
      )
      SELECT batch_id::text,
             to_char(COALESCE(imported_at, now()), 'YYYY-MM-DD HH24:MI') || ' • ' ||
             COALESCE(source_file,'arquivo') || ' • ' ||
             rows || ' linhas' AS label
      FROM by_import
      LIMIT 10
    `;
    const rows: any[] = await prisma.$queryRawUnsafe(sql);
    const batches = rows.map(r => ({ batch_id: r.batch_id, label: r.label }));
    const current = batches?.[0]?.batch_id;
    return NextResponse.json({ ok:true, batches, current });
  }catch(e:any){
    return NextResponse.json({ ok:false, error: String(e?.message||e) }, { status:500 });
  }
}
