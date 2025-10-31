import prisma from '@/lib/prisma';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const r: Array<{ c: number }> = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM stg_epi_map`);
    const n = r?.[0]?.c ?? 0;
    return NextResponse.json({ ok: true, counts: { stg_epi_map: n } });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
