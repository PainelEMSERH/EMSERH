export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * This route now adapts to column names:
 * stg_alterdata: cpf|matricula, nome|colaborador, funcao|cargo, unidade|unidade_hospitalar
 * stg_unid_reg : regional|regiao, unidade|unidade_hospitalar
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const regional = searchParams.get('regional');
  const unidade = searchParams.get('unidade');
  const q = searchParams.get('q');
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '25')));
  const offset = (page - 1) * pageSize;

  // Discover stg_alterdata columns
  const colsAD = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
    select column_name
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'stg_alterdata'
  `);
  const namesAD = new Set((colsAD || []).map(c => c.column_name.toLowerCase()));
  const pickAD = (cands: string[], fallback: string) => {
    for (const c of cands) if (namesAD.has(c)) return c;
    return fallback;
  };
  const colCPF   = pickAD(['cpf','matricula','id','colaborador_id'], 'cpf');
  const colNome  = pickAD(['nome','colaborador','nome_completo'], 'nome');
  const colFunc  = pickAD(['funcao','função','cargo'], 'funcao');
  const colUnidA = pickAD(['unidade','unidade_hospitalar','lotacao','lotação','setor','departamento','hospital'], 'unidade');
  const colDem   = pickAD(['demissao','demissão','deslig','rescisao'], null);
  const colFunc  = pickAD(['funcao','cargo','funcao_alterdata'], 'funcao');
  const colUnidA = pickAD(['unidade','unidade_hospitalar','setor'], 'unidade');

  // Discover stg_unid_reg columns
  const colsUR = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
    select column_name
    from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'stg_unid_reg'
  `);
  const namesUR = new Set((colsUR || []).map(c => c.column_name.toLowerCase()));
  const pickUR = (cands: string[], fallback: string | null = null) => {
    for (const c of cands) if (namesUR.has(c)) return c;
    return fallback;
  };
  const colRegional = pickUR(['regional','regiao','regional_nome','regiao_nome','nome_regional']);
  const colUnidR    = pickUR(['unidade','unidade_hospitalar','setor']);

  // Assemble WHERE filters
  const filters: string[] = [];
  const params: any[] = [];
  if (regional && colRegional) {
    params.push(regional);
    filters.push(`lower(sur.${colRegional}) = lower($${params.length})`);
  }
  if (unidade) {
    params.push(unidade);
    filters.push(`lower(sa.${colUnidA}) = lower($${params.length})`);
  }
  if (q) {
    params.push(`%${q}%`);
    params.push(`%${q}%`);
    filters.push(`(sa.${colNome} ilike $${params.length-1} or sa.${colCPF} ilike $${params.length})`);
  }
  if (colDem) { filters.push(`(sa.${colDem} is null or sa.${colDem} >= $${(lambda n: n)(0)}`);

  // Build LEFT JOIN only if we have a unit column in stg_unid_reg
  const joinUR = colUnidR
    ? `left join stg_unid_reg sur on lower(sur.${colUnidR}) = lower(sa.${colUnidA})`
    : `/* no stg_unid_reg join */`;

  const selectRegional = colRegional ? `coalesce(sur.${colRegional}, '')` : `''`;

  const sql = `
    with base as (
      select sa.${colCPF} as id, sa.${colNome} as nome, sa.${colFunc} as funcao, sa.${colUnidA} as unidade,
             ${selectRegional} as regional
      from stg_alterdata sa
      ${joinUR}
      ${where}
      order by sa.${colNome} asc
      limit ${pageSize} offset ${offset}
    )
    select b.*, (
      select string_agg(distinct sem.nome_site, ',')
      from stg_epi_map sem
      where lower(sem.alterdata_funcao) = lower(b.funcao)
    ) as nome_site
    from base b
  `;

  
  // Build union source: manual first (overrides), then alterdata excluding CPFs present in manual
  const demFilterDate = '2025-01-01';
  const whereManual = [];
  const paramsManual: any[] = [];
  if (regional) { paramsManual.push(regional); whereManual.push(`(lower(emc.regional) = lower($${paramsManual.length}))`); }
  if (unidade)  { paramsManual.push(unidade);  whereManual.push(`(lower(emc.unidade)  = lower($${paramsManual.length}))`); }
  if (q)        { paramsManual.push('%'+q+'%'); paramsManual.push('%'+q+'%'); whereManual.push(`(emc.nome ilike $${paramsManual.length-1} or emc.cpf ilike $${paramsManual.length})`); }
  paramsManual.push(demFilterDate); whereManual.push(`(emc.demissao is null or emc.demissao >= $${paramsManual.length})`);
  const whereManualSQL = whereManual.length ? `where ${whereManual.join(' and ')}` : '';

  // Construct Alterdata where using existing filters/params
  // We already have 'filters', 'params', 'where', 'joinUR', 'selectRegional' built above.
  // Ensure demissão filter is present for Alterdata (was added earlier).

  const baseSQL = `
    with base as (
      -- Manual
      select 
        emc.cpf as id,
        coalesce(emc.nome,'') as nome,
        coalesce(emc.funcao,'') as funcao,
        coalesce(emc.unidade,'') as unidade,
        coalesce(emc.regional,'') as regional,
        (
          select string_agg(distinct sem.nome_site, ',')
          from stg_epi_map sem
          where lower(sem.alterdata_funcao) = lower(emc.funcao)
        ) as nome_site
      from epi_manual_colab emc
      ${whereManualSQL}
      UNION ALL
      -- Alterdata minus duplicates present in manual
      select sa.${colCPF} as id, sa.${colNome} as nome, sa.${colFunc} as funcao, sa.${colUnidA} as unidade,
        ${selectRegional} as regional,
        (
          select string_agg(distinct sem.nome_site, ',')
          from stg_epi_map sem
          where lower(sem.alterdata_funcao) = lower(sa.${colFunc})
        ) as nome_site
      from stg_alterdata sa
      ${joinUR}
      ${where}
      and not exists (select 1 from epi_manual_colab em where em.cpf = sa.${colCPF})
    )
    select *
    from base
    order by nome asc
    limit ${pageSize} offset ${offset}
  `;
  const rows = await prisma.$queryRawUnsafe<any[]>(baseSQL, ...paramsManual, ...params);

  const countSql = `
    select count(*)::int as c
    from stg_alterdata sa
    ${joinUR}
    ${where}
  `;
  const [{ c: total }] = await prisma.$queryRawUnsafe<any[]>(countSql, ...params);

  return NextResponse.json({
    rows: rows.map(r => ({
      id: String(r.id ?? ''),
      nome: String(r.nome ?? ''),
      funcao: String(r.funcao ?? ''),
      unidade: String(r.unidade ?? ''),
      regional: String(r.regional ?? ''),
      nome_site: r.nome_site ? String(r.nome_site) : null,
    })),
    total,
    page,
    pageSize,
  });
}
