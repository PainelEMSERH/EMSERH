import { NextRequest } from 'next/server'
import { ensureAuxTables } from '../_utils'
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest){
  const { prisma } = await import('@/lib/db')
  await ensureAuxTables(prisma)
  try{
    const { colaboradorId, status, data } = await req.json()
    if(!colaboradorId || !status) return Response.json({ ok:false, error:'Dados inválidos' })
    await prisma.$executeRawUnsafe(`UPDATE colaborador SET status = $1 WHERE id = $2`, status, colaboradorId)
    if(status === 'inativo'){
      await prisma.$executeRawUnsafe(
        `INSERT INTO colaborador_situacao (colaboradorId, tipo, inicio) VALUES ($1,'desligado',$2)`,
        colaboradorId, data || new Date().toISOString().substring(0,10)
      )
    }
    return Response.json({ ok:true })
  }catch(e:any){
    console.error('[colaboradores/status] error', e)
    return Response.json({ ok:false, error:'fail' }, { status:200 })
  }
}
