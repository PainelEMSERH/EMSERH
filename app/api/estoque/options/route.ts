// file: app/api/estoque/options/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { REGIONALS, UNID_TO_REGIONAL } from '@/lib/unidReg';

/**
 * GET /api/estoque/options
 * Retorna lista de Regionais e Unidades hospitalares vinculadas.
 * Fonte: mapeamento estático em lib/unidReg.ts (gerado a partir de data/unid_reg.csv).
 */
export async function GET() {
  const regionais = REGIONALS;

  const unidades = Object.entries(UNID_TO_REGIONAL).map(([unidade, regional]) => ({
    unidade,
    regional,
  }));

  // Ordena unidades pelo nome apenas para ficar mais amigável no select
  unidades.sort((a, b) => a.unidade.localeCompare(b.unidade, 'pt-BR'));

  return NextResponse.json({ regionais, unidades });
}
