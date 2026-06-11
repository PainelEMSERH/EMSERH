import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { compute2026From2025 } from '@/lib/cipa/compute-2026';
import { DESIGNADO_EXCLUDED_CODES, isDesignadoUnit } from '@/lib/cipa/designado';
import { resolveCipaUnidade } from '@/lib/cipa/unidades';

/**
 * Replica cronograma 2026 a partir das datas de posse 2025. Insere em cronograma_cipa.
 * Usa a mesma lógica de cálculo da lib (compute2026From2025).
 */
export async function POST() {
  try {
    // Preserva conclusões já lançadas em 2026 para não perder baixas
    const existing2026 = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        TRIM(COALESCE(regional, '')) AS regional,
        TRIM(COALESCE(unidade, '')) AS unidade,
        atividade_codigo,
        data_conclusao::text AS data_conclusao
      FROM cronograma_cipa
      WHERE ano_gestao = 2026
    `);
    const conclusaoMap = new Map<string, string | null>();
    for (const r of existing2026 || []) {
      const key = `${String(r.regional || '').trim()}|${resolveCipaUnidade(String(r.unidade || '').trim(), Number(r.atividade_codigo) || 0)}|${Number(r.atividade_codigo) || 0}`;
      const dc = r?.data_conclusao ? String(r.data_conclusao).slice(0, 10) : null;
      conclusaoMap.set(key, dc);
    }

    await prisma.$executeRawUnsafe(`DELETE FROM cronograma_cipa WHERE ano_gestao = 2026`);

    const rows2026 = await compute2026From2025(prisma, '', '');
    let inserted = 0;

    for (const a of rows2026) {
      const regEsc = a.regional.replace(/'/g, "''");
      const uniEsc = a.unidade.replace(/'/g, "''");
      const nomeEsc = a.atividade_nome.replace(/'/g, "''");
      const key = `${a.regional}|${a.unidade}|${a.atividade_codigo}`;
      const dataConclusao = conclusaoMap.get(key);
      const dataConclusaoSql = dataConclusao ? `'${dataConclusao}'::date` : 'NULL';
      await prisma.$executeRawUnsafe(`
        INSERT INTO cronograma_cipa (
          regional, unidade, ano_gestao, atividade_codigo, atividade_nome,
          data_inicio_prevista, data_fim_prevista, data_conclusao, data_posse_gestao
        )
        VALUES (
          '${regEsc}', '${uniEsc}', 2026, ${a.atividade_codigo}, '${nomeEsc}',
          '${a.data_inicio_prevista}'::date, '${a.data_fim_prevista}'::date, ${dataConclusaoSql}, '${a.data_posse_gestao}'::date
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
