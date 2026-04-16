
import { NextRequest } from 'next/server'
import { obrigatoriosWhereSql } from '@/data/epiObrigatorio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type KPI = {
  metaMensal: { valorMeta: number; realizado: number }
  variacaoMensalPerc: number
  metaAnual: { valorMeta: number; realizado: number }
  colaboradoresAtendidos: number
  itensEntregues: number
  pendenciasAbertas: number
  topItens: { itemId: string; nome: string; quantidade: number }[]
}

type Series = { labels: string[]; entregas: number[]; itens: number[] }
type CurvaS = { labels: string[]; mensal: number[]; acumulado: number[] }

type Alertas = {
  estoqueAbaixoMinimo: { unidade: string; item: string; quantidade: number; minimo: number }[]
  pendenciasVencidas: number
}

function startOfMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m - 1, 1, 0, 0, 0))
}
function endOfMonth(y: number, m: number) {
  return new Date(Date.UTC(y, m, 0, 23, 59, 59))
}
function addMonths(d: Date, delta: number) {
  const n = new Date(d)
  n.setUTCMonth(n.getUTCMonth() + delta)
  return n
}

/** CPF normalizado 11 dígitos no SQL (PostgreSQL). */
function sqlNormCpf(alias: string) {
  return `LPAD(RIGHT(REGEXP_REPLACE(REPLACE(COALESCE(${alias}.cpf::text, ''), ' ', ''), '[^0-9]', '', 'g'), 11), 11, '0')`
}

