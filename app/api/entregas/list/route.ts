export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Lista para página de Entregas
 * - Fonte dinâmica: usa `mv_alterdata_flat` se existir; senão `stg_alterdata` (+ join em stg_unid_reg)
 * - União: epi_manual_colab (prioridade) ∪ Alterdata
 * - Filtro: excluir demitidos com data < 2025-01-01 (aceita DD/MM/YYYY ou YYYY-MM-DD)
 * - Paginação + busca + filtros por Regional/Unidade
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const regional = searchParams.get('regional');
  const unidade  = searchParams.get('unidade');
  const q        = searchParams.get('q');
  const page     = Math.max(1, Number(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '25')));
  const offset   = (page - 1) * pageSize;

  // Descobrir fonte preferencial (MV -> STAGING)
  const mvExists = await prisma.$queryRawUnsafe<Array<{ exists: boolean }>>(
    `select exists(select 1 from pg_matviews where schemaname = current_schema() and matviewname = 'mv_alterdata_flat') as exists`
  );
  const useMV = !!mvExists?.[0]?.exists;

  // Descobrir colunas da fonte escolhida + unid_reg
  const srcName = useMV ? 'mv_alterdata_flat' : 'stg_alterdata';
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

  const colCPF   = pick(namesSrc, ['cpf','matricula','id','colaborador_id'], 'cpf')!;
  const colNome  = pick(namesSrc, ['nome','colaborador','nome_completo'], 'nome')!;
  const colFunc  = pick(namesSrc, ['funcao','função','cargo'], 'funcao')!;
  const colUnidA = pick(namesSrc, ['unidade','unidade_hospitalar','lotacao','lotação','setor','departamento','hospital'], 'unidade')!;
  const colDem   = pick(namesSrc, ['demissao','demissão','deslig','rescisao'], null);

  // Quando usando MV, quase sempre já existe 'regional' direto
  const colRegionalMV = pick(namesSrc, ['regional','regiao','região'], null);
  const colUnidR   = pick(namesUR, ['unidade','unidade_hospitalar','lotacao','lotação','setor','departamento','hospital'], null);
  const colRegionalUR= pick(namesUR, ['regional','regiao','região'], null);

  const joinUR = (!useMV && colUnidR && colRegionalUR)
    ? `left join stg_unid_reg sur on lower(trim(sur.${colUnidR})) = lower(trim(sa.${colUnidA}))`
    : ``;

  const selectRegional = useMV
    ? (colRegionalMV ? `coalesce(sa.${colRegionalMV}, '')` : `''`)
    : (colRegionalUR ? `coalesce(sur.${colRegionalUR}, '')` : `''`);

  // Normalizador de data (DD/MM/YYYY ou YYYY-MM-DD) para comparar com 2025-01-01
  const demExpr = colDem ? `CASE 
      WHEN sa.${colDem} ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN sa.${colDem}::date
      WHEN sa.${colDem} ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(sa.${colDem}, 'DD/MM/YYYY')
      ELSE NULL
    END` : null;

  // ---------- Filtros MANUAL ----------
  const paramsManual: any[] = [];
  let whereManual = 'where true';
  if (regional) { paramsManual.push(regional); whereManual += ` and lower(emc.regional) = lower($${paramsManual.length})`; }
  if (unidade)  { paramsManual.push(unidade);  whereManual += ` and lower(emc.unidade)  = lower($${paramsManual.length})`; }
  if (q)        { paramsManual.push('%'+q+'%'); paramsManual.push('%'+q+'%'); whereManual += ` and (emc.nome ilike $${paramsManual.length-1} or emc.cpf ilike $${paramsManual.length})`; }
  paramsManual.push('2025-01-01'); whereManual += ` and (emc.demissao is null or emc.demissao >= $${paramsManual.length}::date)`;

  // ---------- Filtros ALTERDATA/MV ----------
  const paramsAD: any[] = [];
  let whereAD = 'where true';
  if (regional) {
    if (useMV && colRegionalMV) {
      paramsAD.push(regional); whereAD += ` and lower(sa.${colRegionalMV}) = lower($${paramsAD.length})`;
    } else if (!useMV && colRegionalUR && colUnidR) {
      paramsAD.push(regional); whereAD += ` and lower(sur.${colRegionalUR}) = lower($${paramsAD.length})`;
    }
  }
  if (unidade)  { paramsAD.push(unidade);  whereAD += ` and lower(sa.${colUnidA})  = lower($${paramsAD.length})`; }
  if (q)        { paramsAD.push('%'+q+'%'); paramsAD.push('%'+q+'%'); whereAD += ` and (sa.${colNome} ilike $${paramsAD.length-1} or sa.${colCPF} ilike $${paramsAD.length})`; }
  if (demExpr)  { paramsAD.push('2025-01-01'); whereAD += ` and ( ${demExpr} is null or ${demExpr} >= $${paramsAD.length}::date )`; }

  const srcFrom = useMV ? 'mv_alterdata_flat sa' : 'stg_alterdata sa';

  // ---------- Rows ----------
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
      -- Fonte principal (MV ou STAGING), removendo CPFs já manuais
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
      from ${srcFrom}
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

  // ---------- Count ----------
  const countSQL = `
    with base as (
      select emc.cpf as id
      from epi_manual_colab emc
      ${whereManual}
      UNION ALL
      select sa.${colCPF} as id
      from ${srcFrom}
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
    total, page, pageSize, src: srcName, usedMV: useMV,
  });
}