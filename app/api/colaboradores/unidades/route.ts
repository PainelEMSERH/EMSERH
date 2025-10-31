import { NextRequest } from 'next/server'
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'
export async function GET(req: NextRequest){
  const { prisma } = await import('@/lib/db')
  const url = new URL(req.url)
  const regionalId = url.searchParams.get('regionalId')||''
  try{
    // tenta normalizado
    try{
      const [uCnt]:any = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int c FROM unidade`)
      if(Number(uCnt?.c||0) > 0){
        const unidades = regionalId 
          ? await prisma.$queryRawUnsafe(`SELECT id, nome FROM unidade WHERE regionalId = $1 ORDER BY nome`, regionalId)
          : await prisma.$queryRawUnsafe(`SELECT id, nome FROM unidade ORDER BY nome`)
        return Response.json({ ok:true, unidades })
      }
    }catch{ /* fallback */ }

    // fallback stg_*
    let unidades:any[]
    if(regionalId){
      unidades = await prisma.$queryRawUnsafe(`
        SELECT md5(nmddepartamento) AS id, nmddepartamento AS nome
        FROM stg_unid_reg
        WHERE md5(COALESCE(regional_responsavel,'')) = $1
        GROUP BY nmddepartamento
        ORDER BY nmddepartamento
      `, regionalId)
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
