import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { compute2026From2025 } from '@/lib/cipa/compute-2026';
import { processCipaRows } from '@/lib/cipa/process-rows';
import {
  CE_CIDADE_OPERARIA,
  UPA_POLI_CIDADE_OPERARIA,
  resolveCipaUnidade,
} from '@/lib/cipa/unidades';

/**
 * Opções para filtros da página CIPA: regionais e unidades.
 * Combina banco + cronograma calculado 2026 + unidades fixas (CE / UPA+Poli).
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const ano = parseInt(url.searchParams.get('ano') || '2026', 10);
    const regionalFilter = (url.searchParams.get('regional') || '').trim().toUpperCase();

    const regionaisSet = new Set<string>();
    const unidadesMap = new Map<string, { regional: string; unidade: string }>();

    const addUnit = (regional: string, rawUnidade: string) => {
      const reg = String(regional ?? '').trim().toUpperCase();
      const uni = resolveCipaUnidade(rawUnidade);
      if (!reg || !uni) return;
      if (regionalFilter && reg !== regionalFilter) return;
      regionaisSet.add(reg);
      unidadesMap.set(`${reg}|${uni}`, { regional: reg, unidade: uni });
    };

    const hasTable: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'cronograma_cipa'
      ) AS exists
    `);

    if (hasTable?.[0]?.exists) {
      const regionaisResult: any[] = await prisma.$queryRawUnsafe(`
        SELECT DISTINCT UPPER(COALESCE(TRIM(regional), '')) AS regional
        FROM cronograma_cipa
        WHERE COALESCE(TRIM(regional), '') != ''
        ORDER BY regional
      `);
      for (const r of regionaisResult) {
        const reg = String(r?.regional ?? '').trim().toUpperCase();
        if (reg) regionaisSet.add(reg);
      }

      const anosSql = ano === 2026 ? '2025, 2026' : String(ano);
      const unidadesResult: any[] = await prisma.$queryRawUnsafe(`
        SELECT DISTINCT UPPER(COALESCE(TRIM(regional), '')) AS regional,
               COALESCE(TRIM(unidade), '') AS unidade
        FROM cronograma_cipa
        WHERE COALESCE(TRIM(unidade), '') != ''
          AND ano_gestao IN (${anosSql})
        ORDER BY regional, unidade
      `);
      for (const r of unidadesResult) {
        addUnit(String(r?.regional ?? ''), String(r?.unidade ?? ''));
      }

      if (ano === 2026) {
        const computed = processCipaRows(await compute2026From2025(prisma, regionalFilter, ''));
        for (const row of computed) {
          addUnit(row.regional, row.unidade);
        }
      }
    }

    // Unidades fixas Cidade Operária (sempre no filtro da Norte)
    addUnit('NORTE', CE_CIDADE_OPERARIA);
    addUnit('NORTE', UPA_POLI_CIDADE_OPERARIA);
    addUnit('NORTE', 'HOSPITAL DE PAULINO NEVES');

    const regionais = [...regionaisSet].sort((a, b) => a.localeCompare(b));
    const unidades = [...unidadesMap.values()].sort((a, b) => {
      if (a.regional !== b.regional) return a.regional.localeCompare(b.regional);
      return a.unidade.localeCompare(b.unidade);
    });

    return NextResponse.json({ ok: true, regionais, unidades });
  } catch (e: any) {
    console.error('[cipa/options] error', e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
