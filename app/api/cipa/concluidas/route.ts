import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computeCipasConcluidas } from '@/lib/cipa/concluidas';
import { loadCipaCronogramaRows } from '@/lib/cipa/load-cronograma-rows';

/**
 * Lista unidades com CIPA 100% concluída (todas as atividades com data de conclusão).
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const regional = (url.searchParams.get('regional') || '').trim();
    const ano = parseInt(url.searchParams.get('ano') || '2025', 10);

    const { rows, computed } = await loadCipaCronogramaRows(prisma, regional, ano);
    const resultado = computeCipasConcluidas(rows);

    return NextResponse.json({
      ok: true,
      regional: regional ? regional.toUpperCase() : null,
      ano,
      computed,
      ...resultado,
    });
  } catch (e: unknown) {
    console.error('[cipa/concluidas] error', e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
