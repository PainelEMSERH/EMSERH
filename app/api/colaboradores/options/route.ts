export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'
export async function GET(){
  const { prisma } = await import('@/lib/db')
  try{
    const [regionais, funcoes] = await Promise.all([
      prisma.$queryRawUnsafe(`SELECT id, nome FROM regional ORDER BY nome`),
      prisma.$queryRawUnsafe(`SELECT id, nome FROM funcao ORDER BY nome`),
    ])
    return Response.json({ ok:true, regionais, funcoes })
  }catch(e){
    return Response.json({ ok:false, regionais:[], funcoes:[] })
  }
}
