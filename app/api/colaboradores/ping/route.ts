export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'
export async function GET(){
  const { prisma } = await import('@/lib/db')
  try{
    const [c, a, ur]:any = await Promise.all([
      prisma.$queryRaw`SELECT COUNT(*)::int AS c FROM colaborador`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS c FROM stg_alterdata`,
      prisma.$queryRaw`SELECT COUNT(*)::int AS c FROM stg_unid_reg`,
    ])
    return Response.json({ ok:true, counts: { colaborador: c?.[0]?.c||0, stg_alterdata: a?.[0]?.c||0, stg_unid_reg: ur?.[0]?.c||0 } })
  }catch(e:any){
    return Response.json({ ok:false, error: String(e?.message||e) }, { status:200 })
  }
}
