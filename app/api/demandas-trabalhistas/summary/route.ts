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

/** Prisma/pg pode devolver DECIMAL como objeto; JSON serializa mal e o front vira NaN / "-". */
function normalizeAvgTempoResposta(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  if (typeof v === 'object' && v !== null) {
    if ('toNumber' in v && typeof (v as { toNumber: () => number }).toNumber === 'function') {
      const n = (v as { toNumber: () => number }).toNumber();
      return Number.isFinite(n) ? n : null;
    }
    const s = (v as { toString?: () => string }).toString?.();
    if (s) {
      const n = parseFloat(s.replace(',', '.'));
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function mapAvgOnRows(rows: any[], key = 'avgTempoResposta') {
  return (rows || []).map((r) => ({
    ...r,
    [key]: normalizeAvgTempoResposta(r?.[key]),
  }));
}

/**
 * Por linha: 1) usa a coluna "Tempo de Resposta (dias)" quando existir;
 * 2) senão, dias corridos entre data de chegada e data de conclusão.
 * A média (AVG) considera só linhas em que esse valor não é NULL.
 */
const SQL_DIAS_RESPOSTA = `
  CASE
    WHEN tempo_resposta_dias IS NOT NULL THEN tempo_resposta_dias::numeric
    WHEN data_chegada IS NOT NULL AND data_conclusao IS NOT NULL THEN (data_conclusao - data_chegada)::numeric
    ELSE NULL
  END
`;

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
        (
          ROUND(
            AVG(
              ${SQL_DIAS_RESPOSTA}
            ),
            1
          )
        )::float8 AS "avgTempoResposta"
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

    // Mês = EXTRACT(MONTH FROM data_chegada): quantidade e AVG de tempo são do mesmo conjunto (chegada naquele mês/regional).
    const perRegionalMonthSql = `
      SELECT
        COALESCE(regional, '') AS regional,
        EXTRACT(MONTH FROM data_chegada)::int AS "mesNumero",
        COUNT(*)::int AS total,
        (
          ROUND(
            AVG(
              ${SQL_DIAS_RESPOSTA}
            ),
            1
          )
        )::float8 AS "avgTempoResposta"
      FROM demandas_trabalhistas
      ${whereSql}
      AND data_chegada IS NOT NULL
      GROUP BY regional, (EXTRACT(MONTH FROM data_chegada)::int)
      ORDER BY regional, (EXTRACT(MONTH FROM data_chegada)::int);
    `;

    const perTipoDemandaSql = `
      SELECT
        COALESCE(tipo_demanda, '') AS "tipoDemanda",
        COUNT(*)::int AS total
      FROM demandas_trabalhistas
      ${whereSql}
      GROUP BY tipo_demanda
      ORDER BY tipo_demanda;
    `;

    /** Uma única média sobre todos os processos do recorte (não é média das médias por regional). */
    const globalAvgSql = `
      SELECT
        (
          ROUND(
            AVG(
              ${SQL_DIAS_RESPOSTA}
            ),
            1
          )
        )::float8 AS "avgTempoRespostaGeral"
      FROM demandas_trabalhistas
      ${whereSql}
    `;

    const [perRegionalRaw, perMonthRaw, perRegionalMonthRaw, perTipoDemandaRaw, globalAvgRows] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(perRegionalSql),
      prisma.$queryRawUnsafe<any[]>(perMonthSql),
      prisma.$queryRawUnsafe<any[]>(perRegionalMonthSql),
      prisma.$queryRawUnsafe<any[]>(perTipoDemandaSql),
      prisma.$queryRawUnsafe<any[]>(globalAvgSql),
    ]);

    const perRegional = mapAvgOnRows(convertBigIntToNumber(perRegionalRaw || []));
    const perMonth = convertBigIntToNumber(perMonthRaw || []);
    const perRegionalMonth = mapAvgOnRows(convertBigIntToNumber(perRegionalMonthRaw || []));
    const perTipoDemanda = convertBigIntToNumber(perTipoDemandaRaw || []);
    const globalRow = convertBigIntToNumber((globalAvgRows || [])[0] || {});
    const avgTempoRespostaGeral = normalizeAvgTempoResposta(globalRow?.avgTempoRespostaGeral);

    return NextResponse.json({
      ok: true,
      perRegional,
      perMonth,
      perRegionalMonth,
      perTipoDemanda,
      avgTempoRespostaGeral,
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

