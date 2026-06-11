import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { compute2026From2025 } from '@/lib/cipa/compute-2026';
import { processCipaRows } from '@/lib/cipa/process-rows';
import { computeMetaRealFromRows } from '@/lib/cipa/meta-real-compute';

/**
 * Meta vs Real CIPA:
 * - Meta do mês = quantidade de atividades programadas para aquele mês (data_fim_prevista no mês)
 * - Real do mês = quantidade de atividades realizadas naquele mês (data_conclusao no mês)
 * - Unidades designadas contam apenas 5 atividades (itens 1, 9, 10, 11 e 12)
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

    const wh: string[] = [`ano_gestao = ${ano}`];
    if (regional) wh.push(`UPPER(TRIM(regional)) = UPPER('${String(regional).replace(/'/g, "''")}')`);
    const whereSql = `WHERE ${wh.join(' AND ')}`;

    const totalMetaResult: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total FROM cronograma_cipa ${whereSql}
    `);
    const totalDb = Number(totalMetaResult[0]?.total ?? 0);

    let useComputed = false;
    if (ano === 2026 && totalDb === 0) {
      useComputed = true;
    } else if (ano === 2026 && totalDb > 0) {
      const check2026: any[] = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int AS total FROM cronograma_cipa
        ${whereSql}
        AND EXTRACT(YEAR FROM data_fim_prevista::date) = 2026
      `);
      if (Number(check2026[0]?.total ?? 0) === 0) useComputed = true;
    }

    let rows: { unidade: string; data_fim_prevista: string | null; data_conclusao: string | null }[] = [];

    if (ano === 2026 && useComputed) {
      const rows2026 = processCipaRows(await compute2026From2025(prisma, regional, ''));
      rows = rows2026.map((r) => ({
        unidade: r.unidade,
        data_fim_prevista: r.data_fim_prevista,
        data_conclusao: null,
      }));
    } else {
      const dbRows: any[] = await prisma.$queryRawUnsafe(`
        SELECT unidade, atividade_codigo,
               data_fim_prevista::text AS data_fim_prevista,
               data_conclusao::text AS data_conclusao
        FROM cronograma_cipa
        ${whereSql}
      `);
      const processed = processCipaRows(
        (dbRows || []).map((r) => ({
          regional: '',
          unidade: String(r.unidade ?? ''),
          atividade_codigo: Number(r.atividade_codigo) || 0,
          data_fim_prevista: r.data_fim_prevista ? String(r.data_fim_prevista).slice(0, 10) : null,
          data_conclusao: r.data_conclusao ? String(r.data_conclusao).slice(0, 10) : null,
        })),
      );
      rows = processed.map((r) => ({
        unidade: r.unidade,
        data_fim_prevista: r.data_fim_prevista ?? null,
        data_conclusao: r.data_conclusao ?? null,
      }));
    }

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