/** Filtro regional em stg_alterdata_v2 (mesma ideia de entregas/meta). */
async function buildRegionalFilterV2(prisma: any, regional: string | null): Promise<string> {
  const r = (regional || '').trim()
  if (!r) return ''

  try {
    const hasUnidReg: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'stg_unid_reg'
      ) AS exists
    `)
    if (!hasUnidReg?.[0]?.exists) return ''

    const esc = r.replace(/'/g, "''")
    return `AND (
      UPPER(TRIM(COALESCE((
        SELECT ur.regional_responsavel FROM stg_unid_reg ur
        WHERE UPPER(TRIM(ur.nmdepartamento)) = UPPER(TRIM(COALESCE(a.unidade_hospitalar, '')))
        LIMIT 1
      ), ''))) = UPPER(TRIM('${esc}'))
      OR UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) IN (
        SELECT UPPER(TRIM(nmdepartamento)) FROM stg_unid_reg
        WHERE UPPER(TRIM(regional_responsavel)) = UPPER(TRIM('${esc}'))
      )
    )`
  } catch {
    return ''
  }
}

const ATIVO_DEMISSAO = `(a.demissao IS NULL OR TRIM(COALESCE(a.demissao::text, '')) = '')`

const EXCL_META = `NOT EXISTS (
  SELECT 1 FROM colaborador_situacao_meta s
  WHERE ${sqlNormCpf('s')} = ${sqlNormCpf('a')}
    AND s.situacao IN ('DEMITIDO_2026_SEM_EPI', 'DEMITIDO_2025_SEM_EPI', 'EXCLUIDO_META')
)`

export async function GET(req: NextRequest) {
  const { prisma } = await import('@/lib/db')
  const { searchParams } = new URL(req.url)
  const regional = searchParams.get('regional') || ''

  const now = new Date()
  const ano = now.getUTCFullYear()
  const mes = now.getUTCMonth() + 1
  const ini = startOfMonth(ano, mes)
  const fim = endOfMonth(ano, mes)
  const iniDate = ini.toISOString().substring(0, 10)
  const fimDate = fim.toISOString().substring(0, 10)
  const anoIniDate = `${ano}-01-01`

  const kpis: KPI = {
    metaMensal: { valorMeta: 0, realizado: 0 },
    variacaoMensalPerc: 0,
    metaAnual: { valorMeta: 0, realizado: 0 },
    colaboradoresAtendidos: 0,
    itensEntregues: 0,
    pendenciasAbertas: 0,
    topItens: [],
  }

  let series: Series = { labels: [], entregas: [], itens: [] }
  let curvaS: CurvaS = { labels: [], mensal: [], acumulado: [] }
  const alertas: Alertas = { estoqueAbaixoMinimo: [], pendenciasVencidas: 0 }

  const regionalSql = await buildRegionalFilterV2(prisma, regional)
  const ncpf = sqlNormCpf('a')

  let exclSituacaoSql = ''
  try {
    const chk: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'colaborador_situacao_meta'
      ) AS e
    `)
    if (chk?.[0]?.e) exclSituacaoSql = `AND ${EXCL_META}`
  } catch {}

  // 1) Colaboradores ativos (v2)
  try {
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(DISTINCT ${ncpf})::int AS c
      FROM stg_alterdata_v2 a
      WHERE ${ATIVO_DEMISSAO}
        AND COALESCE(a.cpf, '') != ''
        AND COALESCE(a.funcao, '') != ''
        ${exclSituacaoSql}
        ${regionalSql}
    `)
    kpis.colaboradoresAtendidos = Number(rows?.[0]?.c || 0)
  } catch {}

  // 2) Itens planejados (obrigatórios) — coorte atual v2 × stg_epi_map
  let planejadosCohorte = 0
  try {
    // Meta é global (todas as regionais), alinhada com a referência da tela de entregas.
    const elig = `
      WITH elig AS (
        SELECT DISTINCT UPPER(REGEXP_REPLACE(a.funcao, '[^A-Z0-9]+', '', 'g')) AS func_key
        FROM stg_alterdata_v2 a
        WHERE ${ATIVO_DEMISSAO}
          AND COALESCE(a.cpf, '') != ''
          AND COALESCE(a.funcao, '') != ''
          ${exclSituacaoSql}
      )
    `
    const obrigPlan = obrigatoriosWhereSql('m.epi_item')
    const r: any[] = await prisma.$queryRawUnsafe(`${elig}
      SELECT COALESCE(SUM(m.quantidade), 0)::int AS q
      FROM elig e
      JOIN stg_epi_map m
        ON UPPER(REGEXP_REPLACE(m.alterdata_funcao, '[^A-Z0-9]+', '', 'g')) = e.func_key
      WHERE ${obrigPlan}
    `)
    planejadosCohorte = Number(r?.[0]?.q || 0)
    // Meta anual = demanda da coorte (não ×12). Meta mensal = fatia linear.
    kpis.metaAnual.valorMeta = planejadosCohorte
    kpis.metaMensal.valorMeta =
      planejadosCohorte > 0 ? Math.max(1, Math.ceil(planejadosCohorte / 12)) : 0
  } catch {}

  // 3) Realizado no mês e no ano (YTD) — só CPFs da coorte e itens obrigatórios
  try {
    const obrig = obrigatoriosWhereSql('b.item')
    const eligSql = `
      (SELECT DISTINCT ${sqlNormCpf('a')} AS ncpf
       FROM stg_alterdata_v2 a
       WHERE ${ATIVO_DEMISSAO}
         AND COALESCE(a.cpf, '') != ''
         AND COALESCE(a.funcao, '') != ''
         ${exclSituacaoSql}
         ${regionalSql}) elig
    `

    const qMes: any[] = await prisma.$queryRawUnsafe(`
      WITH base AS (
        SELECT
          e.cpf AS cpf,
          e.item AS item,
          CASE
            WHEN (elem->>'date') ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN (elem->>'date')::date
            WHEN (elem->>'date') ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date((elem->>'date'), 'DD/MM/YYYY')
            ELSE NULL
          END AS data,
          (elem->>'qty')::int AS quantidade
        FROM epi_entregas e
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.deliveries, '[]'::jsonb)) elem
      )
      SELECT COALESCE(SUM(b.quantidade), 0)::int AS q
      FROM base b
      INNER JOIN ${eligSql} ON elig.ncpf = LPAD(RIGHT(REGEXP_REPLACE(REPLACE(COALESCE(b.cpf::text, ''), ' ', ''), '[^0-9]', '', 'g'), 11), 11, '0')
      WHERE b.data IS NOT NULL
        AND b.data >= '${iniDate}'::date
        AND b.data <= '${fimDate}'::date
        AND ${obrig}
    `)
    const qM = Number(qMes?.[0]?.q || 0)
    kpis.itensEntregues = qM
    kpis.metaMensal.realizado = qM

    const qYtd: any[] = await prisma.$queryRawUnsafe(`
      WITH base AS (
        SELECT
          e.cpf AS cpf,
          e.item AS item,
          CASE
            WHEN (elem->>'date') ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN (elem->>'date')::date
            WHEN (elem->>'date') ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date((elem->>'date'), 'DD/MM/YYYY')
            ELSE NULL
          END AS data,
          (elem->>'qty')::int AS quantidade
        FROM epi_entregas e
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.deliveries, '[]'::jsonb)) elem
      )
      SELECT COALESCE(SUM(b.quantidade), 0)::int AS q
      FROM base b
      INNER JOIN ${eligSql} ON elig.ncpf = LPAD(RIGHT(REGEXP_REPLACE(REPLACE(COALESCE(b.cpf::text, ''), ' ', ''), '[^0-9]', '', 'g'), 11), 11, '0')
      WHERE b.data IS NOT NULL
        AND b.data >= '${anoIniDate}'::date
        AND b.data <= '${fimDate}'::date
        AND ${obrig}
    `)
    kpis.metaAnual.realizado = Number(qYtd?.[0]?.q || 0)
  } catch {}

  // 4) pendências e estoque
  try {
    const p: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        SUM(CASE WHEN LOWER(TRIM(COALESCE(status, ''))) = 'aberta' THEN 1 ELSE 0 END)::int AS abertas,
        SUM(
          CASE
            WHEN LOWER(TRIM(COALESCE(status, ''))) = 'aberta' AND prazo < NOW() THEN 1
            ELSE 0
          END
        )::int AS vencidas
      FROM pendencia
    `)
    kpis.pendenciasAbertas = Number(p?.[0]?.abertas || 0)
    alertas.pendenciasVencidas = Number(p?.[0]?.vencidas || 0)
  } catch {}

  try {
    const eRows: any[] = await prisma.$queryRawUnsafe(`
      SELECT u.nome AS unidade, i.nome AS item, e.quantidade::int AS quantidade, e.minimo::int AS minimo
      FROM estoque e
      JOIN item i ON i.id = e."itemId"
      JOIN unidade u ON u.id = e."unidadeId"
      WHERE (e.quantidade < e.minimo)
      ORDER BY e.quantidade ASC
      LIMIT 6
    `)
    alertas.estoqueAbaixoMinimo = (eRows || []).map((x: any) => ({
      unidade: String(x.unidade),
      item: String(x.item),
      quantidade: Number(x.quantidade || 0),
      minimo: Number(x.minimo || 0),
    }))
  } catch {}

  // 5) séries 6 meses
  try {
    const labels: string[] = []
    const its: number[] = []
    const entr: number[] = []
    const baseRef = new Date(ini)

    const obrigPlan = obrigatoriosWhereSql('m.epi_item')
    const obrigEnt = obrigatoriosWhereSql('b.item')

    for (let delta = -5; delta <= 0; delta++) {
      const d = addMonths(baseRef, delta)
      const y = d.getUTCFullYear()
      const m = d.getUTCMonth() + 1
      const sDate = startOfMonth(y, m).toISOString().substring(0, 10)
      const eDate = endOfMonth(y, m).toISOString().substring(0, 10)
      labels.push(String(m).padStart(2, '0') + '/' + y)

      try {
        // Planejado mensal da série também permanece global (não filtra por regional).
        const elig = `
          WITH elig AS (
            SELECT DISTINCT UPPER(REGEXP_REPLACE(a.funcao, '[^A-Z0-9]+', '', 'g')) AS func_key
            FROM stg_alterdata_v2 a
            WHERE ${ATIVO_DEMISSAO}
              AND COALESCE(a.cpf, '') != ''
              AND COALESCE(a.funcao, '') != ''
              ${exclSituacaoSql}
          )
        `
        const r: any[] = await prisma.$queryRawUnsafe(`${elig}
          SELECT COALESCE(SUM(m.quantidade), 0)::int AS q
          FROM elig e
          JOIN stg_epi_map m
            ON UPPER(REGEXP_REPLACE(m.alterdata_funcao, '[^A-Z0-9]+', '', 'g')) = e.func_key
          WHERE ${obrigPlan}
        `)
        its.push(Number(r?.[0]?.q || 0))
      } catch {
        its.push(0)
      }

      try {
        const eligSql = `
          (SELECT DISTINCT ${sqlNormCpf('a')} AS ncpf
           FROM stg_alterdata_v2 a
           WHERE ${ATIVO_DEMISSAO}
             AND COALESCE(a.cpf, '') != ''
             AND COALESCE(a.funcao, '') != ''
             ${exclSituacaoSql}
             ${regionalSql}) elig
        `
        const r: any[] = await prisma.$queryRawUnsafe(`
          WITH base AS (
            SELECT
              e.cpf AS cpf,
              e.item AS item,
              CASE
                WHEN (elem->>'date') ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN (elem->>'date')::date
                WHEN (elem->>'date') ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date((elem->>'date'), 'DD/MM/YYYY')
                ELSE NULL
              END AS data,
              (elem->>'qty')::int AS quantidade
            FROM epi_entregas e
            CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.deliveries, '[]'::jsonb)) elem
          )
          SELECT COALESCE(SUM(b.quantidade), 0)::int AS q
          FROM base b
          INNER JOIN ${eligSql} ON elig.ncpf = LPAD(RIGHT(REGEXP_REPLACE(REPLACE(COALESCE(b.cpf::text, ''), ' ', ''), '[^0-9]', '', 'g'), 11), 11, '0')
          WHERE b.data IS NOT NULL
            AND b.data >= '${sDate}'::date
            AND b.data <= '${eDate}'::date
            AND ${obrigEnt}
        `)
        entr.push(Number(r?.[0]?.q || 0))
      } catch {
        entr.push(0)
      }
    }

    series = { labels, entregas: entr, itens: its }
  } catch {}

  // 6) Curva S anual (jan-dez): entregue mensal e acumulado
  try {
    const labels: string[] = []
    const mensal: number[] = []
    const acumulado: number[] = []
    const obrigEnt = obrigatoriosWhereSql('b.item')
    const eligSql = `
      (SELECT DISTINCT ${sqlNormCpf('a')} AS ncpf
       FROM stg_alterdata_v2 a
       WHERE ${ATIVO_DEMISSAO}
         AND COALESCE(a.cpf, '') != ''
         AND COALESCE(a.funcao, '') != ''
         ${exclSituacaoSql}
         ${regionalSql}) elig
    `

    let acc = 0
    for (let m = 1; m <= 12; m++) {
      const sDate = startOfMonth(ano, m).toISOString().substring(0, 10)
      const eDate = endOfMonth(ano, m).toISOString().substring(0, 10)
      labels.push(String(m).padStart(2, '0') + '/' + ano)

      const r: any[] = await prisma.$queryRawUnsafe(`
        WITH base AS (
          SELECT
            e.cpf AS cpf,
            e.item AS item,
            CASE
              WHEN (elem->>'date') ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN (elem->>'date')::date
              WHEN (elem->>'date') ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date((elem->>'date'), 'DD/MM/YYYY')
              ELSE NULL
            END AS data,
            (elem->>'qty')::int AS quantidade
          FROM epi_entregas e
          CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.deliveries, '[]'::jsonb)) elem
        )
        SELECT COALESCE(SUM(b.quantidade), 0)::int AS q
        FROM base b
        INNER JOIN ${eligSql}
          ON elig.ncpf = LPAD(
            RIGHT(REGEXP_REPLACE(REPLACE(COALESCE(b.cpf::text, ''), ' ', ''), '[^0-9]', '', 'g'), 11),
            11,
            '0'
          )
        WHERE b.data IS NOT NULL
          AND b.data >= '${sDate}'::date
          AND b.data <= '${eDate}'::date
          AND ${obrigEnt}
      `)

      const q = Number(r?.[0]?.q || 0)
      mensal.push(q)
      acc += q
      acumulado.push(acc)
    }

    curvaS = { labels, mensal, acumulado }
  } catch {}

  // variação mensal
  if (kpis.metaMensal.valorMeta > 0) {
    kpis.variacaoMensalPerc = Number(
      (
        ((kpis.metaMensal.realizado - kpis.metaMensal.valorMeta) / kpis.metaMensal.valorMeta) *
        100
      ).toFixed(1),
    )
  } else {
    kpis.variacaoMensalPerc = 0
  }

  return new Response(JSON.stringify({ kpis, series, curvaS, alertas }), {
    headers: { 'content-type': 'application/json' },
  })
}
