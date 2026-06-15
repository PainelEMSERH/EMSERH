import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computeMetaRealFromRows } from '@/lib/cipa/meta-real-compute';
import { loadCipaMetaRealRows } from '@/lib/cipa/load-meta-real-rows';

/**
 * Meta vs Real CIPA (consolidado regional ou geral).
 */
export async function GET(req: NextRequest) {
  try {
    const hasTable: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'cronograma_cipa'
      ) AS exists
    `);
    if (!hasTable?.[0]?.exists) {
      return NextResponse.json({
        ok: true,
        meta: {},
        realAcumulado: {},
        totalMeta: 0,
        totalReal: 0,
        ano: parseInt(new URL(req.url).searchParams.get('ano') || '2025', 10),
      });
    }

    const url = new URL(req.url);
    const regional = (url.searchParams.get('regional') || '').trim();
    const ano = parseInt(url.searchParams.get('ano') || '2025', 10);

    const rows = await loadCipaMetaRealRows(prisma, regional, ano);
    const computed = computeMetaRealFromRows(rows, ano);

    return NextResponse.json({
      ok: true,
      meta: computed.meta,
      real: computed.real,
      realAcumulado: computed.real,
      metaPercent: computed.metaPercent,
      realPercent: computed.realPercent,
      metaPercentAcumulado: computed.metaPercentAcumulado,
      realPercentAcumulado: computed.realPercentAcumulado,
      evolucaoMensal: computed.evolucaoMensal,
      totalMeta: computed.totalMeta,
      totalReal: computed.totalReal,
      percentTotal: computed.percentTotal,
      ano,
    });
  } catch (e: any) {
    console.error('[cipa/meta-real] error', e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
