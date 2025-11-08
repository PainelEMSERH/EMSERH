
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Lista de colaboradores para página Entregas
 * Regras:
 *  - União: epi_manual_colab (prioridade) ∪ fonte principal (mv_alterdata_flat OU stg_alterdata)
 *  - Filtro: excluir demitidos < 2025-01-01; aceita 'YYYY-MM-DD' e 'DD/MM/YYYY'
 *  - Regional: se MV tiver coluna 'regional', filtra direto; senão usa subconsulta em stg_unid_reg
 *  - Unidade: compara por lower(trim())
 *  - Paginação e busca (nome/CPF)
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const regional = searchParams.get('regional');
  const unidade  = searchParams.get('unidade');
  const q        = searchParams.get('q');
  const page     = Math.max(1, Number(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '25')));
  const offset   = (page - 1) * pageSize;

  // Detectar MV
  const mvCheck = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `select exists(select 1 from pg_matviews where schemaname = current_schema() and matviewname = 'mv_alterdata_flat') as exists`
  );
  const useMV = !!mvCheck?.[0]?.exists;
  const srcName = useMV ? 'mv_alterdata_flat' : 'stg_alterdata';

  // Descobrir colunas
  const colsSrc = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `select column_name from information_schema.columns where table_schema = current_schema() and table_name = '${srcName}'`
  );
  const colsUR  = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
    `select column_name from information_schema.columns where table_schema = current_schema() and table_name = 'stg_unid_reg'`
  );
  const namesSrc = new Set((colsSrc||[]).map(c => c.column_name.toLowerCase()));
  const namesUR  = new Set((colsUR||[]).map(c => c.column_name.toLowerCase()));

  const pick = (s: Set<string>, cands: string[], fallback: string | null) => {
    for (const c of cands) { if (s.has(c)) return c; }
    return fallback;
  };

  const colCPF   = pick(namesSrc, ['cpf','matricula','id','colaborador_id','cpf_colaborador'], 'cpf')!;
  const colNome  = pick(namesSrc, ['nome','colaborador','nome_completo','nome_colaborador'], 'nome')!;
  const colFunc  = pick(namesSrc, ['funcao','função','cargo','nome_funcao'], 'funcao')!;
  const colUnidA = pick(namesSrc, ['unidade','unidade_hospitalar','lotacao','lotação','setor','departamento','hospital','unidade_lotacao'], 'unidade')!;
  const colDem   = pick(namesSrc, ['demissao','demissão','deslig','rescisao','data_demissao'], null);

  const colUnidR     = pick(namesUR, ['unidade','unidade_hospitalar','lotacao','lotação','setor','departamento','hospital'], null);
  const colRegionalR = pick(namesUR, ['regional','regiao','região'], null);
  const colRegionalMV= pick(namesSrc, ['regional','regiao','região'], null);

  // Filtros MANUAL
  const paramsM: any[] = [];
  let whereM = 'where true';
  if (regional) { paramsM.push(regional); whereM += ` and lower(trim(emc.regional)) = lower(trim($${paramsM.length}))`; }
  if (unidade)  { paramsM.push(unidade);  whereM += ` and lower(trim(emc.unidade))  = lower(trim($${paramsM.length}))`; }
  if (q)        { paramsM.push('%'+q+'%'); paramsM.push('%'+q+'%'); whereM += ` and (emc.nome ilike $${paramsM.length-1} or emc.cpf ilike $${paramsM.length})`; }
  paramsM.push('2025-01-01'); whereM += ` and (emc.demissao is null or emc.demissao >= $${paramsM.length}::date)`;

  // Filtros FONTE
  const paramsA: any[] = [];
  let whereA = 'where true';
  // Regional
  if (regional) {
    if (useMV && colRegionalMV) {
      paramsA.push(regional);
      whereA += ` and lower(trim(sa.${colRegionalMV})) = lower(trim($${paramsA.length}))`;
    } else if (!useMV && colUnidR && colRegionalR) {
      // usa subconsulta EXISTS em stg_unid_reg para casar regional
      paramsA.push(regional);
      whereA += ` and exists (
        select 1 from stg_unid_reg sur
        where lower(trim(sur.${colUnidR})) = lower(trim(sa.${colUnidA}))
          and lower(trim(sur.${colRegionalR})) = lower(trim($${paramsA.length}))
      )`;
    }
  }
  // Unidade
  if (unidade)  { paramsA.push(unidade); whereA += ` and lower(trim(sa.${colUnidA})) = lower(trim($${paramsA.length}))`; }
  // Busca
  if (q)        { paramsA.push('%'+q+'%'); paramsA.push('%'+q+'%'); whereA += ` and (sa.${colNome} ilike $${paramsA.length-1} or sa.${colCPF} ilike $${paramsA.length})`; }
  // Demissão
  if (colDem)   { 
    paramsA.push('2025-01-01');
    const demExpr = `CASE 
      WHEN sa.${colDem} ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN sa.${colDem}::date
      WHEN sa.${colDem} ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(sa.${colDem}, 'DD/MM/YYYY')
      ELSE NULL
    END`;
    whereA += ` and ( ${demExpr} is null or ${demExpr} >= $${paramsA.length}::date )`;
  }

  const srcFrom = `${srcName} sa`;

  // Consulta de linhas
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
      ${whereM}
      UNION ALL
      -- Fonte principal, removendo CPFs já manuais
      select 
        sa.${colCPF} as id,
        sa.${colNome} as nome,
        sa.${colFunc} as funcao,
        sa.${colUnidA} as unidade,
        ${
          useMV && colRegionalMV
            ? `coalesce(sa.${colRegionalMV}, '')`
            : (colUnidR && colRegionalR
                ? `(select coalesce(sur.${colRegionalR}, '') from stg_unid_reg sur where lower(trim(sur.${colUnidR})) = lower(trim(sa.${colUnidA})) limit 1)`
                : `''`)
        } as regional,
        (
          select string_agg(distinct sem.nome_site, ',')
          from stg_epi_map sem
          where lower(sem.alterdata_funcao) = lower(sa.${colFunc})
        ) as nome_site
      from ${srcFrom}
      ${whereA}
      and not exists (select 1 from epi_manual_colab em where em.cpf = sa.${colCPF})
    )
    select *
    from base
    order by nome asc
    limit ${pageSize} offset ${offset}
  `;
  const rows = await prisma.$queryRawUnsafe<any[]>(rowsSQL, ...paramsM, ...paramsA);

  // Contagem
  const countSQL = `
    with base as (
      select emc.cpf as id
      from epi_manual_colab emc
      ${whereM}
      UNION ALL
      select sa.${colCPF} as id
      from ${srcFrom}
      ${whereA}
      and not exists (select 1 from epi_manual_colab em where em.cpf = sa.${colCPF})
    )
    select count(*)::int as c from base
  `;
  const cRow = await prisma.$queryRawUnsafe<any[]>(countSQL, ...paramsM, ...paramsA);
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
    total, page, pageSize, src: srcName, usedMV: useMV,
  });
}
