export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'
export async function GET(){
  const { prisma } = await import('@/lib/db')
  try{
    // tenta normalizado
    try{
      const [rCnt]:any = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int c FROM regional`)
      if(Number(rCnt?.c||0) > 0){
        const [regionais, funcoes] = await Promise.all([
          prisma.$queryRawUnsafe(`SELECT id, nome FROM regional ORDER BY nome`),
          prisma.$queryRawUnsafe(`SELECT id, nome FROM funcao ORDER BY nome`),
        ])
        return Response.json({ ok:true, regionais, funcoes })
      }
    }catch{ /* fallback */ }

    // fallback stg_*
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
