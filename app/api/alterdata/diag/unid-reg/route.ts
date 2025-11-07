import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const cols: any[] = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'stg_unid_reg'
      ORDER BY ordinal_position
    `);
    const sample: any[] = await prisma.$queryRawUnsafe(`SELECT * FROM stg_unid_reg LIMIT 3`);

    const probe: any[] = await prisma.$queryRawUnsafe(`
      SELECT jsonb_object_keys(to_jsonb(ur)) AS key
      FROM stg_unid_reg ur
      LIMIT 1
    `);

    return NextResponse.json({ ok:true, columns: cols, sample, probeKeys: probe });
  } catch (e: any) {
    return NextResponse.json({ ok:false, error: String(e?.message || e) }, { status: 500 });
  }
}
