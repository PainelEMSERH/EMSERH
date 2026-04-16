import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ensureDemandasTrabalhistasTables } from '@/lib/demandas-trabalhistas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await ensureDemandasTrabalhistasTables();

    const [
      regionais,
      unidades,
      unidadesDetalhadas,
      anosChegada,
      tipos,
      responsaveis,
      status,
      statusFinal,
    ] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(`
        SELECT DISTINCT regional
        FROM demandas_trabalhistas
        WHERE regional IS NOT NULL AND TRIM(regional) <> ''
        ORDER BY regional
      `),
      prisma.$queryRawUnsafe<any[]>(`
        SELECT DISTINCT unidade
        FROM demandas_trabalhistas
        WHERE unidade IS NOT NULL AND TRIM(unidade) <> ''
        ORDER BY unidade
      `),
      prisma.$queryRawUnsafe<any[]>(`
        SELECT DISTINCT regional, unidade
        FROM demandas_trabalhistas
        WHERE unidade IS NOT NULL AND TRIM(unidade) <> ''
        ORDER BY regional, unidade
      `),
      prisma.$queryRawUnsafe<any[]>(`
        SELECT DISTINCT ano_chegada
        FROM demandas_trabalhistas
        WHERE ano_chegada IS NOT NULL
        ORDER BY ano_chegada DESC
      `),
      prisma.$queryRawUnsafe<any[]>(`
        SELECT DISTINCT tipo_demanda
        FROM demandas_trabalhistas
        WHERE tipo_demanda IS NOT NULL AND TRIM(tipo_demanda) <> ''
        ORDER BY tipo_demanda
      `),
      prisma.$queryRawUnsafe<any[]>(`
        SELECT DISTINCT responsavel
        FROM demandas_trabalhistas
        WHERE responsavel IS NOT NULL AND TRIM(responsavel) <> ''
        ORDER BY responsavel
      `),
      prisma.$queryRawUnsafe<any[]>(`
        SELECT DISTINCT status
        FROM demandas_trabalhistas
        WHERE status IS NOT NULL AND TRIM(status) <> ''
        ORDER BY status
      `),
      prisma.$queryRawUnsafe<any[]>(`
        SELECT DISTINCT status_final
        FROM demandas_trabalhistas
        WHERE status_final IS NOT NULL AND TRIM(status_final) <> ''
        ORDER BY status_final
      `),
    ]);

    return NextResponse.json({
      ok: true,
      regionais: regionais.map((r) => r.regional),
      unidades: unidades.map((u) => u.unidade),
      unidadesDetalhadas: unidadesDetalhadas.map((u) => ({
        regional: u.regional || '',
        unidade: u.unidade,
      })),
      anosChegada: anosChegada.map((a) => a.ano_chegada),
      tipos: tipos.map((t) => t.tipo_demanda),
      responsaveis: responsaveis.map((r) => r.responsavel),
      status: status.map((s) => s.status),
      statusFinal: statusFinal.map((s) => s.status_final),
    });
  } catch (e: any) {
    console.error('[demandas-trabalhistas/options] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
