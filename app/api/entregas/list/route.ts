export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const regional = searchParams.get('regional');
  const unidade = searchParams.get('unidade');
  const q = searchParams.get('q');
  const page = Math.max(1, Number(searchParams.get('page') || '1'));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || '25')));
  const offset = (page - 1) * pageSize;

  // Base from stg_alterdata: nome, cpf, funcao, unidade
  const filters: string[] = [];
  const params: any[] = [];
  if (regional) {
    params.push(regional);
    filters.push(`lower(sur.regional) = lower($${params.length})`);
  }
  if (unidade) {
    params.push(unidade);
    filters.push(`lower(sa.unidade) = lower($${params.length})`);
  }
  if (q) {
    params.push(`%${q}%`);
    params.push(`%${q}%`);
    filters.push(`(sa.nome ilike $${params.length-1} or sa.cpf ilike $${params.length})`);
  }
  const where = filters.length ? `where ${filters.join(' and ')}` : '';

  const sql = `
    with base as (
      select sa.cpf as id, sa.nome, sa.funcao, sa.unidade, coalesce(sur.regional, '') as regional
      from stg_alterdata sa
      left join stg_unid_reg sur on lower(sur.unidade) = lower(sa.unidade)
      ${where}
      order by sa.nome asc
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

  // total
  const countSql = `
    select count(*)::int as c
    from stg_alterdata sa
    left join stg_unid_reg sur on lower(sur.unidade) = lower(sa.unidade)
    ${where}
  `;
  const [{ c: total }] = await prisma.$queryRawUnsafe<any[]>(countSql, ...params);

  return NextResponse.json({
    rows: rows.map(r => ({
      id: String(r.id),
      nome: String(r.nome),
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
