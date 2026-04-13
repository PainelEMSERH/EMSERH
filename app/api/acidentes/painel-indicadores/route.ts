export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { REGIONALS } from '@/lib/unidReg';
import { getTaxaFrequenciaRegistros } from '@/lib/acidentes/taxaFrequenciaCore';

const dataParsedExpr = `(CASE
  WHEN TRIM(COALESCE(data_acidente,'')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN (SUBSTRING(TRIM(data_acidente), 1, 10))::date
  WHEN TRIM(COALESCE(data_acidente,'')) ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}' THEN to_date(SUBSTRING(TRIM(data_acidente), 1, 10), 'DD/MM/YYYY')
  ELSE NULL END)`;
const yearExpr = `EXTRACT(YEAR FROM ${dataParsedExpr})::int`;

function yearWhereSql(paramIdx: number): string {
  return `( (ano IS NOT NULL AND ano::int = $${paramIdx}) OR ( (ano IS NULL OR ano::text = '') AND ${dataParsedExpr} IS NOT NULL AND ${yearExpr} = $${paramIdx} ) )`;
}

/** GET ?ano= — painel SST acidentes (TF, contagens, investigações, aderência; divulgação = placeholder até haver base). */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const ano = parseInt(url.searchParams.get('ano') || String(new Date().getFullYear()), 10);
    if (Number.isNaN(ano) || ano < 2026) {
      return NextResponse.json(
        { ok: false, error: 'Indicadores disponíveis a partir de 2026.' },
        { status: 400 }
      );
    }

    const { registros, fonteAtivos } = await getTaxaFrequenciaRegistros(ano, '');
    let totalAcidentesAno = 0;
    let totalHorasHomem = 0;
    for (const r of registros) {
      totalAcidentesAno += r.numeroAcidentes;
      totalHorasHomem += r.horasHomemTrabalhadas;
    }
    const taxaFrequenciaAnualEmserh =
      totalHorasHomem > 0
        ? Math.round(((totalAcidentesAno * 1_000_000) / totalHorasHomem) * 100) / 100
        : null;

    const p1: any[] = [ano];
    const whereYear = `WHERE ${yearWhereSql(1)} AND ${dataParsedExpr} IS NOT NULL`;

    const acidentesPorRegRows = await prisma.$queryRawUnsafe<Array<{ regional: string; quantidade: number }>>(
      `SELECT COALESCE(NULLIF(TRIM("Regional"),''), 'Não informado') AS regional, COUNT(*)::int AS quantidade
       FROM stg_acidentes ${whereYear}
       GROUP BY 1`,
      ...p1
    );

    const acidentesPorRegional: Record<string, number> = {};
    for (const r of REGIONALS) acidentesPorRegional[r] = 0;
    for (const row of acidentesPorRegRows || []) {
      const reg = (row.regional || '').toUpperCase();
      if (REGIONALS.includes(reg as (typeof REGIONALS)[number])) {
        acidentesPorRegional[reg] = Number(row.quantidade ?? 0);
      }
    }

    const refSql = `TRIM(COALESCE(numero_cat,'')) || '|' || to_char((${dataParsedExpr})::date, 'YYYY-MM-DD') || '|' || TRIM(COALESCE("NmFuncionario",''))`;

    type InvRow = { regional: string; statusInvestigacao: string | null };
    let invRows: InvRow[] = [];
    try {
      invRows = await prisma.$queryRawUnsafe<InvRow[]>(
        `WITH acs AS (
           SELECT ${refSql} AS ref,
                  COALESCE(NULLIF(TRIM("Regional"),''), 'Não informado') AS regional
           FROM stg_acidentes
           ${whereYear}
         )
         SELECT a.regional, i."statusInvestigacao" AS "statusInvestigacao"
         FROM acs a
         INNER JOIN "AcidenteInvestigacao" i ON i."acidenteRef" = a.ref`,
        ...p1
      );
    } catch {
      invRows = [];
    }

    const investigadosPorRegional: Record<string, number> = {};
    const concluidosPorRegional: Record<string, number> = {};
    for (const r of REGIONALS) {
      investigadosPorRegional[r] = 0;
      concluidosPorRegional[r] = 0;
    }

    let investigadosNoAno = 0;
    let concluidosNoAno = 0;
    for (const row of invRows) {
      investigadosNoAno += 1;
      const reg = (row.regional || '').toUpperCase();
      if (REGIONALS.includes(reg as (typeof REGIONALS)[number])) {
        investigadosPorRegional[reg] += 1;
        if ((row.statusInvestigacao || '').toLowerCase() === 'concluida') {
          concluidosNoAno += 1;
          concluidosPorRegional[reg] += 1;
        }
      } else if ((row.statusInvestigacao || '').toLowerCase() === 'concluida') {
        concluidosNoAno += 1;
      }
    }

    const aderenciaPercent =
      investigadosNoAno > 0 ? Math.round((concluidosNoAno / investigadosNoAno) * 10000) / 100 : null;

    const aderenciaPorRegional: Record<string, number | null> = {};
    for (const r of REGIONALS) {
      const inv = investigadosPorRegional[r];
      aderenciaPorRegional[r] =
        inv > 0 ? Math.round((concluidosPorRegional[r] / inv) * 10000) / 100 : null;
    }

    const divulgacaoNota =
      'Percentual de unidades com divulgação de programas legais: indicador sem base automática no painel; pode ser alimentado manualmente ou por integração futura.';
    const unidadesDivulgacaoPercent: number | null = null;
    const divulgacaoPorRegional: Record<string, number | null> = {};
    for (const r of REGIONALS) divulgacaoPorRegional[r] = null;

    return NextResponse.json({
      ok: true,
      ano,
      fonteAtivosTF: fonteAtivos,
      taxaFrequenciaAnualEmserh,
      totalAcidentesAno,
      acidentesPorRegional,
      investigadosNoAno,
      investigadosPorRegional,
      aderenciaPlanoAcaoPercent: aderenciaPercent,
      aderenciaPorRegional,
      unidadesDivulgacaoProgramasLegaisPercent: unidadesDivulgacaoPercent,
      divulgacaoProgramasLegaisPorRegional: divulgacaoPorRegional,
      notaAderencia:
        'Percentual de investigações com status "Concluída" entre as vinculadas a acidentes do ano (proxy de P.A.).',
      notaDivulgacao: divulgacaoNota,
    });
  } catch (e: any) {
    console.error('[acidentes/painel-indicadores]', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
