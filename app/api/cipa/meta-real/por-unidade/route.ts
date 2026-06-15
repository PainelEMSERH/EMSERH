import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computeMetaRealFromRows } from '@/lib/cipa/meta-real-compute';
import { computeUnidadeMetaRealStats, loadCipaMetaRealRows } from '@/lib/cipa/load-meta-real-rows';

/**
 * Ranking de unidades que mais puxam o indicador regional para baixo.
 * Ordenado por pendentes (meta − real) e % de conclusão da unidade.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const regional = (url.searchParams.get('regional') || '').trim();
    const ano = parseInt(url.searchParams.get('ano') || '2025', 10);

    if (!regional) {
      return NextResponse.json(
        { ok: false, error: 'Informe a regional para ver o ranking por unidade' },
        { status: 400 },
      );
    }

    const rows = await loadCipaMetaRealRows(prisma, regional, ano);
    const consolidado = computeMetaRealFromRows(rows, ano);
    const unidades = computeUnidadeMetaRealStats(rows, consolidado.totalMeta, ano);

    const piores = unidades.filter((u) => u.pendentes > 0).slice(0, 25);

    return NextResponse.json({
      ok: true,
      regional: regional.toUpperCase(),
      ano,
      consolidado: {
        totalMeta: consolidado.totalMeta,
        totalReal: consolidado.totalReal,
        percentTotal: consolidado.percentTotal,
        pendentes: consolidado.totalMeta - consolidado.totalReal,
      },
      unidades: piores,
      totalUnidades: unidades.length,
    });
  } catch (e: any) {
    console.error('[cipa/meta-real/por-unidade] error', e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
