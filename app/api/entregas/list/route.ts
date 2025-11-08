export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Lista base para página de Entregas
 * - União: colaboradores manuais (epi_manual_colab) + Alterdata (stg_alterdata, com join opcional em stg_unid_reg)
 * - Exclusão de demitidos antes de 2025-01-01 (ou demissão nula aceita)
 * - Sem duplicidade por CPF: manual tem prioridade; Alterdata entra apenas se CPF não existir no manual
 * - Paginação real (page/pageSize)
 * - Campos: id(cpf), nome, funcao, unidade, regional, nome_site (agg de stg_epi_map)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const regional = searchParams.get('regional');
  const unidade  = searchParams.get('unidade');
  const q        = searchParams.get('q');
  const page     = Math.max(1, Number(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '25')));
  const offset   = (page - 1) * pageSize;

  // Descobre colunas em stg_alterdata e stg_unid_reg para tolerar variações
  const colsAD = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
    select column_name from information_schema.columns
    where table_schema = current_schema() and table_name = 'stg_alterdata'
  `);
  const colsUR = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
    select column_name from information_schema.columns
    where table_schema = current_schema() and table_name = 'stg_unid_reg'
  `);
  const namesAD = new Set((colsAD||[]).map(c => c.column_name.toLowerCase()));
  const namesUR = new Set((colsUR||[]).map(c => c.column_name.toLowerCase()));

  const pick = (s: Set<string>, cands: string[], fallback: string | null) => {
    for (const c of cands) { if (s.has(c)) return c; }
    return fallback;
  };

  const colCPF   = pick(namesAD, ['cpf','matricula','id','colaborador_id'], 'cpf')!;
  const colNome  = pick(namesAD, ['nome','colaborador','nome_completo'], 'nome')!;
  const colFunc  = pick(namesAD, ['funcao','função','cargo'], 'funcao')!;
  const colUnidA = pick(namesAD, ['unidade','unidade_hospitalar','lotacao','lotação','setor','departamento','hospital'], 'unidade')!;
  const colDem   = pick(namesAD, ['demissao','demissão','deslig','rescisao'], null);

  const colUnidR   = pick(namesUR, ['unidade','unidade_hospitalar','lotacao','lotação','setor','departamento','hospital'], null);
  const colRegional= pick(namesUR, ['regional','regiao','região'], null);

  const joinUR = (colUnidR && colRegional)
    ? `left join stg_unid_reg sur on lower(sur.${colUnidR}) = lower(sa.${colUnidA})`
    : `/* no stg_unid_reg join */`;
  const selectRegional = (colRegional)
    ? `coalesce(sur.${colRegional}, '')`
    : `''`;

  // --- Filtros para MANUAL (epi_manual_colab) ---
  const paramsManual: any[] = [];
  const filtersManual: string[] = [];
  if (regional) { paramsManual.push(regional); filtersManual.push(`lower(emc.regional) = lower($${paramsManual.length})`); }
  if (unidade)  { paramsManual.push(unidade);  filtersManual.push(`lower(emc.unidade)  = lower($${paramsManual.length})`); }
  if (q)        { paramsManual.push('%'+q+'%'); paramsManual.push('%'+q+'%'); filtersManual.push(`(emc.nome ilike $${paramsManual.length-1} or emc.cpf ilike $${paramsManual.length})`); }
  paramsManual.push('2025-01-01'); filtersManual.push(`(emc.demissao is null or emc.demissao >= $${paramsManual.length})`);
  const whereManual = filtersManual.length ? `where ${filtersManual.join(' and ')}` : '';

  // --- Filtros para ALTERDATA (stg_alterdata) ---
  const paramsAD: any[] = [];
  const filtersAD: string[] = [];
  if (regional && colRegional && colUnidR) { paramsAD.push(regional); filtersAD.push(`lower(sur.${colRegional}) = lower($${paramsAD.length})`); }
  if (unidade)  { paramsAD.push(unidade);  filtersAD.push(`lower(sa.${colUnidA})  = lower($${paramsAD.length})`); }
  if (q)        { paramsAD.push('%'+q+'%'); paramsAD.push('%'+q+'%'); filtersAD.push(`(sa.${colNome} ilike $${paramsAD.length-1} or sa.${colCPF} ilike $${paramsAD.length})`); }
  if (colDem)   { paramsAD.push('2025-01-01'); filtersAD.push(`(sa.${colDem} is null or sa.${colDem} >= $${paramsAD.length})`); }
  const whereAD = filtersAD.length ? `where ${filtersAD.join(' and ')}` : '';

  // --- Consulta paginada (UNION ALL) ---
  const rowsSQL = `
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
      ${whereManual}
      UNION ALL
      -- Alterdata sem CPFs já cadastrados manualmente
      select 
        sa.${colCPF} as id,
        sa.${colNome} as nome,
        sa.${colFunc} as funcao,
        sa.${colUnidA} as unidade,
        ${selectRegional} as regional,
        (
          select string_agg(distinct sem.nome_site, ',')
          from stg_epi_map sem
          where lower(sem.alterdata_funcao) = lower(sa.${colFunc})
        ) as nome_site
      from stg_alterdata sa
      ${joinUR}
      ${whereAD}
      and not exists (select 1 from epi_manual_colab em where em.cpf = sa.${colCPF})
    )
    select *
    from base
    order by nome asc
    limit ${pageSize} offset ${offset}
  `;
  const rows = await prisma.$queryRawUnsafe<any[]>(rowsSQL, ...paramsManual, ...paramsAD);

  // --- Contagem total ---
  const countSQL = `
    with base as (
      select emc.cpf as id
      from epi_manual_colab emc
      ${whereManual}
      UNION ALL
      select sa.${colCPF} as id
      from stg_alterdata sa
      ${joinUR}
      ${whereAD}
      and not exists (select 1 from epi_manual_colab em where em.cpf = sa.${colCPF})
    )
    select count(*)::int as c from base
  `;
  const cRow = await prisma.$queryRawUnsafe<any[]>(countSQL, ...paramsManual, ...paramsAD);
  const total = Number(cRow?.[0]?.c || 0);

  return NextResponse.json({
    rows: (rows || []).map((r:any) => ({
      id: String(r.id ?? ''),
      nome: String(r.nome ?? ''),
      funcao: String(r.funcao ?? ''),
      unidade: String(r.unidade ?? ''),
      regional: String(r.regional ?? ''),
      nome_site: r.nome_site ? String(r.nome_site) : null,
    })),
    total, page, pageSize,
  });
}