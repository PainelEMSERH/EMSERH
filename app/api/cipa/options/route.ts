import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { normalizeCipaUnidade } from '@/lib/cipa/unidades';

/**
 * Opções para filtros da página CIPA: regionais e unidades a partir de cronograma_cipa.
 */
export async function GET() {
  try {
    const hasTable: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'cronograma_cipa'
      ) AS exists
    `);
    if (!hasTable?.[0]?.exists) {
      return NextResponse.json({ ok: true, regionais: [], unidades: [] });
    }

    const regionaisResult: any[] = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT UPPER(COALESCE(TRIM(regional), '')) AS regional
      FROM cronograma_cipa
      WHERE COALESCE(TRIM(regional), '') != ''
      ORDER BY regional
    `);
    const regionais = regionaisResult.map((r) => String(r?.regional ?? '').trim()).filter(Boolean);

    const unidadesResult: any[] = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT UPPER(COALESCE(TRIM(regional), '')) AS regional, COALESCE(TRIM(unidade), '') AS unidade
      FROM cronograma_cipa
      WHERE COALESCE(TRIM(unidade), '') != ''
      ORDER BY regional, unidade
    `);

    const unidadesMap = new Map<string, { regional: string; unidade: string }>();
    for (const r of unidadesResult) {
      const regional = String(r?.regional ?? '').trim();
      const rawUnidade = String(r?.unidade ?? '').trim();
      if (!rawUnidade) continue;
      const unidade = normalizeCipaUnidade(rawUnidade);
      const key = `${regional}|${unidade}`;
      if (!unidadesMap.has(key)) {
        unidadesMap.set(key, { regional, unidade });
      }
    }

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
