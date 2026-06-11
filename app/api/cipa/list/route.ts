import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { compute2026From2025 } from '@/lib/cipa/compute-2026';
import { processCipaRows } from '@/lib/cipa/process-rows';
import { cipaUnidadeMatchSql } from '@/lib/cipa/unidades';

/**
 * Lista cronograma CIPA com filtros.
 * 2025 = lê do banco.
 * 2026 = se já existir 2026 no banco, lê do banco (permite editar); senão retorna calculado (posse por unidade).
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const regional = (url.searchParams.get('regional') || '').trim();
    const unidade = (url.searchParams.get('unidade') || '').trim();
    const ano = url.searchParams.get('ano') || '2025';
    const anoNum = parseInt(ano, 10);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(10, parseInt(url.searchParams.get('pageSize') || '50', 10)));
    const offset = (page - 1) * pageSize;

    const hasTable: any[] = await prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'cronograma_cipa'
      ) AS exists
    `);
    if (!hasTable?.[0]?.exists) {
      return NextResponse.json({ ok: true, rows: [], total: 0, ...(anoNum === 2026 ? { computed: true } : {}) });
    }

    // 2026: se já tem registros no banco, retorna do banco (edição); senão retorna calculado
    if (anoNum === 2026) {
      const wh2026: string[] = ['ano_gestao = 2026'];
      if (regional) wh2026.push(`UPPER(TRIM(regional)) = UPPER('${String(regional).replace(/'/g, "''")}')`);
      if (unidade) wh2026.push(cipaUnidadeMatchSql(unidade));
      const where2026 = `WHERE ${wh2026.join(' AND ')}`;
      const count2026: any[] = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS total FROM cronograma_cipa ${where2026}`);
      const total2026Db = Number(count2026?.[0]?.total ?? 0);

      if (total2026Db > 0) {
        const rowsSql = `
          SELECT id, regional, unidade, ano_gestao, atividade_codigo, atividade_nome,
                 data_inicio_prevista::text AS data_inicio_prevista,
                 data_fim_prevista::text AS data_fim_prevista,
                 data_conclusao::text AS data_conclusao,
                 data_posse_gestao::text AS data_posse_gestao
          FROM cronograma_cipa
          ${where2026}
          ORDER BY regional, unidade, atividade_codigo
        `;
        const rowsResult = await prisma.$queryRawUnsafe<any[]>(rowsSql);
        const rows = Array.isArray(rowsResult) ? rowsResult : [];
        const normalized = processCipaRows(
          rows.map((r: any) => ({
            id: r.id,
            regional: String(r.regional ?? ''),
            unidade: String(r.unidade ?? ''),
            ano_gestao: 2026,
            atividade_codigo: Number(r.atividade_codigo) || 0,
            atividade_nome: String(r.atividade_nome ?? ''),
            data_inicio_prevista: r.data_inicio_prevista ? String(r.data_inicio_prevista).slice(0, 10) : null,
            data_fim_prevista: r.data_fim_prevista ? String(r.data_fim_prevista).slice(0, 10) : null,
            data_conclusao: r.data_conclusao ? String(r.data_conclusao).slice(0, 10) : null,
            data_posse_gestao: r.data_posse_gestao ? String(r.data_posse_gestao).slice(0, 10) : null,
          })),
        );
        return NextResponse.json({
          ok: true,
          rows: normalized.slice(offset, offset + pageSize),
          total: normalized.length,
        });
      }

      const rows2026 = processCipaRows(await compute2026From2025(prisma, regional, unidade));
      const total2026 = rows2026.length;
      const paged = rows2026.slice(offset, offset + pageSize);
      return NextResponse.json({
        ok: true,
        rows: paged,
        total: total2026,
        computed: true,
      });
    }

    const wh: string[] = [`ano_gestao = ${anoNum}`];
    if (regional) wh.push(`UPPER(TRIM(regional)) = UPPER('${String(regional).replace(/'/g, "''")}')`);
    if (unidade) wh.push(cipaUnidadeMatchSql(unidade));
    const whereSql = wh.length ? `WHERE ${wh.join(' AND ')}` : '';

    const rowsSql = `
      SELECT id, regional, unidade, ano_gestao, atividade_codigo, atividade_nome,
             data_inicio_prevista::text AS data_inicio_prevista,
             data_fim_prevista::text AS data_fim_prevista,
             data_conclusao::text AS data_conclusao,
             data_posse_gestao::text AS data_posse_gestao
      FROM cronograma_cipa
      ${whereSql}
      ORDER BY regional, unidade, atividade_codigo
    `;

    const rowsResult = await prisma.$queryRawUnsafe<any[]>(rowsSql);
    const rows = Array.isArray(rowsResult) ? rowsResult : [];

    const normalized = processCipaRows(
      rows.map((r: any) => {
        const anoGestao = Number(r.ano_gestao) || 0;
        return {
          id: r.id,
          regional: String(r.regional ?? ''),
          unidade: String(r.unidade ?? ''),
          ano_gestao: anoGestao,
          atividade_codigo: Number(r.atividade_codigo) || 0,
          atividade_nome: String(r.atividade_nome ?? ''),
          data_inicio_prevista: r.data_inicio_prevista ? String(r.data_inicio_prevista).slice(0, 10) : null,
          data_fim_prevista: r.data_fim_prevista ? String(r.data_fim_prevista).slice(0, 10) : null,
          data_conclusao: anoGestao === 2026 ? null : r.data_conclusao ? String(r.data_conclusao).slice(0, 10) : null,
          data_posse_gestao: r.data_posse_gestao ? String(r.data_posse_gestao).slice(0, 10) : null,
        };
      }),
    );

    return NextResponse.json({
      ok: true,
      rows: normalized.slice(offset, offset + pageSize),
      total: normalized.length,
    });
  } catch (e: any) {
    console.error('[cipa/list] error', e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
