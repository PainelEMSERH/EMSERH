import { NextRequest } from 'next/server'
import { ensureAuxTables } from '../_utils'
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest){
  const { prisma } = await import('@/lib/db')
  try{
    const body = await req.json()
    const { nome, matricula, funcaoId, unidadeId, email, telefone } = body
    if(!nome || !matricula || !funcaoId || !unidadeId){
      return Response.json({ ok:false, error:'Campos obrigatórios ausentes' }, { status:200 })
    }
    const c = await prisma.colaborador.create({
      data: { nome, matricula, funcaoId, unidadeId, email: email||null, telefone: telefone||null, status: 'ativo' }
    })
    await ensureAuxTables(prisma)
    await prisma.$executeRawUnsafe(
      `INSERT INTO colaborador_vinculo (colaboradorId, unidadeId, inicio) VALUES ($1,$2,NOW())`,
      c.id, unidadeId
    )
    return Response.json({ ok:true, id: c.id })
  }catch(e:any){
    console.error('[colaboradores/create] error', e)
    return Response.json({ ok:false, error:'fail' }, { status:200 })
  }
}
