// file: app/api/estoque/options/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import unidRegMap from '@/data/unid_reg.json';


async function ensureStgUnidRegSeed() {
  try {
    // Verifica se a tabela stg_unid_reg existe
    const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `select table_name
         from information_schema.tables
        where table_schema = current_schema()
          and table_name = 'stg_unid_reg'`
    );
    const exists = (tables || []).some(t => (t.table_name || '').toLowerCase() === 'stg_unid_reg');

    if (!exists) {
      // Cria tabela mínima com colunas compatíveis com o fallback existente
      await prisma.$executeRawUnsafe(`
        create table if not exists stg_unid_reg (
          id bigserial primary key,
          regional text,
          unidade text
        )
      `);
    }

    // Verifica se já existe algum dado
    const cntRows = await prisma.$queryRawUnsafe<Array<{ count: any }>>(
      'select count(*) as count from stg_unid_reg'
    );
    const count = cntRows && cntRows[0] ? Number(cntRows[0].count) : 0;
    if (count > 0) return;

    // Seed inicial a partir do JSON local
    const entries = Object.entries(unidRegMap as Record<string, string>);
    if (!entries.length) return;

    for (const [unidade, regional] of entries) {
      const unidadeVal = (unidade || '').toString().trim();
      const regionalVal = (regional || '').toString().trim();
      if (!unidadeVal) continue;
      await prisma.$executeRawUnsafe(
        'insert into stg_unid_reg (regional, unidade) values ($1, $2)',
        regionalVal,
        unidadeVal
      );
    }
  } catch (e) {
    console.error('Erro ao garantir seed de stg_unid_reg', e);
  }
}


export async function GET() {
  try {
    await ensureStgUnidRegSeed();
    const regionais: string[] = [];
    const unidades: { unidade: string; regional: string }[] = [];

    // Verifica se tabelas normalizadas existem
    const tables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `select table_name
         from information_schema.tables
        where table_schema = current_schema()
          and table_name in ('regional','unidade','stg_unid_reg')`
    );
    const hasRegional = tables.some(t => t.table_name === 'regional');
    const hasUnidade  = tables.some(t => t.table_name === 'unidade');
    const hasStg      = tables.some(t => t.table_name === 'stg_unid_reg');

    // 1) Preferencial: usar tabelas normalizadas Regional/Unidade
    if (hasRegional && hasUnidade) {
      const rows = await prisma.$queryRawUnsafe<any[]>(`
        select r.nome as regional, u.nome as unidade
        from regional r
        join unidade u on u."regionalId" = r.id
        order by r.nome, u.nome
      `);
      const regSet = new Set<string>();
      for (const r of rows) {
        const regional = (r.regional ?? '').toString();
        const unidade  = (r.unidade ?? '').toString();
        if (regional) regSet.add(regional);
        if (unidade) unidades.push({ unidade, regional });
      }
      regionais.push(...Array.from(regSet.values()));
    } else if (hasStg) {
      // 2) Fallback: usar stg_unid_reg como em /api/entregas/options
      const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
        select column_name
          from information_schema.columns
         where table_schema = current_schema()
           and table_name = 'stg_unid_reg'
      `);
      const names = new Set((cols || []).map(c => c.column_name.toLowerCase()));

      const pick = (cands: string[]) => cands.find(c => names.has(c));

      const colRegional =
        pick(['regional', 'nome_regional', 'regiao']) ||
        pick(['regional_nome', 'regiao_nome']);
      const colUnidade =
        pick(['unidade', 'nome_unidade', 'unidade_hospitalar']) ||
        pick(['unidade_nome']);

      if (colRegional && colUnidade) {
        const rows = await prisma.$queryRawUnsafe<any[]>(
          `select distinct ${colRegional} as regional, ${colUnidade} as unidade from stg_unid_reg`
        );
        const regSet = new Set<string>();
        for (const r of rows) {
          const regional = (r.regional ?? '').toString();
          const unidade  = (r.unidade ?? '').toString();
          if (regional) regSet.add(regional);
          if (unidade) unidades.push({ unidade, regional });
        }
        regionais.push(...Array.from(regSet.values()));
      } else if (colUnidade) {
        const rows = await prisma.$queryRawUnsafe<any[]>(
          `select distinct ${colUnidade} as unidade from stg_unid_reg`
        );
        unidades.push(
          ...rows.map(r => ({
            unidade: (r.unidade ?? '').toString(),
            regional: '',
          })),
        );
      }
    }

    return NextResponse.json({ regionais, unidades });
  } catch (e: any) {
    console.error('Erro em /api/estoque/options', e);
    return NextResponse.json({ regionais: [], unidades: [], error: e?.message ?? 'Erro interno' });
  }
}
