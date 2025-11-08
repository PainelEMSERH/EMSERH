
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const regional = searchParams.get('regional');
  const unidade  = searchParams.get('unidade');
  const q        = searchParams.get('q');
  const page     = Math.max(1, Number(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '25')));
  const offset   = (page - 1) * pageSize;

  const mv = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `select exists(select 1 from pg_matviews where schemaname = current_schema() and matviewname = 'mv_alterdata_flat') as exists`
  );
  const useMV = !!mv?.[0]?.exists;
  const srcName = useMV ? 'mv_alterdata_flat' : 'stg_alterdata';

  const colsSrc = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `select column_name from information_schema.columns where table_schema = current_schema() and table_name = '${srcName}'`
  );
  const names = new Set((colsSrc||[]).map(c => c.column_name.toLowerCase()));
  const pick = (cands: string[], deflt: string|null) => {
    for (const c of cands) if (names.has(c)) return c;
    return deflt;
  };

  const colCPF   = pick(['cpf','matricula','id','colaborador_id','cpf_colaborador'], 'cpf')!;
  const colNome  = pick(['nome','colaborador','nome_completo','nome_colaborador'], 'nome')!;
  const colFunc  = pick(['funcao','função','cargo','nome_funcao'], 'funcao')!;
  const colUnid  = pick(['unidade','unidade_hospitalar','lotacao','lotação','setor','departamento','hospital','unidade_lotacao'], 'unidade')!;
  const colDem   = pick(['demissao','demissão','deslig','rescisao','data_demissao'], null);
  const colRegMV = pick(['regional','regiao','região'], null);

  const srcCTE = `
    with fonte as (
      select 
        sa.${colCPF}::text as id,
        coalesce(sa.${colNome}::text,'') as nome,
        coalesce(sa.${colFunc}::text,'') as funcao,
        coalesce(sa.${colUnid}::text,'') as unidade,
        ${
          colRegMV
            ? `coalesce(sa.${colRegMV}::text,'')`
            : `(select coalesce(sur.regional::text, '')
                 from stg_unid_reg sur
                 where 
                   lower(trim(sur.unidade)) = lower(trim(sa.${colUnid})) or
                   lower(trim(sur.unidade)) like '%' || lower(trim(sa.${colUnid})) || '%' or
                   lower(trim(sa.${colUnid})) like '%' || lower(trim(sur.unidade)) || '%'
                 order by case when lower(trim(sur.unidade)) = lower(trim(sa.${colUnid})) then 0 else 1 end
                 limit 1)`
        } as regional,
        (
          select string_agg(distinct sem.nome_site, ',')
          from stg_epi_map sem
          where lower(sem.alterdata_funcao) = lower(sa.${colFunc}::text)
        ) as nome_site,
        ${
          colDem 
            ? "CASE WHEN sa."+colDem+" ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN sa."+colDem+"::date WHEN sa."+colDem+" ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(sa."+colDem+"::text, 'DD/MM/YYYY') ELSE NULL END" 
            : "NULL"
        } as dem_data
      from ${srcName} sa
    )
  `;

  const baseSQL = `
    ${srcCTE}
    , base as (
      select emc.cpf::text as id,
             coalesce(emc.nome::text,'') as nome,
             coalesce(emc.funcao::text,'') as funcao,
             coalesce(emc.unidade::text,'') as unidade,
             coalesce(emc.regional::text,'') as regional,
             (
               select string_agg(distinct sem.nome_site, ',')
               from stg_epi_map sem
               where lower(sem.alterdata_funcao) = lower(emc.funcao::text)
             ) as nome_site
      from epi_manual_colab emc
      where (emc.demissao is null or emc.demissao >= '2025-01-01'::date)
      UNION ALL
      select f.id, f.nome, f.funcao, f.unidade, coalesce(f.regional,'') as regional, f.nome_site
      from fonte f
      where (f.dem_data is null or f.dem_data >= '2025-01-01'::date)
        and not exists (select 1 from epi_manual_colab em where em.cpf::text = f.id)
    )
    select * from base
    where ($1::text is null or $1::text = '' or lower(trim(regional)) = lower(trim($1::text)))
      and ($2::text is null or $2::text = '' or lower(trim(unidade))  = lower(trim($2::text)))
      and ($3::text is null or $3::text = '' or (nome ilike $3 or id ilike $3))
    order by nome asc
    limit $4::int offset $5::int
  `;
  const likeQ = q ? `%${q}%` : '';
  const rows = await prisma.$queryRawUnsafe<any[]>(baseSQL, regional, unidade, likeQ, pageSize, offset);

  const countSQL = `
    ${srcCTE}
    , base as (
      select emc.cpf::text as id,
             coalesce(emc.nome::text,'') as nome,
             coalesce(emc.funcao::text,'') as funcao,
             coalesce(emc.unidade::text,'') as unidade,
             coalesce(emc.regional::text,'') as regional
      from epi_manual_colab emc
      where (emc.demissao is null or emc.demissao >= '2025-01-01'::date)
      UNION ALL
      select f.id, f.nome, f.funcao, f.unidade, coalesce(f.regional,'') as regional
      from fonte f
      where (f.dem_data is null or f.dem_data >= '2025-01-01'::date)
        and not exists (select 1 from epi_manual_colab em where em.cpf::text = f.id)
    )
    select count(*)::int as c
    from base
    where ($1::text is null or $1::text = '' or lower(trim(regional)) = lower(trim($1::text)))
      and ($2::text is null or $2::text = '' or lower(trim(unidade))  = lower(trim($2::text)))
      and ($3::text is null or $3::text = '' or (nome ilike $3 or id ilike $3))
  `;
  const cnt = await prisma.$queryRawUnsafe<any[]>(countSQL, regional, unidade, likeQ);
  const total = Number(cnt?.[0]?.c || 0);

  return NextResponse.json({
    rows: (rows || []).map((r:any) => ({
      id: String(r.id ?? ''),
      nome: String(r.nome ?? ''),
      funcao: String(r.funcao ?? ''),
      unidade: String(r.unidade ?? ''),
      regional: String(r.regional ?? ''),
      nome_site: r.nome_site ? String(r.nome_site) : null,
    })),
    total, page, pageSize, src: srcName, usedMV: useMV,
  });
}
