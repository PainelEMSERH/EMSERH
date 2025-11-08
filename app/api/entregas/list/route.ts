
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { UNID_TO_REGIONAL, canonUnidade } from '@/lib/unidReg';

type OutRow = {
  matricula: string;
  nome: string;
  funcao: string;
  unidade: string;
  regional: string;
  admissao: string | null;
  demissao: string | null;
};

function maskDateISOtoBR(s: any): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const dd = String(d.getUTCDate()).padStart(2,'0');
  const mm = String(d.getUTCMonth()+1).padStart(2,'0');
  const yyyy = d.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}
function normUp(v: any){ return String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim(); }

async function chooseTable(): Promise<string> {
  const rs: any[] = await prisma.$queryRawUnsafe(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN ('stg_alterdata_v2_compat','stg_alterdata_v2')
  `);
  const names = rs.map(r => String(r.table_name));
  if (names.includes('stg_alterdata_v2_compat')) return 'stg_alterdata_v2_compat';
  if (names.includes('stg_alterdata_v2')) return 'stg_alterdata_v2';
  return 'stg_alterdata_v2_compat';
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q        = url.searchParams.get('q') || '';
  const regional = url.searchParams.get('regional') || '';
  const unidade  = url.searchParams.get('unidade') || '';
  const page     = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
  const pageSize = Math.min(200, Math.max(10, parseInt(url.searchParams.get('pageSize') || '25', 10)));

  const tname = await chooseTable();

  const whereParts: string[] = [];
  const params: any[] = [];
  let idx = 1;

  if (q) {
    whereParts.push(`(a.nome ILIKE $${idx} OR a.matricula::text ILIKE $${idx})`);
    params.push(`%${q}%`);
    idx++;
  }
  if (unidade) {
    whereParts.push(`upper(a.unidade) = upper($${idx})`);
    params.push(unidade);
    idx++;
  }
  const whereSQL = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const regSQL = regional ? ` AND upper(ur.regional) = upper($${idx})` : '';
  if (regional) params.push(regional);

  // Count
  const countRows: any[] = await prisma.$queryRawUnsafe(
    `SELECT COUNT(*)::int AS c
     FROM ${tname} a
     LEFT JOIN stg_unid_reg ur ON upper(ur.unidade)=upper(a.unidade)
     ${whereSQL}${regSQL}`,
    ...params
  );
  const total: number = countRows?.[0]?.c ?? 0;

  const offset = (page - 1) * pageSize;

  // Page
  const pageRows: any[] = await prisma.$queryRawUnsafe(
    `SELECT 
        a.matricula::text as matricula,
        a.nome::text      as nome,
        a.funcao::text    as funcao,
        a.unidade::text   as unidade,
        ur.regional::text as regional,
        a.admissao        as admissao,
        a.demissao        as demissao
     FROM ${tname} a
     LEFT JOIN stg_unid_reg ur ON upper(ur.unidade)=upper(a.unidade)
     ${whereSQL}${regSQL}
     ORDER BY a.nome
     LIMIT $${idx+1} OFFSET $${idx+2}`,
    ...params,
    pageSize,
    offset
  );

  // Fill regional via lib map if needed + format dates
  const rows: OutRow[] = pageRows.map(r => {
    const uni = String(r.unidade || '');
    let regionalOut = String(r.regional || '');
    if (!regionalOut) {
      const canon = canonUnidade(uni);
      regionalOut = (UNID_TO_REGIONAL as any)[canon] || '—';
    }
    return {
      matricula: String(r.matricula || ''),
      nome: String(r.nome || ''),
      funcao: String(r.funcao || ''),
      unidade: uni,
      regional: regionalOut,
      admissao: maskDateISOtoBR(r.admissao),
      demissao: maskDateISOtoBR(r.demissao),
    };
  });

  const res = NextResponse.json(
    { rows, total, page, pageSize, source: 'db-paginated' },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=86400' } }
  );
  return res;
}
