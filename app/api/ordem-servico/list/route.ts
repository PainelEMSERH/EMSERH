import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sqlIsAbandonoEmprego, sqlOrdemServicoJoinOn } from '@/lib/ordem-servico-sql';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const INI_EXERCICIO = '2026-01-01';
const FIM_EXERCICIO = '2027-01-01';

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

/**
 * Coorte: na folha em 01/01/2026.
 * Demissão antes de 01/01/2026 = fora. Demitido em 2026 ou sem demissão = entra na meta.
 */
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

/**
 * Lista na tela: coorte 01/01/2026 + novos contratados no exercício (adm após 01/01/2026).
 * Meta vs Real em meta-real/route.ts continua só com coorte2026Sql — não alterar lá.
 */
const listagemAlterdataSql = `(
  ${coorte2026Sql}
  OR (
    (${admDataExpr}) IS NOT NULL
    AND (${admDataExpr}) > DATE '${INI_EXERCICIO}'
    AND (${admDataExpr}) < DATE '${FIM_EXERCICIO}'
    AND (
      a.demissao IS NULL
      OR TRIM(a.demissao) = ''
      OR (${demDataExpr}) IS NULL
      OR (${demDataExpr}) >= DATE '${INI_EXERCICIO}'
    )
  )
)`;

const joinOrdemServicoOn = sqlOrdemServicoJoinOn('a.cpf', 'os.colaborador_cpf');

/** OS já lançada / registrada (alinha com meta-real). */
const osJaLancadaSql = `(
  COALESCE(os.entregue, false)
  OR os.data_entrega IS NOT NULL
  OR COALESCE(os.termo_recusa, false)
  OR (os.responsavel IS NOT NULL AND length(trim(os.responsavel)) > 0)
)`;

