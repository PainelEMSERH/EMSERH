import { NextRequest } from 'next/server'
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest){
  const { prisma } = await import('@/lib/db')
  const url = new URL(req.url)
  const regionalId = url.searchParams.get('regionalId')||''
  try{
    let hasUnid = false
    try{
      const u:any[] = await prisma.$queryRaw`SELECT COUNT(*)::int c FROM unidade`
      hasUnid = Number(u?.[0]?.c||0) > 0
    }catch{ hasUnid = false }
    if(hasUnid){
      if(regionalId){
        const unidades:any[] = await prisma.$queryRaw`SELECT id, nome FROM unidade WHERE regionalId = ${regionalId} ORDER BY nome`
        return Response.json({ ok:true, unidades })
      }else{
        const unidades:any[] = await prisma.$queryRaw`SELECT id, nome FROM unidade ORDER BY nome`
        return Response.json({ ok:true, unidades })
      }
    }
    // fallback stg_*
    let unidades:any[]
    if(regionalId){
      const rid = regionalId.replace(/'/g,"''")
      unidades = await prisma.$queryRawUnsafe(`
        SELECT md5(nmddepartamento) AS id, nmddepartamento AS nome
        FROM stg_unid_reg
        WHERE md5(COALESCE(regional_responsavel,'')) = '${rid}'
        GROUP BY nmddepartamento
        ORDER BY nmddepartamento
      `)
    }else{
      unidades = await prisma.$queryRawUnsafe(`
        SELECT md5(nmddepartamento) AS id, nmddepartamento AS nome
        FROM stg_unid_reg
        GROUP BY nmddepartamento
        ORDER BY nmddepartamento
      `)
    }
    return Response.json({ ok:true, unidades })
  }catch(e){
    console.error('[colaboradores/unidades] error', e)
    return Response.json({ ok:false, unidades:[] })
  }
}
