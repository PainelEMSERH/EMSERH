import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { cpf, item, ano } = body || {}
    if (!cpf || !item || !ano) {
      return NextResponse.json({ ok:false, error:'cpf, item e ano são obrigatórios' }, { status: 400 })
    }
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS entrega_epi (
        id BIGSERIAL PRIMARY KEY,
        cpf TEXT NOT NULL,
        item TEXT NOT NULL,
        ano INT NOT NULL,
        entregue_em TIMESTAMP NOT NULL DEFAULT now(),
        UNIQUE (cpf, item, ano)
      )`)
    await prisma.$executeRawUnsafe(
      `INSERT INTO entrega_epi (cpf,item,ano) VALUES ($1,$2,$3)
       ON CONFLICT (cpf,item,ano) DO UPDATE SET entregue_em = now()`,
      cpf, item, ano
    )
    return NextResponse.json({ ok:true })
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: String(e?.message || e) }, { status: 500 })
  }
}
