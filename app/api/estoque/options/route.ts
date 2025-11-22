export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import unidRegMap from '@/data/unid_reg.json';

type Unidade = { unidade: string; regional: string };

export async function GET() {
  try {
    const raw = unidRegMap as Record<string, string>;
    const unidades: Unidade[] = Object.entries(raw).map(([unidade, regional]) => ({
      unidade,
      regional,
    }));
    const regionais = Array.from(
      new Set(unidades.map((u) => (u.regional || '').toString()).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));

    unidades.sort((a, b) => a.unidade.localeCompare(b.unidade));

    return NextResponse.json({ regionais, unidades });
  } catch (e: any) {
    console.error('Erro em /api/estoque/options (fallback unid_reg)', e);
    return NextResponse.json({ regionais: [], unidades: [] });
  }
}
