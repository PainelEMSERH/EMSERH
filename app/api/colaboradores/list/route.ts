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
    // Verifica se a base normalizada tem dados
    let hasNormalized = false
    try {
      const cnt:any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM colaborador`)
      hasNormalized = Number(cnt?.[0]?.c || 0) > 0
    } catch { hasNormalized = false }

    if(hasNormalized){
      const whereParts:string[] = []
      const params:any[] = []
      if(q){ whereParts.push(`(c.nome ILIKE '%'||$${params.length+1}||'%' OR c.matricula ILIKE '%'||$${params.length+1}||'%')`); params.push(q) }
      if(status){ whereParts.push(`c.status = $${params.length+1}`); params.push(status) }
      if(unidadeId){ whereParts.push(`c.unidadeId = $${params.length+1}`); params.push(unidadeId) }
      if(regionalId){ whereParts.push(`u.regionalId = $${params.length+1}`); params.push(regionalId) }
      const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''

      const base = `
        FROM colaborador c
        JOIN funcao f   ON f.id = c.funcaoId
        JOIN unidade u  ON u.id = c.unidadeId
        JOIN regional r ON r.id = u.regionalId
        ${where}
      `
      const rows:any[] = await prisma.$queryRawUnsafe(`
        SELECT c.id, c.nome, c.matricula, c.email, c.telefone, c.status,
               f.id as funcaoId, f.nome as funcao,
               u.id as unidadeId, u.nome as unidade,
               r.id as regionalId, r.nome as regional
        ${base}
        ORDER BY c.nome
        LIMIT ${size} OFFSET ${offset}
      `, ...params)

      const totalArr:any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as c ${base}`, ...params)
      const total = Number(totalArr?.[0]?.c || 0)
      return Response.json({ ok: true, page, size, total, rows })
    }

    // Fallback para as tabelas de staging (stg_*)
    const whereParts:string[] = []
    const params:any[] = []

    // q: nome (colaborador) ou cpf
    if(q){
      whereParts.push(`(a.colaborador ILIKE '%'||$${params.length+1}||'%' OR a.cpf ILIKE '%'||$${params.length+1}||'%')`)
      params.push(q)
    }
    if(status){
      if(status === 'ativo'){
        whereParts.push(`(a.demissao IS NULL OR a.demissao > NOW()::date)`)
      }else if(status === 'inativo'){
        whereParts.push(`(a.demissao IS NOT NULL AND a.demissao <= NOW()::date)`)
      }
    }
    if(unidadeId){
      whereParts.push(`md5(COALESCE(ur.nmddepartamento, a.unidade_hospitalar)) = $${params.length+1}`)
      params.push(unidadeId)
    }
    if(regionalId){
      whereParts.push(`md5(COALESCE(ur.regional_responsavel, '')) = $${params.length+1}`)
      params.push(regionalId)
    }
    const where = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : ''

    const base = `
      FROM stg_alterdata a
      LEFT JOIN stg_unid_reg ur ON ur.nmddepartamento = a.unidade_hospitalar
      ${where}
    `

    const rows:any[] = await prisma.$queryRawUnsafe(`
      SELECT 
        a.cpf as id,
        a.colaborador as nome,
        a.cpf as matricula,
        NULL::text as email,
        NULL::text as telefone,
        CASE WHEN a.demissao IS NULL OR a.demissao > NOW()::date THEN 'ativo' ELSE 'inativo' END as status,
        md5(COALESCE(a.funcao,'')) as "funcaoId",
        a.funcao as funcao,
        md5(COALESCE(a.unidade_hospitalar,'')) as "unidadeId",
        COALESCE(a.unidade_hospitalar,'') as unidade,
        md5(COALESCE(ur.regional_responsavel,'')) as "regionalId",
        COALESCE(ur.regional_responsavel,'') as regional
      ${base}
      ORDER BY a.colaborador
      LIMIT ${size} OFFSET ${offset}
    `, ...params)

    const totalArr:any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as c ${base}`, ...params)
    const total = Number(totalArr?.[0]?.c || 0)

    return Response.json({ ok:true, page, size, total, rows })
  }catch(e:any){
    console.error('[colaboradores/list] error', e)
    return new Response(JSON.stringify({ ok:false, error:'fail' }), { status:200, headers:{'content-type':'application/json'} })
  }
}
