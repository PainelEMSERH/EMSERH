export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { UNID_TO_REGIONAL, canonUnidade, REGIONALS } from '@/lib/unidReg';

type UnidadeRow = { unidade: string; regional: string };

export async function GET() {
  try {
    let regionais: string[] = [];
    let unidades: UnidadeRow[] = [];

    // 1) Tenta usar tabela stg_unid_reg se existir
    try {
      const cols = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(`
        select column_name
        from information_schema.columns
        where table_schema = current_schema()
          and table_name = 'stg_unid_reg'
      `);
      const names = new Set((cols || []).map(c => c.column_name.toLowerCase()));
      const pick = (cands: string[]) => cands.find(c => names.has(c));

      const uniCol = pick(['unidade','unid','setor','hospital','posto','unidade_hospitalar']);
      const regCol = pick(['regional','regiao','gerencia','polo']);

      if (uniCol && regCol) {
        const rows = await prisma.$queryRawUnsafe<Array<{ unidade: string; regional: string }>>(
          `select distinct ${uniCol} as unidade, ${regCol} as regional from stg_unid_reg where ${uniCol} is not null`
        );
        unidades = rows
          .map(r => ({
            unidade: (r.unidade ?? '').toString(),
            regional: (r.regional ?? '').toString(),
          }))
          .filter(r => r.unidade);
      }
    } catch {
      // ignora, cai para os fallbacks abaixo
    }

    // 2) Fallback: deriva unidades direto da base Alterdata
    if (!unidades.length) {
      try {
        const rows = await prisma.$queryRawUnsafe<Array<{ unidade: string }>>(
          `select distinct unidade from stg_alterdata_v2 where unidade is not null`
        );
        unidades = rows
          .map(r => ({ unidade: (r.unidade ?? '').toString(), regional: '' }))
          .filter(r => r.unidade);
      } catch {
        const rows = await prisma.$queryRawUnsafe<Array<{ unidade: string }>>(
          `select distinct unidade from stg_alterdata where unidade is not null`
        );
        unidades = rows
          .map(r => ({ unidade: (r.unidade ?? '').toString(), regional: '' }))
          .filter(r => r.unidade);
      }
    }

    // 3) Normaliza regionais a partir das unidades + mapa UNID_TO_REGIONAL
    const regSet = new Set<string>();
    const normUnidades: UnidadeRow[] = [];

    for (const u of unidades) {
      const unidade = (u.unidade ?? '').toString();
      let reg = (u.regional ?? '').toString().trim();

      if (!reg) {
        const canon = canonUnidade(unidade);
        const mapped = (UNID_TO_REGIONAL as any)[canon] || '';
        if (mapped) {
          reg = mapped;
        }
      }

      if (reg) {
        const up = reg.toUpperCase();
        if ((REGIONALS as readonly string[]).includes(up)) {
          reg = up.charAt(0) + up.slice(1).toLowerCase(); // "SUL" -> "Sul"
        }
        regSet.add(reg);
      }

      if (unidade) {
        normUnidades.push({ unidade, regional: reg });
      }
    }

    regionais = Array.from(regSet);
    if (!regionais.length) {
      // fallback absoluto
      regionais = ['Norte','Sul','Leste','Central'];
    }

    // Ordena resultados
    regionais.sort((a,b) => a.localeCompare(b));
    normUnidades.sort((a,b) => a.unidade.localeCompare(b.unidade));

    return NextResponse.json({ regionais, unidades: normUnidades });
  } catch (e:any) {
    const regionais = ['Norte','Sul','Leste','Central'];
    const unidades: UnidadeRow[] = [];
    return NextResponse.json({ regionais, unidades });
  }
}
