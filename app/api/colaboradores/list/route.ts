import { NextRequest } from 'next/server'
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest){
  const { prisma } = await import('@/lib/db')
  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim() || ''
  const regionalId = url.searchParams.get('regionalId') || ''
  const unidadeId = url.searchParams.get('unidadeId') || ''
  const status = url.searchParams.get('status') || ''
  const page = Math.max(1, parseInt(url.searchParams.get('page')||'1'))
  const size = Math.min(100, Math.max(10, parseInt(url.searchParams.get('size')||'20')))
  const offset = (page-1)*size

  try{
    // Detecta se a base normalizada tem dados
    let hasNormalized = false
    try{
      const cnt:any[] = await prisma.$queryRaw`SELECT COUNT(*)::int AS c FROM colaborador`
      hasNormalized = Number(cnt?.[0]?.c || 0) > 0
    }catch{ hasNormalized = false }

    if(hasNormalized){
      // MONTA WHERE com template tag seguro
      const where: string[] = []
      const params: any[] = []
      if(q){ where.push(`(c.nome ILIKE ${'%' + q + '%'} OR c.matricula ILIKE ${'%' + q + '%'})`); }
      if(status){ where.push(`c.status = ${status}`) }
      if(unidadeId){ where.push(`c.unidadeId = ${unidadeId}`) }
      if(regionalId){ where.push(`u.regionalId = ${regionalId}`) }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : ''

      const rows:any[] = await prisma.$queryRawUnsafe(`
        SELECT c.id, c.nome, c.matricula, c.email, c.telefone, c.status,
               f.id as funcaoId, f.nome as funcao,
               u.id as unidadeId, u.nome as unidade,
               r.id as regionalId, r.nome as regional
        FROM colaborador c
        JOIN funcao f   ON f.id = c.funcaoId
        JOIN unidade u  ON u.id = c.unidadeId
        JOIN regional r ON r.id = u.regionalId
        ${whereSql}
        ORDER BY c.nome
        LIMIT ${size} OFFSET ${offset}
      `)
      const totalArr:any[] = await prisma.$queryRawUnsafe(`
        SELECT COUNT(*)::int as c
        FROM colaborador c
        JOIN funcao f   ON f.id = c.funcaoId
        JOIN unidade u  ON u.id = c.unidadeId
        JOIN regional r ON r.id = u.regionalId
        ${whereSql}
      `)
      const total = Number(totalArr?.[0]?.c || 0)
      return Response.json({ ok:true, page, size, total, rows })
    }

    // FALLBACK — STG TABLES (sem parâmetros posicionais)
    const whereStg: string[] = []
    if(q){
      const like = `%${q.replace(/'/g,"''")}%`
      whereStg.push(`(a.colaborador ILIKE '${like}' OR a.cpf ILIKE '${like}')`)
    }
    if(status){
      if(status === 'ativo'){
        whereStg.push(`(a.demissao IS NULL OR a.demissao > NOW()::date)`)
      }else if(status === 'inativo'){
        whereStg.push(`(a.demissao IS NOT NULL AND a.demissao <= NOW()::date)`)
      }
    }
    if(unidadeId){
      whereStg.push(`md5(COALESCE(ur.nmddepartamento, a.unidade_hospitalar)) = '${unidadeId.replace(/'/g,"''")}'`)
    }
    if(regionalId){
      whereStg.push(`md5(COALESCE(ur.regional_responsavel, '')) = '${regionalId.replace(/'/g,"''")}'`)
    }
    const whereSqlStg = whereStg.length ? `WHERE ${whereStg.join(' AND ')}` : ''

    const rows:any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        a.cpf as id,
        a.colaborador as nome,
        a.cpf as matricula,
        NULL::text as email,
        NULL::text as telefone,
        CASE WHEN a.demissao IS NULL OR a.demissao > NOW()::date THEN 'ativo' ELSE 'inativo' END as status,
        md5(COALESCE(a.funcao,'')) as "funcaoId",
        COALESCE(a.funcao,'') as funcao,
        md5(COALESCE(a.unidade_hospitalar,'')) as "unidadeId",
        COALESCE(a.unidade_hospitalar,'') as unidade,
        md5(COALESCE(ur.regional_responsavel,'')) as "regionalId",
        COALESCE(ur.regional_responsavel,'') as regional
      FROM stg_alterdata a
      LEFT JOIN stg_unid_reg ur ON ur.nmddepartamento = a.unidade_hospitalar
      ${whereSqlStg}
      ORDER BY a.colaborador
      LIMIT ${size} OFFSET ${offset}
    `)
    const totalArr:any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int as c
      FROM stg_alterdata a
      LEFT JOIN stg_unid_reg ur ON ur.nmddepartamento = a.unidade_hospitalar
      ${whereSqlStg}
    `)
    const total = Number(totalArr?.[0]?.c || 0)
    return Response.json({ ok:true, page, size, total, rows })
  }catch(e:any){
    console.error('[colaboradores/list] error', e)
    return Response.json({ ok:false, error:String(e?.message||e) }, { status:200 })
  }
}
