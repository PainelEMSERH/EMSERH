import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { ensureAdminApi } from '@/lib/admin/ensure-admin-api';
import { compute2026From2025 } from '@/lib/cipa/compute-2026';
import { DESIGNADO_EXCLUDED_CODES, isDesignadoUnit } from '@/lib/cipa/designado';
import { resolveCipaUnidade } from '@/lib/cipa/unidades';

/**
 * Replica cronograma 2026 a partir das datas de posse 2025. Insere em cronograma_cipa.
 * Restrito a administradores — usuários editam datas individualmente na tela CIPA.
 */
export async function POST() {
  const check = await ensureAdminApi();
  if (!check.ok) {
    return NextResponse.json({ ok: false, error: 'Acesso negado' }, { status: check.status });
  }

  try {    // Preserva conclusões já lançadas em 2026 para não perder baixas
    const existing2026 = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        TRIM(COALESCE(regional, '')) AS regional,
        TRIM(COALESCE(unidade, '')) AS unidade,
        atividade_codigo,
        data_inicio_prevista::text AS data_inicio_prevista,
        data_fim_prevista::text AS data_fim_prevista,
        data_conclusao::text AS data_conclusao
      FROM cronograma_cipa
      WHERE ano_gestao = 2026
    `);
    const savedDatesMap = new Map<
      string,
      { inicio: string | null; fim: string | null; conclusao: string | null }
    >();
    for (const r of existing2026 || []) {
      const key = `${String(r.regional || '').trim()}|${resolveCipaUnidade(String(r.unidade || '').trim(), Number(r.atividade_codigo) || 0)}|${Number(r.atividade_codigo) || 0}`;
      savedDatesMap.set(key, {
        inicio: r?.data_inicio_prevista ? String(r.data_inicio_prevista).slice(0, 10) : null,
        fim: r?.data_fim_prevista ? String(r.data_fim_prevista).slice(0, 10) : null,
        conclusao: r?.data_conclusao ? String(r.data_conclusao).slice(0, 10) : null,
      });
    }

    await prisma.$executeRawUnsafe(`DELETE FROM cronograma_cipa WHERE ano_gestao = 2026`);

    const rows2026 = await compute2026From2025(prisma, '', '');
    let inserted = 0;

    for (const a of rows2026) {
      const regEsc = a.regional.replace(/'/g, "''");
      const uniEsc = a.unidade.replace(/'/g, "''");
      const nomeEsc = a.atividade_nome.replace(/'/g, "''");
      const key = `${a.regional}|${a.unidade}|${a.atividade_codigo}`;
      const saved = savedDatesMap.get(key);
      const dataInicio = saved?.inicio ?? a.data_inicio_prevista;
      const dataFim = saved?.fim ?? a.data_fim_prevista;
      const dataConclusao = saved?.conclusao;
      const dataConclusaoSql = dataConclusao ? `'${dataConclusao}'::date` : 'NULL';
      await prisma.$executeRawUnsafe(`
        INSERT INTO cronograma_cipa (
          regional, unidade, ano_gestao, atividade_codigo, atividade_nome,
          data_inicio_prevista, data_fim_prevista, data_conclusao, data_posse_gestao
        )
        VALUES (
          '${regEsc}', '${uniEsc}', 2026, ${a.atividade_codigo}, '${nomeEsc}',
          '${dataInicio}'::date, '${dataFim}'::date, ${dataConclusaoSql}, '${a.data_posse_gestao}'::date
        )
      `);
      inserted++;
    }

    const designadoUnits = [...new Set(rows2026.filter((r) => isDesignadoUnit(r.unidade)).map((r) => r.unidade))];
    let purged = 0;
    for (const uni of designadoUnits) {
      const uniEsc = String(uni).replace(/'/g, "''");
      const del = await prisma.$executeRawUnsafe(`
        DELETE FROM cronograma_cipa
        WHERE ano_gestao = 2026
          AND UPPER(TRIM(unidade)) = UPPER(TRIM('${uniEsc}'))
          AND atividade_codigo IN (${DESIGNADO_EXCLUDED_CODES.join(',')})
      `);
      purged += Number(del ?? 0);
    }

    const units = new Set(rows2026.map((r) => `${r.regional}|${r.unidade}`)).size;
    return NextResponse.json({ ok: true, inserted, units, purgedDesignado: purged });
  } catch (e: any) {
    console.error('[cipa/replicar-2026] error', e);
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
