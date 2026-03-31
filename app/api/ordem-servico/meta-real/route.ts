import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

/**
 * Meta vs Real — exercício 2026 (fixo).
 *
 * Coorte (META): na folha em 01/01/2026 (admissão até essa data; demissão antes de 01/01/2026 exclui).
 * Quem foi demitido depois em 2026 continua na coorte.
 *
 * REAL: na coorte, linha em ordem_servico com entregue, data_entrega ou termo_recusa indica OS lançada
 * (importações antigas podem ter só data ou só flag). CPF casa só com dígitos (ignora máscara).
 * Filtro regional = mesma regra da list (JOIN por UPPER/TRIM + unidades da regional).
 */

const ANO_OS = 2026;
const INI_EXERCICIO = `${ANO_OS}-01-01`;

const demDataExpr = `(
  CASE
    WHEN TRIM(a.demissao) ~ '^\\d+$' THEN (DATE '1899-12-30' + (TRIM(a.demissao)::int))
    WHEN TRIM(a.demissao) ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(TRIM(a.demissao), 1, 10)::date
    WHEN TRIM(a.demissao) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(TRIM(a.demissao), 1, 10), 'DD/MM/YYYY')
    ELSE NULL
  END
)`;

const admDataExpr = `(
  CASE
    WHEN a.admissao IS NULL OR TRIM(COALESCE(a.admissao::text, '')) = '' THEN NULL
    WHEN TRIM(a.admissao::text) ~ '^\\d+$' THEN (DATE '1899-12-30' + TRIM(a.admissao::text)::int)
    WHEN TRIM(a.admissao::text) ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(TRIM(a.admissao::text), 1, 10)::date
    WHEN TRIM(a.admissao::text) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(SUBSTRING(TRIM(a.admissao::text), 1, 10), 'DD/MM/YYYY')
    ELSE NULL
  END
)`;

const coorte2026Sql = `(
  (
    a.admissao IS NULL
    OR TRIM(COALESCE(a.admissao::text, '')) = ''
    OR (${admDataExpr}) IS NULL
    OR (${admDataExpr}) <= DATE '${INI_EXERCICIO}'
  )
  AND (
    a.demissao IS NULL
    OR TRIM(a.demissao) = ''
    OR (${demDataExpr}) IS NULL
    OR (${demDataExpr}) >= DATE '${INI_EXERCICIO}'
  )
)`;

/** CPF só dígitos — mesmo critério do JOIN em list. */
const cpfDigits = (col: string) =>
  `NULLIF(regexp_replace(TRIM(COALESCE(${col}, '')), '[^0-9]', '', 'g'), '')`;

const osLancadaSql = `(
  os.entregue IS TRUE
  OR os.data_entrega IS NOT NULL
  OR COALESCE(os.termo_recusa, false) = true
)`;

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
    const regional = (url.searchParams.get('regional') || '').trim();

    const hasStg: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_alterdata_v2'
      ) AS exists
    `);
    if (!hasStg?.[0]?.exists) {
      const z = Object.fromEntries(
        ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((m) => [m, 0])
      );
      return NextResponse.json({
        ok: true,
        meta: z,
        metaMensal: z,
        real: z,
        realAcumulado: z,
        totalColaboradores: 0,
        totalMeta: 0,
        totalReal: 0,
        ano: ANO_OS,
      });
    }

    const hasUnidReg: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_unid_reg'
      ) AS exists
    `);
    const useUnidReg = hasUnidReg?.[0]?.exists;

    const escReg = regional.replace(/'/g, "''");
    const regionalFiltro =
      regional && useUnidReg
        ? `AND (
            UPPER(TRIM(COALESCE((
              SELECT ur.regional_responsavel FROM stg_unid_reg ur
              WHERE UPPER(TRIM(ur.nmdepartamento)) = UPPER(TRIM(COALESCE(a.unidade_hospitalar, '')))
              LIMIT 1
            ), ''))) = UPPER(TRIM('${escReg}'))
            OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) IN (
              SELECT UPPER(TRIM(nmdepartamento)) FROM stg_unid_reg
              WHERE UPPER(TRIM(regional_responsavel)) = UPPER(TRIM('${escReg}'))
            )
          )`
        : '';

    const whereClause = `WHERE ${coorte2026Sql} ${regionalFiltro}`;

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

    const cpfA = cpfDigits('a.cpf');
    const joinOs = `INNER JOIN ordem_servico os ON ${cpfA} IS NOT NULL AND length(${cpfA}) >= 11
      AND ${cpfA} = ${cpfDigits('os.colaborador_cpf')}`;

    /** REAL = coorte com OS já registrada (qualquer ano / import legado). */
    const totalRealQuery = `
      SELECT COUNT(DISTINCT a.cpf)::int AS total
      FROM stg_alterdata_v2 a
      ${joinOs}
      ${whereClause}
      AND COALESCE(a.cpf, '') != ''
      AND COALESCE(a.funcao, '') != ''
      AND ${osLancadaSql}
    `;
    const totalRealResult: any[] = await prisma.$queryRawUnsafe(totalRealQuery);
    const totalReal = parseInt(totalRealResult[0]?.total || '0', 10);

    const meses = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const realAcumulado: Record<string, number> = {};
    const realMeses: Record<string, number> = {};
    meses.forEach((m) => {
      realAcumulado[m] = totalReal;
      realMeses[m] = 0;
    });

    return NextResponse.json({
      ok: true,
      meta: metaAcumulada,
      metaMensal: metaAcumulada,
      real: realMeses,
      realAcumulado: realAcumulado,
      totalColaboradores: totalMeta,
      totalMeta: totalMeta,
      totalReal: totalReal,
      ano: ANO_OS,
    });
  } catch (e: any) {
    console.error('[ordem-servico/meta-real] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
