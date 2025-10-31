import { NextRequest } from 'next/server'
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest){
  const { prisma } = await import('@/lib/db')
  const url = new URL(req.url)
  const regionalId = url.searchParams.get('regionalId')||''
  try{
    const unidades = regionalId 
      ? await prisma.$queryRawUnsafe(`SELECT id, nome FROM unidade WHERE regionalId = $1 ORDER BY nome`, regionalId)
      : await prisma.$queryRawUnsafe(`SELECT id, nome FROM unidade ORDER BY nome`)
    return Response.json({ ok:true, unidades })
  }catch(e){
    return Response.json({ ok:false, unidades:[] })
  }
}
