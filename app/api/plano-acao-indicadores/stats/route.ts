import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { ensurePlanoAcaoIndicadoresTable } from '@/lib/plano-acao-indicadores-ensure';
import { aggregateGstBuckets } from '@/lib/plano-acao-gst-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function esc(s: string) {
  return s.replace(/'/g, "''");
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 });
  }

  try {
    await ensurePlanoAcaoIndicadoresTable(prisma);

    const url = new URL(req.url);
    const regional = (url.searchParams.get('regional') || '').trim();
    const status = (url.searchParams.get('status') || '').trim();
    const q = (url.searchParams.get('q') || '').trim();

    const where: string[] = ['1=1'];
    if (regional) {
      where.push(`LOWER(TRIM(COALESCE(regional, ''))) = LOWER(TRIM('${esc(regional)}'))`);
    }
    if (status) {
      where.push(`LOWER(TRIM(COALESCE(status, ''))) = LOWER(TRIM('${esc(status)}'))`);
    }
    if (q) {
      const e = esc(q);
      where.push(`(
        COALESCE(item, '') ILIKE '%${e}%'
        OR COALESCE(acao, '') ILIKE '%${e}%'
        OR COALESCE(indicador, '') ILIKE '%${e}%'
        OR COALESCE(responsavel, '') ILIKE '%${e}%'
        OR COALESCE(unidade, '') ILIKE '%${e}%'
        OR COALESCE(empresa, '') ILIKE '%${e}%'
        OR COALESCE(regional, '') ILIKE '%${e}%'
        OR COALESCE(diretoria, '') ILIKE '%${e}%'
        OR COALESCE(gerencia, '') ILIKE '%${e}%'
        OR COALESCE(origem, '') ILIKE '%${e}%'
        OR COALESCE(cod_origem, '') ILIKE '%${e}%'
        OR COALESCE(auxiliar, '') ILIKE '%${e}%'
        OR COALESCE(status, '') ILIKE '%${e}%'
        OR COALESCE(comentarios, '') ILIKE '%${e}%'
        OR COALESCE(evidencia, '') ILIKE '%${e}%'
      )`);
    }
    const whereSql = where.join(' AND ');

    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT COALESCE(TRIM(status), '') AS status, COUNT(*)::int AS c
      FROM plano_acao_indicadores
      WHERE ${whereSql}
      GROUP BY 1
    `);

    const b = aggregateGstBuckets(
      (rows || []).map((r) => ({ status: r.status, c: Number(r.c || 0) })),
    );

    const total = Math.max(0, b.total);
    const pct = (n: number) => (total > 0 ? Math.round((n / total) * 10000) / 100 : 0);

    return NextResponse.json({
      ok: true,
      total,
      pctTotal: 100,
      cards: {
        total: { label: 'Nº de Ações', count: total, pct: 100 },
        no_prazo: { label: 'No prazo', count: b.no_prazo, pct: pct(b.no_prazo) },
        em_atraso: { label: 'Em atraso', count: b.em_atraso, pct: pct(b.em_atraso) },
        concluido: { label: 'Concluído', count: b.concluido, pct: pct(b.concluido) },
        atraso_reprogramado: {
          label: 'Em atraso Reprogramado',
          count: b.atraso_reprogramado,
          pct: pct(b.atraso_reprogramado),
        },
        cancelado: { label: 'Cancelado', count: b.cancelado, pct: pct(b.cancelado) },
      },
    });
  } catch (e: any) {
    console.error('[plano-acao-indicadores stats]', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e || 'Erro ao calcular indicadores') },
      { status: 500 },
    );
  }
}
