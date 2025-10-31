import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const today = new Date()
    const y = today.getFullYear()
    // ensure table entrega_epi exists
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS entrega_epi (
        id BIGSERIAL PRIMARY KEY,
        cpf TEXT NOT NULL,
        item TEXT NOT NULL,
        ano INT NOT NULL,
        entregue_em TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE (cpf, item, ano)
      )`)

    const [q1] = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS c FROM stg_alterdata`)
    const [q2] = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS c FROM stg_unid_reg`)
    const [q3] = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS c FROM stg_epi_map`)
    const [ativos] = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::int AS c
      FROM stg_alterdata a
      WHERE a.admissao <= $1::date
        AND (a.demissao IS NULL OR a.demissao >= $1::date)
    `, today)

    const [funcoesTot] = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(DISTINCT funcao)::int AS c FROM stg_alterdata`)
    const [funcoesKit] = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(DISTINCT UPPER(funcao))::int AS c FROM stg_epi_map`)

    const coverage = funcoesTot.c ? Math.round(100 * funcoesKit.c / funcoesTot.c) : 0

    return NextResponse.json({
      ok: true,
      counts: {
        stg_alterdata: q1.c,
        stg_unid_reg: q2.c,
        stg_epi_map: q3.c,
        ativos: ativos.c,
        funcoes_distintas: funcoesTot.c,
        funcoes_com_kit: funcoesKit.c,
        cobertura_funcoes_pct: coverage,
      },
      year: y
    })
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: String(e?.message || e) }, { status: 500 })
  }
}
