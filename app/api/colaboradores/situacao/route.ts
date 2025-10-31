import { NextRequest } from 'next/server'
import { ensureAuxTables } from '../_utils'
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest){
  const { prisma } = await import('@/lib/db')
  await ensureAuxTables(prisma)
  try{
    const { colaboradorId, tipo, inicio, fim } = await req.json()
    if(!colaboradorId || !tipo || !inicio){
      return Response.json({ ok:false, error:'Dados inválidos' })
    }
    await prisma.$executeRawUnsafe(
      `INSERT INTO colaborador_situacao (colaboradorId, tipo, inicio, fim) VALUES ($1,$2,$3,$4)`,
      colaboradorId, tipo, inicio, fim||null
    )
    return Response.json({ ok:true })
  }catch(e:any){
    console.error('[colaboradores/situacao] error', e)
    return Response.json({ ok:false, error:'fail' }, { status:200 })
  }
}
