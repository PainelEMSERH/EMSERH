import { NextRequest } from 'next/server'
import { ensureAuxTables } from '../_utils'
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest){
  const { prisma } = await import('@/lib/db')
  await ensureAuxTables(prisma)
  try{
    const { colaboradorId, novaUnidadeId } = await req.json()
    if(!colaboradorId || !novaUnidadeId) return Response.json({ ok:false, error:'Dados inválidos' })

    await prisma.$executeRawUnsafe(
      `UPDATE colaborador_vinculo SET fim = NOW() WHERE colaboradorId = $1 AND fim IS NULL`,
      colaboradorId
    )
    await prisma.$executeRawUnsafe(
      `INSERT INTO colaborador_vinculo (colaboradorId, unidadeId, inicio) VALUES ($1, $2, NOW())`,
      colaboradorId, novaUnidadeId
    )
    await prisma.$executeRawUnsafe(
      `UPDATE colaborador SET unidadeId = $1 WHERE id = $2`,
      novaUnidadeId, colaboradorId
    )

    return Response.json({ ok:true })
  }catch(e:any){
    console.error('[colaboradores/move] error', e)
    return Response.json({ ok:false, error:'fail' }, { status:200 })
  }
}
