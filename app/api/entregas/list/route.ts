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
  const where = filters.length ? `where ${filters.join(' and ')}` : '';

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

  const rows = await prisma.$queryRawUnsafe<any[]>(sql, ...params);

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
