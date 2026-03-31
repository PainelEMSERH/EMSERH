import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * API para Meta e Real de Ordem de Serviço
 *
 * META = colaboradores ativos no ano filtrado (mesma meta em todos os meses).
 *
 * REAL acumulado (por mês do ano selecionado) = quantos desses colaboradores já tinham
 * OS entregue até o último dia daquele mês, em qualquer ano (a OS é única por CPF).
 * Assim, 2026 “herda” entregas feitas em 2024/2025 sem apagar ou relançar registros.
 *
 * REAL mensal (`real`) = novas entregas apenas naquele mês/calendário do ano filtrado
 * (útil para consumidores da API); a tela principal usa `realAcumulado`.
 */
export async function GET(req: NextRequest) {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ordem_servico (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        colaborador_cpf TEXT NOT NULL,
        entregue BOOLEAN NOT NULL DEFAULT false,
        data_entrega DATE,
        responsavel TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(colaborador_cpf)
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_ordem_servico_colaborador_cpf ON ordem_servico(colaborador_cpf);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_ordem_servico_data_entrega ON ordem_servico(data_entrega);
    `);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS termo_recusa BOOLEAN NOT NULL DEFAULT false;
    `);

    const url = new URL(req.url);
    const regional = url.searchParams.get('regional') || '';
    const ano = url.searchParams.get('ano') || String(new Date().getFullYear());

    const anoAtual = parseInt(ano, 10);
    if (!Number.isFinite(anoAtual) || anoAtual < 2000 || anoAtual > 2100) {
      return NextResponse.json({ ok: false, error: 'Ano inválido' }, { status: 400 });
    }

    const DEMISSAO_ANO_MINIMO = anoAtual;

    const demissaoFiltro = `(
      a.demissao IS NULL
      OR a.demissao = ''
      OR TRIM(a.demissao) = ''
      OR (
        CASE
          WHEN TRIM(a.demissao) ~ '^\\d+$' THEN (DATE '1899-12-30' + (TRIM(a.demissao)::int))
          WHEN TRIM(a.demissao) ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(TRIM(a.demissao), 1, 10)::date
          WHEN TRIM(a.demissao) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(TRIM(a.demissao), 1, 10), 'DD/MM/YYYY')
          ELSE NULL
        END
      ) IS NOT NULL
      AND EXTRACT(YEAR FROM (
        CASE
          WHEN TRIM(a.demissao) ~ '^\\d+$' THEN (DATE '1899-12-30' + (TRIM(a.demissao)::int))
          WHEN TRIM(a.demissao) ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(TRIM(a.demissao), 1, 10)::date
          WHEN TRIM(a.demissao) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(TRIM(a.demissao), 1, 10), 'DD/MM/YYYY')
          ELSE NULL
        END
      ))::int >= ${DEMISSAO_ANO_MINIMO}
    )`;

    const regionalFiltro = regional
      ? `AND COALESCE((SELECT ur.regional_responsavel FROM stg_unid_reg ur 
                        WHERE ur.nmdepartamento = a.unidade_hospitalar 
                        LIMIT 1),'') = '${regional.replace(/'/g, "''")}'`
      : '';

    const whereClause = `WHERE ${demissaoFiltro} ${regionalFiltro}`;

    const totalMetaQuery = `
      SELECT COUNT(DISTINCT a.cpf) as total
      FROM stg_alterdata_v2 a
      ${whereClause}
      AND COALESCE(a.cpf, '') != ''
      AND COALESCE(a.funcao, '') != ''
    `;
    const totalMetaResult: any[] = await prisma.$queryRawUnsafe(totalMetaQuery);
    const totalMeta = parseInt(totalMetaResult[0]?.total || '0', 10);

    const metaAcumulada: Record<string, number> = {
      '01': totalMeta,
      '02': totalMeta,
      '03': totalMeta,
      '04': totalMeta,
      '05': totalMeta,
      '06': totalMeta,
      '07': totalMeta,
      '08': totalMeta,
      '09': totalMeta,
      '10': totalMeta,
      '11': totalMeta,
      '12': totalMeta,
    };

    /** OS já entregues com data estritamente antes do ano visualizado (não conta data_entrega NULL). */
    const beforeYearQuery = `
      SELECT COUNT(DISTINCT a.cpf) AS total
      FROM stg_alterdata_v2 a
      INNER JOIN ordem_servico os ON os.colaborador_cpf = a.cpf
      ${whereClause}
      AND COALESCE(a.cpf, '') != ''
      AND COALESCE(a.funcao, '') != ''
      AND os.entregue = true
      AND os.data_entrega IS NOT NULL
      AND os.data_entrega < DATE '${anoAtual}-01-01'
    `;
    const beforeYearResult: any[] = await prisma.$queryRawUnsafe(beforeYearQuery);
    const beforeYearCount = parseInt(beforeYearResult[0]?.total || '0', 10);

    /** REAL acumulado até o fim de cada mês do ano (qualquer ano da data_entrega). */
    const realAcumuladoQuery = `
      SELECT mes.m AS mes,
        (
          SELECT COUNT(DISTINCT a.cpf)::int
          FROM stg_alterdata_v2 a
          INNER JOIN ordem_servico os ON os.colaborador_cpf = a.cpf
          ${whereClause}
          AND COALESCE(a.cpf, '') != ''
          AND COALESCE(a.funcao, '') != ''
          AND os.entregue = true
          AND (
            os.data_entrega IS NULL
            OR os.data_entrega < (make_date(${anoAtual}, mes.m::int, 1) + interval '1 month')::date
          )
        ) AS total
      FROM generate_series(1, 12) AS mes(m)
      ORDER BY mes.m
    `;
    const realAcumRows: any[] = await prisma.$queryRawUnsafe(realAcumuladoQuery);

    const realAcumulado: Record<string, number> = {
      '01': 0,
      '02': 0,
      '03': 0,
      '04': 0,
      '05': 0,
      '06': 0,
      '07': 0,
      '08': 0,
      '09': 0,
      '10': 0,
      '11': 0,
      '12': 0,
    };

    realAcumRows.forEach((r) => {
      const mes = String(r.mes).padStart(2, '0');
      if (realAcumulado[mes] !== undefined) {
        realAcumulado[mes] = parseInt(r.total || '0', 10);
      }
    });

    const realMeses: Record<string, number> = {
      '01': 0,
      '02': 0,
      '03': 0,
      '04': 0,
      '05': 0,
      '06': 0,
      '07': 0,
      '08': 0,
      '09': 0,
      '10': 0,
      '11': 0,
      '12': 0,
    };

    realMeses['01'] = Math.max(0, (realAcumulado['01'] || 0) - beforeYearCount);
    for (let mes = 2; mes <= 12; mes++) {
      const mesStr = String(mes).padStart(2, '0');
      const prev = String(mes - 1).padStart(2, '0');
      realMeses[mesStr] = Math.max(0, (realAcumulado[mesStr] || 0) - (realAcumulado[prev] || 0));
    }

    const totalReal = realAcumulado['12'] || 0;

    return NextResponse.json({
      ok: true,
      meta: metaAcumulada,
      metaMensal: metaAcumulada,
      real: realMeses,
      realAcumulado: realAcumulado,
      totalColaboradores: totalMeta,
      totalMeta: totalMeta,
      totalReal: totalReal,
      ano: anoAtual,
    });
  } catch (e: any) {
    console.error('[ordem-servico/meta-real] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
