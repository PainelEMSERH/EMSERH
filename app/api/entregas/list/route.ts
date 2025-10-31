import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q') || null
    const regional = searchParams.get('regional') || null
    const unidade = searchParams.get('unidade') || null
    const status = searchParams.get('status') || null // 'pendente' | 'entregue' | null
    const year = parseInt(searchParams.get('ano') || '') || (new Date()).getFullYear()
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(200, Math.max(10, parseInt(searchParams.get('perPage') || '100')))
    const offset = (page - 1) * perPage

    const today = new Date()

    const rows:any[] = await prisma.$queryRawUnsafe(`
      WITH base AS (
        SELECT
          a.cpf::text AS cpf,
          a.colaborador::text AS nome,
          a.funcao::text AS funcao,
          a.unidade_hospitalar::text AS unidade,
          COALESCE(ur.regional::text, '—') AS regional
        FROM stg_alterdata a
        LEFT JOIN stg_unid_reg ur ON UPPER(ur.unidade) = UPPER(a.unidade_hospitalar)
        WHERE a.admissao <= $1::date
          AND (a.demissao IS NULL OR a.demissao >= $1::date)
      ),
      mapa AS (
        SELECT UPPER(funcao)::text AS funcao, item::text, COALESCE(qtd,1)::int AS qtd
        FROM stg_epi_map
      ),
      expand AS (
        SELECT
          b.cpf,b.nome,b.funcao,b.regional,b.unidade,
          m.item, m.qtd
        FROM base b
        LEFT JOIN mapa m ON UPPER(b.funcao) = m.funcao
      ),
      marc AS (
        SELECT
          e.cpf, e.item, true AS entregue
        FROM entrega_epi e
        WHERE e.ano = $2::int
      )
      SELECT
        x.cpf, x.nome, x.funcao, x.regional, x.unidade,
        x.item, x.qtd,
        COALESCE(m.entregue, false) AS entregue,
        (x.item IS NULL) AS sem_kit
      FROM expand x
      LEFT JOIN marc m ON m.cpf = x.cpf AND m.item = x.item
      WHERE
        ($3::text IS NULL OR x.regional = $3::text)
        AND ($4::text IS NULL OR x.unidade = $4::text)
        AND ($5::text IS NULL OR x.nome ILIKE '%'||$5||'%' OR x.cpf ILIKE '%'||$5||'%' OR x.funcao ILIKE '%'||$5||'%' OR x.unidade ILIKE '%'||$5||'%')
        AND (
          $6::text IS NULL
          OR ($6='pendente' AND COALESCE(m.entregue,false) = false)
          OR ($6='entregue' AND COALESCE(m.entregue,false) = true)
        )
      ORDER BY x.nome ASC, x.item NULLS LAST
      LIMIT $7 OFFSET $8
    `, today, year, regional, unidade, q, status, perPage, offset)

    const totalArr:any[] = await prisma.$queryRawUnsafe(`
      WITH base AS (
        SELECT
          a.cpf::text AS cpf,
          a.colaborador::text AS nome,
          a.funcao::text AS funcao,
          a.unidade_hospitalar::text AS unidade,
          COALESCE(ur.regional::text, '—') AS regional
        FROM stg_alterdata a
        LEFT JOIN stg_unid_reg ur ON UPPER(ur.unidade) = UPPER(a.unidade_hospitalar)
        WHERE a.admissao <= $1::date
          AND (a.demissao IS NULL OR a.demissao >= $1::date)
      ),
      mapa AS (
        SELECT UPPER(funcao)::text AS funcao, item::text, COALESCE(qtd,1)::int AS qtd
        FROM stg_epi_map
      ),
      expand AS (
        SELECT b.cpf,b.nome,b.funcao,b.regional,b.unidade,m.item,m.qtd FROM base b LEFT JOIN mapa m ON UPPER(b.funcao)=m.funcao
      ),
      marc AS (
        SELECT e.cpf,e.item,true AS entregue FROM entrega_epi e WHERE e.ano=$2::int
      )
      SELECT COUNT(*)::int AS c
      FROM expand x LEFT JOIN marc m ON m.cpf=x.cpf AND m.item=x.item
      WHERE
        ($3::text IS NULL OR x.regional = $3::text)
        AND ($4::text IS NULL OR x.unidade = $4::text)
        AND ($5::text IS NULL OR x.nome ILIKE '%'||$5||'%' OR x.cpf ILIKE '%'||$5||'%' OR x.funcao ILIKE '%'||$5||'%' OR x.unidade ILIKE '%'||$5||'%')
        AND (
          $6::text IS NULL
          OR ($6='pendente' AND COALESCE(m.entregue,false) = false)
          OR ($6='entregue' AND COALESCE(m.entregue,false) = true)
        )
    `, today, year, regional, unidade, q, status)
    const total = totalArr && totalArr[0] ? totalArr[0].c : 0

    return NextResponse.json({ ok:true, rows, total })
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: String(e?.message || e) }, { status: 500 })
  }
}
