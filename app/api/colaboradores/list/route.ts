import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const url = process.env.DATABASE_URL
  if (!url) {
    return NextResponse.json({ ok: false, error: 'DATABASE_URL not configured' }, { status: 500 })
  }
  const sql = neon(url)

  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') || '').trim()
  const regional = (searchParams.get('regional') || '').trim()
  const unidade = (searchParams.get('unidade') || '').trim()
  const status = (searchParams.get('status') || '').trim() // 'ativo' | 'inativo' | ''
  const size = Math.min(Math.max(parseInt(searchParams.get('size') || '20'), 1), 100)
  const page = Math.max(parseInt(searchParams.get('page') || '1'), 1)
  const offset = (page - 1) * size

  // Build where clauses safely
  const where = []
  const params: any[] = []

  if (q) {
    where.push("(a.colaborador ILIKE $1 OR a.cpf ILIKE $1 OR a.funcao ILIKE $1 OR a.unidade_hospitalar ILIKE $1)")
    params.push(`%${q}%`)
  }
  if (regional) {
    where.push("COALESCE(ur.regional_responsavel,'') ILIKE $" + (params.length + 1))
    params.push(regional)
  }
  if (unidade) {
    where.push("a.unidade_hospitalar ILIKE $" + (params.length + 1))
    params.push(unidade)
  }
  if (status === 'ativo') {
    where.push("(a.demissao IS NULL)")
  } else if (status === 'inativo') {
    where.push("(a.demissao IS NOT NULL)")
  }

  const whereSQL = where.length ? ('WHERE ' + where.join(' AND ')) : ''

  // Total
  const totalQuery = `
    SELECT COUNT(1)::int AS total
    FROM stg_alterdata a
    LEFT JOIN stg_unid_reg ur
      ON UPPER(ur.nmdepartamento) = UPPER(a.unidade_hospitalar)
    ${whereSQL}
  `
  const totalRows = await sql(totalQuery, params)
  const total = totalRows?.[0]?.total ?? 0

  // Data page
  const dataQuery = `
    SELECT
      a.cpf AS matricula,
      a.colaborador AS nome,
      a.funcao,
      a.unidade_hospitalar AS unidade,
      COALESCE(ur.regional_responsavel,'') AS regional,
      CASE WHEN a.demissao IS NULL THEN 'ativo' ELSE 'inativo' END AS status
    FROM stg_alterdata a
    LEFT JOIN stg_unid_reg ur
      ON UPPER(ur.nmdepartamento) = UPPER(a.unidade_hospitalar)
    ${whereSQL}
    ORDER BY a.colaborador
    LIMIT ${size} OFFSET ${offset}
  `
  const rows = await sql(dataQuery, params)

  return NextResponse.json({
    ok: true,
    page,
    size,
    total,
    rows,
  })
}