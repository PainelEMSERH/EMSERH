import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ensureDemandasTrabalhistasTables } from '@/lib/demandas-trabalhistas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (Array.isArray(obj)) return obj.map(convertBigIntToNumber);
  if (typeof obj === 'object') {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToNumber(value);
    }
    return converted;
  }
  return obj;
}

export async function GET(req: NextRequest) {
  try {
    await ensureDemandasTrabalhistasTables();

    const url = new URL(req.url);
    const regional = (url.searchParams.get('regional') || '').trim();
    const unidade = (url.searchParams.get('unidade') || '').trim();
    const status = (url.searchParams.get('status') || '').trim();
    const statusFinal = (url.searchParams.get('statusFinal') || '').trim();
    const search = (url.searchParams.get('search') || '').trim();
    const ano = (url.searchParams.get('ano') || '2026').trim();

    const wh: string[] = ['1=1'];
    if (regional) wh.push(`regional = '${regional.replace(/'/g, "''")}'`);
    if (unidade) wh.push(`unidade = '${unidade.replace(/'/g, "''")}'`);
    if (status) wh.push(`status = '${status.replace(/'/g, "''")}'`);
    if (statusFinal) wh.push(`status_final = '${statusFinal.replace(/'/g, "''")}'`);
    if (ano && /^\d{4}$/.test(ano)) wh.push(`ano_chegada = ${Number(ano)}`);
    if (search) {
      const term = search.replace(/'/g, "''");
      wh.push(`(
        numero_sei ILIKE '%${term}%'
        OR demandante ILIKE '%${term}%'
      )`);
    }

    const whereSql = `WHERE ${wh.join(' AND ')}`;

    const perRegionalSql = `
      SELECT
        COALESCE(regional, '') AS regional,
        COUNT(*)::int AS total,
        ROUND(
          AVG(
            COALESCE(
              tempo_resposta_dias,
              CASE
                WHEN data_chegada IS NOT NULL AND data_conclusao IS NOT NULL
                THEN (data_conclusao - data_chegada)
                ELSE NULL
              END
            )
          )::numeric,
          1
        ) AS "avgTempoResposta"
      FROM demandas_trabalhistas
      ${whereSql}
      GROUP BY regional
      ORDER BY regional;
    `;

    const perMonthSql = `
      SELECT
        EXTRACT(MONTH FROM data_chegada)::int AS "mesNumero",
        TO_CHAR(data_chegada, 'Mon') AS "mesLabel",
        COUNT(*)::int AS total
      FROM demandas_trabalhistas
      ${whereSql}
      AND data_chegada IS NOT NULL
      GROUP BY "mesNumero", "mesLabel"
      ORDER BY "mesNumero";
    `;

    const [perRegionalRaw, perMonthRaw] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(perRegionalSql),
      prisma.$queryRawUnsafe<any[]>(perMonthSql),
    ]);

    const perRegional = convertBigIntToNumber(perRegionalRaw || []);
    const perMonth = convertBigIntToNumber(perMonthRaw || []);

    return NextResponse.json({
      ok: true,
      perRegional,
      perMonth,
      ano: ano || '2026',
    });
  } catch (e: any) {
    console.error('[demandas-trabalhistas/summary] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}

