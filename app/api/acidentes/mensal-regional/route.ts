export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { REGIONALS, type Regional } from '@/lib/unidReg';

const ANO_MIN = 2026;

const dataParsedExpr = `(CASE
  WHEN TRIM(COALESCE(data_acidente,'')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN (SUBSTRING(TRIM(data_acidente), 1, 10))::date
  WHEN TRIM(COALESCE(data_acidente,'')) ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}' THEN to_date(SUBSTRING(TRIM(data_acidente), 1, 10), 'DD/MM/YYYY')
  ELSE NULL END)`;
const yearExpr = `EXTRACT(YEAR FROM ${dataParsedExpr})::int`;
const monthExpr = `EXTRACT(MONTH FROM ${dataParsedExpr})::int`;

function yearWhereSql(paramIdx: number): string {
  return `( (ano IS NOT NULL AND ano::int = $${paramIdx}) OR ( (ano IS NULL OR ano::text = '') AND ${dataParsedExpr} IS NOT NULL AND ${yearExpr} = $${paramIdx} ) )`;
}

/** Mês efetivo: coluna mes da planilha se válida; senão deriva da data. */
const mesEffExpr = `(CASE
  WHEN mes IS NOT NULL AND TRIM(mes::text) ~ '^[0-9]+$' AND mes::int BETWEEN 1 AND 12 THEN mes::int
  ELSE ${monthExpr} END)`;

function normalizeRegional(raw: string): Regional | 'OUTROS' {
  const u = (raw || '').toUpperCase().trim();
  if (u === 'CENTRAL') return 'CENTRO';
  if (REGIONALS.includes(u as Regional)) return u as Regional;
  return 'OUTROS';
}

/** GET ?ano= — contagens de acidentes por mês (1–12) e regional (Norte/Leste/Centro/Sul + outros). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ano = parseInt(url.searchParams.get('ano') || String(ANO_MIN), 10);
    if (Number.isNaN(ano) || ano < ANO_MIN) {
      return NextResponse.json(
        { ok: false, error: `Informe um ano a partir de ${ANO_MIN}.` },
        { status: 400 }
      );
    }

    const whereYear = `WHERE ${yearWhereSql(1)} AND ${dataParsedExpr} IS NOT NULL`;

    const rows = await prisma.$queryRawUnsafe<Array<{ mes: number; regional: string; quantidade: number }>>(
      `SELECT ${mesEffExpr}::int AS mes,
              COALESCE(NULLIF(TRIM("Regional"),''), 'Não informado') AS regional,
              COUNT(*)::int AS quantidade
       FROM stg_acidentes
       ${whereYear}
       GROUP BY 1, 2`,
      ano
    );

    const porRegionalMes: Record<Regional, number[]> = {} as Record<Regional, number[]>;
    for (const r of REGIONALS) porRegionalMes[r] = Array(12).fill(0);
    const outrosPorMes = Array(12).fill(0);

    for (const row of rows || []) {
      const m = Number(row.mes);
      if (m < 1 || m > 12) continue;
      const idx = m - 1;
      const q = Number(row.quantidade ?? 0) || 0;
      const reg = normalizeRegional(row.regional || '');
      if (reg === 'OUTROS') outrosPorMes[idx] += q;
      else porRegionalMes[reg][idx] += q;
    }

    const totalPorMes = Array(12).fill(0);
    for (let i = 0; i < 12; i++) {
      totalPorMes[i] =
        REGIONALS.reduce((s, r) => s + porRegionalMes[r][i], 0) + outrosPorMes[i];
    }

    const totalPorRegional: Record<Regional, number> = {} as Record<Regional, number>;
    for (const r of REGIONALS) {
      totalPorRegional[r] = porRegionalMes[r].reduce((a, b) => a + b, 0);
    }
    const totalOutros = outrosPorMes.reduce((a, b) => a + b, 0);
    const totalAno = totalPorMes.reduce((a, b) => a + b, 0);

    return NextResponse.json({
      ok: true,
      ano,
      porRegionalMes,
      outrosPorMes: totalOutros > 0 ? outrosPorMes : null,
      totalPorMes,
      totalPorRegional,
      totalOutros: totalOutros > 0 ? totalOutros : 0,
      totalAno,
    });
  } catch (e: any) {
    console.error('[acidentes/mensal-regional][GET]', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
