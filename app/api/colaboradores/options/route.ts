export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const revalidate = 0;
export async function GET(){
  const { prisma } = await import('@/lib/db')
  try{
    let hasReg = false
    try{
      const r:any[] = await prisma.$queryRaw`SELECT COUNT(*)::int c FROM regional`
      hasReg = Number(r?.[0]?.c||0) > 0
    }catch{ hasReg = false }
    if(hasReg){
      const [regionais, funcoes] = await Promise.all([
        prisma.$queryRaw`SELECT id, nome FROM regional ORDER BY nome`,
        prisma.$queryRaw`SELECT id, nome FROM funcao ORDER BY nome`,
      ])
      return Response.json({ ok:true, regionais, funcoes })
    }
    const regionais:any[] = await prisma.$queryRawUnsafe(`
      SELECT md5(regional_responsavel) AS id, regional_responsavel AS nome
      FROM stg_unid_reg
      WHERE regional_responsavel IS NOT NULL AND regional_responsavel <> ''
      GROUP BY regional_responsavel
      ORDER BY regional_responsavel
    `)
    const funcoes:any[] = await prisma.$queryRawUnsafe(`
      SELECT md5(funcao) AS id, funcao AS nome
      FROM stg_alterdata
      WHERE funcao IS NOT NULL AND funcao <> ''
      GROUP BY funcao
      ORDER BY funcao
    `)
    return Response.json({ ok:true, regionais, funcoes })
  }catch(e){
    console.error('[colaboradores/options] error', e)
    return Response.json({ ok:false, regionais:[], funcoes:[] })
  }
}
