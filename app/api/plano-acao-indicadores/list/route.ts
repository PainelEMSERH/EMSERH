import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { ensurePlanoAcaoIndicadoresTable } from '@/lib/plano-acao-indicadores-ensure';

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
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(100, Math.max(10, parseInt(url.searchParams.get('pageSize') || '20', 10)));
    const offset = (page - 1) * pageSize;

    const where: string[] = ['1=1'];
    if (regional) {
      where.push(`COALESCE(regional, '') ILIKE '%${esc(regional)}%'`);
    }
    if (status) {
      where.push(`COALESCE(status, '') ILIKE '%${esc(status)}%'`);
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

    const countRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS c FROM plano_acao_indicadores WHERE ${whereSql}`,
    );
    const total = Number(countRows?.[0]?.c || 0);

    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT
        id, item, empresa, unidade, diretoria, gerencia, cod_origem,
        data_origem::text AS data_origem,
        origem, indicador, auxiliar, acao, regional, responsavel,
        prazo::text AS prazo,
        conclusao::text AS conclusao,
        novo_prazo::text AS novo_prazo,
        status, evidencia, comentarios,
        origem_ano, origem_mes, mes_prazo,
        evidencia_arquivo_nome, evidencia_storage_path,
        arquivo_origem, import_batch_id,
        created_at::text AS created_at,
        updated_at::text AS updated_at
      FROM plano_acao_indicadores
      WHERE ${whereSql}
      ORDER BY prazo NULLS LAST, updated_at DESC NULLS LAST
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    let regRows: any[] = [];
    try {
      regRows = (await prisma.$queryRawUnsafe(`
      SELECT DISTINCT TRIM(regional) AS regional
      FROM plano_acao_indicadores
      WHERE COALESCE(TRIM(regional), '') != ''
      ORDER BY 1
    `)) as any[];
    } catch {
      regRows = [];
    }

    const regionais = (regRows || [])
      .map((r) => String(r?.regional || '').trim())
      .filter(Boolean);

    return NextResponse.json({ ok: true, rows, total, regionais, page, pageSize });
  } catch (e: any) {
    console.error('[plano-acao-indicadores list]', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e || 'Erro ao listar') },
      { status: 500 },
    );
  }
}
