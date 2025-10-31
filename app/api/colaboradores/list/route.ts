import { NextRequest } from 'next/server'
export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'; export const revalidate = 0;

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
    // 1) Usa base normalizada se existir
    let hasNormalized = false
    try{
      const cnt:any[] = await prisma.$queryRaw`SELECT COUNT(*)::int AS c FROM colaborador`
      hasNormalized = Number(cnt?.[0]?.c || 0) > 0
    }catch{ hasNormalized = false }

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
               f.id as "funcaoId", f.nome as funcao,
               u.id as "unidadeId", u.nome as unidade,
               r.id as "regionalId", r.nome as regional
        ${base}
        ORDER BY c.nome
        LIMIT ${size} OFFSET ${offset}
      `, ...params)
      const totalArr:any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as c ${base}`, ...params)
      const total = Number(totalArr?.[0]?.c || 0)
      return Response.json({ ok:true, page, size, total, rows })
    }

    // 2) Fallback — STG TABLES (primeira tentativa com subselect de regional)
    const esc = (s:string)=> s.replace(/'/g, "''")
    const w:string[] = []
    if(q){ const like = `%${esc(q)}%`; w.push(`(a.colaborador ILIKE '${like}' OR a.cpf ILIKE '${like}')`) }
    if(status === 'ativo'){ w.push(`(a.demissao IS NULL OR a.demissao > NOW()::date)`) }
    if(status === 'inativo'){ w.push(`(a.demissao IS NOT NULL AND a.demissao <= NOW()::date)`) }
    if(unidadeId){ w.push(`md5(COALESCE(a.unidade_hospitalar,'')) = '${esc(unidadeId)}'`) }
    // regionalId: tenta mapear via stg_unid_reg (se coluna disponível)
    if(regionalId){
      w.push(`md5(COALESCE((SELECT ur.regional_responsavel FROM stg_unid_reg ur 
                             WHERE /* tentar ambas as possibilidades de nome */ 
                                   COALESCE(ur.nmddepartamento, ur.nmd_departamento) = a.unidade_hospitalar 
                             LIMIT 1),'')) = '${esc(regionalId)}'`)
    }
    const whereSql = w.length ? `WHERE ${w.join(' AND ')}` : ''

    const withRegional = `
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
        md5(COALESCE((SELECT ur.regional_responsavel FROM stg_unid_reg ur 
                      WHERE COALESCE(ur.nmddepartamento, ur.nmd_departamento) = a.unidade_hospitalar 
                      LIMIT 1),'')) as "regionalId",
        COALESCE((SELECT ur.regional_responsavel FROM stg_unid_reg ur 
                  WHERE COALESCE(ur.nmddepartamento, ur.nmd_departamento) = a.unidade_hospitalar 
                  LIMIT 1),'') as regional
      FROM stg_alterdata a
      ${whereSql}
      ORDER BY a.colaborador
      LIMIT ${size} OFFSET ${offset}
    `

    try{
      const rows:any[] = await prisma.$queryRawUnsafe(withRegional)
      const totalArr:any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM stg_alterdata a ${whereSql}`)
      const total = Number(totalArr?.[0]?.c || 0)
      return Response.json({ ok:true, page, size, total, rows })
    }catch(e){
      // 3) Fallback final — sem regional (garante que lista funcione)
      const w2 = w.filter(x => !x.includes('regional_responsavel'))
      const whereSql2 = w2.length ? `WHERE ${w2.join(' AND ')}` : ''
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
          NULL::text as "regionalId",
          NULL::text as regional
        FROM stg_alterdata a
        ${whereSql2}
        ORDER BY a.colaborador
        LIMIT ${size} OFFSET ${offset}
      `)
      const totalArr:any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS c FROM stg_alterdata a ${whereSql2}`)
      const total = Number(totalArr?.[0]?.c || 0)
      return Response.json({ ok:true, page, size, total, rows })
    }
  }catch(e:any){
    console.error('[colaboradores/list] error', e)
    return Response.json({ ok:false, error:String(e?.message||e) }, { status:200 })
  }
}
