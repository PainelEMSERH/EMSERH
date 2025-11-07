import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

async function tableExists(name: string): Promise<boolean> {
  const r: any[] = await prisma.$queryRawUnsafe(`SELECT to_regclass('${name}') as r`);
  return !!r?.[0]?.r;
}

export async function GET() {
  try{
    const hasV2Raw = await tableExists('stg_alterdata_v2_raw');
    const hasLegacy = await tableExists('stg_alterdata');

    if (!hasV2Raw && !hasLegacy) {
      const res = NextResponse.json({ ok:false, error: 'Nenhuma tabela Alterdata encontrada (stg_alterdata_v2_raw ou stg_alterdata).' }, { status: 500 });
      res.headers.set('x-alterdata-route', 'raw-columns2');
      return res;
    }

    if (hasV2Raw) {
      const rows: any[] = await prisma.$queryRawUnsafe(`
        SELECT DISTINCT jsonb_object_keys(data) AS key
        FROM stg_alterdata_v2_raw
        ORDER BY 1
      `);
      const columns = rows.map((r: any) => r.key);
      const b: any[] = await prisma.$queryRawUnsafe(`SELECT batch_id FROM stg_alterdata_v2_raw WHERE batch_id IS NOT NULL ORDER BY batch_id DESC LIMIT 1`);
      const batch_id = b?.[0]?.batch_id || null;
      const res = NextResponse.json({ ok:true, columns, batch_id });
      res.headers.set('Cache-Control','public, s-maxage=3600, stale-while-revalidate=86400');
      res.headers.set('x-alterdata-route', 'raw-columns2');
      return res;
    }

    const cols: any[] = await prisma.$queryRawUnsafe(`
      SELECT column_name as key
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'stg_alterdata'
      ORDER BY ordinal_position
    `);
    const columns = cols.map(r => r.key);
    const tot: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS total FROM stg_alterdata`);
    const batch_id = `legacy-stg_alterdata-${tot?.[0]?.total ?? 0}`;

    const res = NextResponse.json({ ok:true, columns, batch_id });
    res.headers.set('Cache-Control','public, s-maxage=3600, stale-while-revalidate=86400');
    res.headers.set('x-alterdata-route', 'raw-columns2');
    return res;
  }catch(e:any){
    const res = NextResponse.json({ ok:false, error: String(e?.message||e) }, { status:500 });
    res.headers.set('x-alterdata-route', 'raw-columns2');
    return res;
  }
}
