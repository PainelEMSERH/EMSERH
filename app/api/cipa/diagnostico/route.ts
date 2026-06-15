import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { computeDiagnosticoMes } from '@/lib/cipa/diagnostico';
import { loadCipaCronogramaRows } from '@/lib/cipa/load-cronograma-rows';

const MESES_LABEL: Record<string, string> = {
  '01': 'Janeiro',
  '02': 'Fevereiro',
  '03': 'Março',
  '04': 'Abril',
  '05': 'Maio',
  '06': 'Junho',
  '07': 'Julho',
  '08': 'Agosto',
  '09': 'Setembro',
  '10': 'Outubro',
  '11': 'Novembro',
  '12': 'Dezembro',
};

/**
 * Diagnóstico mensal: atividades com fim previsto no mês — executadas ou pendentes.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const regional = (url.searchParams.get('regional') || '').trim();
    const ano = parseInt(url.searchParams.get('ano') || '2025', 10);
    const mes = (url.searchParams.get('mes') || '').trim().padStart(2, '0');

    if (!regional) {
      return NextResponse.json({ ok: false, error: 'Informe a regional' }, { status: 400 });
    }
    if (!/^(0[1-9]|1[0-2])$/.test(mes)) {
      return NextResponse.json({ ok: false, error: 'Mês inválido (use 01 a 12)' }, { status: 400 });
    }

    const { rows, computed } = await loadCipaCronogramaRows(prisma, regional, ano);
    const resultado = computeDiagnosticoMes(rows, ano, mes);

    return NextResponse.json({
      ok: true,
      regional: regional.toUpperCase(),
      ano,
      mes,
      mesLabel: MESES_LABEL[mes] ?? mes,
      computed,
      ...resultado,
    });
  } catch (e: unknown) {
    console.error('[cipa/diagnostico] error', e);
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