function statusOsSql(entregueParam: string): string {
  const st = entregueParam.trim().toLowerCase();
  if (!st || st === 'todos' || st === 'all') return '';
  if (st === 'pendentes' || st === 'pendente' || st === 'nao') {
    return `AND (os.id IS NULL OR NOT ${osJaLancadaSql})`;
  }
  if (st === 'entregues' || st === 'entregue') {
    return 'AND os.entregue = true AND COALESCE(os.termo_recusa, false) = false';
  }
  if (st === 'termo_recusa' || st === 'recusa' || st === 'recusado') {
    return 'AND os.entregue = true AND COALESCE(os.termo_recusa, false) = true';
  }
  if (st === 'abandono' || st === 'abandono_emprego') {
    return `AND ${sqlIsAbandonoEmprego('os')}`;
  }
  if (st === 'sim' || st === 'concluidos') {
    return `AND ${osJaLancadaSql}`;
  }
  return '';
}

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
    await prisma.$executeRawUnsafe(`
      ALTER TABLE ordem_servico ADD COLUMN IF NOT EXISTS situacao_colaborador TEXT;
    `);

    const url = new URL(req.url);
    const regional = (url.searchParams.get('regional') || '').trim();
    const unidade = (url.searchParams.get('unidade') || '').trim();
    const entregue = url.searchParams.get('entregue') || '';
    const search = (url.searchParams.get('search') || '').trim();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(10, parseInt(url.searchParams.get('pageSize') || '25', 10)));
    const sortBy = url.searchParams.get('sortBy') || 'nome';
    const sortDir = url.searchParams.get('sortDir') || 'asc';

    const offset = (page - 1) * pageSize;

    const hasTable: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_alterdata_v2'
      ) AS exists
    `);

    if (!hasTable?.[0]?.exists) {
      return NextResponse.json({ ok: true, rows: [], total: 0 });
    }

    const hasUnidReg: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_unid_reg'
      ) AS exists
    `);
    const useJoin = hasUnidReg?.[0]?.exists;

    const wh: string[] = [];
    wh.push(listagemAlterdataSql);

    if (regional && useJoin) {
      const escReg = regional.replace(/'/g, "''");
      wh.push(`(UPPER(TRIM(COALESCE(u.regional_responsavel, ''))) = UPPER(TRIM('${escReg}')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) IN (
        SELECT UPPER(TRIM(nmdepartamento)) FROM stg_unid_reg WHERE UPPER(TRIM(regional_responsavel)) = UPPER(TRIM('${escReg}'))
      ))`);
    }

    if (unidade) {
      const escUni = unidade.replace(/'/g, "''");
      if (useJoin) {
        wh.push(`(UPPER(TRIM(COALESCE(u.nmdepartamento, ''))) = UPPER(TRIM('${escUni}')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM('${escUni}')) OR UPPER(TRIM(COALESCE(u.nmdepartamento, ''))) LIKE UPPER(TRIM('%${escUni}%')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) LIKE UPPER(TRIM('%${escUni}%')))`);
      } else {
        wh.push(`(UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM('${escUni}')) OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) LIKE UPPER(TRIM('%${escUni}%')))`);
      }
    }

    if (search) {
      const escSearch = search.replace(/'/g, "''");
      wh.push(`(
        a.colaborador ILIKE '%${escSearch}%' OR
        a.cpf ILIKE '%${escSearch}%' OR
        a.matricula ILIKE '%${escSearch}%'
      )`);
    }

    wh.push(`COALESCE(a.cpf, '') != ''`);
    wh.push(`COALESCE(a.funcao, '') != ''`);

    const statusExtra = statusOsSql(entregue);
    const whereCore = `WHERE ${wh.join(' AND ')} ${statusExtra}`;

    const orderExpr =
      sortBy === 'nome'
        ? 'sub.nome'
        : sortBy === 'unidade'
          ? 'sub.unidade'
          : sortBy === 'regional'
            ? 'sub.regional'
            : sortBy === 'dataAdmissao'
              ? 'sub."dataAdmissao"'
              : 'sub.nome';

    const rowsSql = useJoin
      ? `
      SELECT sub.* FROM (
        SELECT DISTINCT ON (a.cpf)
          COALESCE(a.cpf, '') AS cpf,
          COALESCE(a.colaborador, '') AS nome,
          COALESCE(a.matricula, '') AS matricula,
          COALESCE(NULLIF(TRIM(u.nmdepartamento), ''), NULLIF(TRIM(a.unidade_hospitalar), ''), '') AS unidade,
          COALESCE(NULLIF(TRIM(u.regional_responsavel), ''), '') AS regional,
          COALESCE(a.funcao, '') AS funcao,
          CASE 
            WHEN a.admissao IS NULL OR a.admissao = '' OR TRIM(a.admissao) = '' THEN NULL
            ELSE a.admissao::text
          END AS "dataAdmissao",
          COALESCE(os.entregue, false) AS "osEntregue",
          COALESCE(os.termo_recusa, false) AS "termoRecusa",
          os.data_entrega::text AS "dataEntregaOS",
          os.responsavel AS "responsavelEntrega",
          os.situacao_colaborador AS "situacaoColaborador"
        FROM stg_alterdata_v2 a
        LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
        LEFT JOIN ordem_servico os ON ${joinOrdemServicoOn}
        ${whereCore}
        ORDER BY a.cpf, a.updated_at DESC NULLS LAST, a.colaborador
      ) sub
      ORDER BY ${orderExpr} ${sortDir.toUpperCase()}
      LIMIT ${pageSize} OFFSET ${offset}
    `
      : `
      SELECT sub.* FROM (
        SELECT DISTINCT ON (a.cpf)
          COALESCE(a.cpf, '') AS cpf,
          COALESCE(a.colaborador, '') AS nome,
          COALESCE(a.matricula, '') AS matricula,
          COALESCE(a.unidade_hospitalar, '') AS unidade,
          '' AS regional,
          COALESCE(a.funcao, '') AS funcao,
          CASE 
            WHEN a.admissao IS NULL OR a.admissao = '' OR TRIM(a.admissao) = '' THEN NULL
            ELSE a.admissao::text
          END AS "dataAdmissao",
          COALESCE(os.entregue, false) AS "osEntregue",
          COALESCE(os.termo_recusa, false) AS "termoRecusa",
          os.data_entrega::text AS "dataEntregaOS",
          os.responsavel AS "responsavelEntrega",
          os.situacao_colaborador AS "situacaoColaborador"
        FROM stg_alterdata_v2 a
        LEFT JOIN ordem_servico os ON ${joinOrdemServicoOn}
        ${whereCore}
        ORDER BY a.cpf, a.updated_at DESC NULLS LAST, a.colaborador
      ) sub
      ORDER BY ${orderExpr} ${sortDir.toUpperCase()}
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const countSql = useJoin
      ? `
      SELECT COUNT(DISTINCT a.cpf)::int AS total
      FROM stg_alterdata_v2 a
      LEFT JOIN stg_unid_reg u ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
      LEFT JOIN ordem_servico os ON ${joinOrdemServicoOn}
      ${whereCore}
    `
      : `
      SELECT COUNT(DISTINCT a.cpf)::int AS total
      FROM stg_alterdata_v2 a
      LEFT JOIN ordem_servico os ON ${joinOrdemServicoOn}
      ${whereCore}
    `;

    const [rowsResult, totalResult] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(rowsSql),
      prisma.$queryRawUnsafe<any[]>(countSql),
    ]);

    const rowsRaw = Array.isArray(rowsResult) ? rowsResult : [];
    const total = Number((totalResult as any)?.[0]?.total ?? 0);

    const rowsFinal = rowsRaw.map((r: any) => {
      const situacaoColaborador = r.situacaoColaborador != null ? String(r.situacaoColaborador).trim() : '';
      return {
        id: String(r.cpf || ''),
        nome: String(r.nome || ''),
        cpf: String(r.cpf || ''),
        matricula: String(r.matricula || ''),
        unidade: String(r.unidade || ''),
        regional: String(r.regional || ''),
        funcao: String(r.funcao || ''),
        dataAdmissao: r.dataAdmissao ? String(r.dataAdmissao) : null,
        situacaoColaborador: situacaoColaborador || null,
        osEntregue:
          Boolean(r.osEntregue) ||
          Boolean(r.termoRecusa) ||
          !!(r.dataEntregaOS != null && String(r.dataEntregaOS).trim() !== '') ||
          !!(r.responsavelEntrega != null && String(r.responsavelEntrega).trim() !== ''),
        termoRecusa: Boolean(r.termoRecusa),
        dataEntregaOS: r.dataEntregaOS ? String(r.dataEntregaOS) : null,
        responsavelEntrega: r.responsavelEntrega ? String(r.responsavelEntrega) : null,
      };
    });

    return NextResponse.json({
      ok: true,
      rows: rowsFinal,
      total,
    });
  } catch (e: any) {
    console.error('[ordem-servico/list] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
