import type { PrismaClient } from '@prisma/client';
import { compute2026From2025 } from '@/lib/cipa/compute-2026';
import { processCipaRows } from '@/lib/cipa/process-rows';

type PrismaLike = Pick<PrismaClient, '$queryRawUnsafe'>;

export type CipaCronogramaRow = {
  regional: string;
  unidade: string;
  ano_gestao: number;
  atividade_codigo: number;
  atividade_nome: string;
  data_inicio_prevista: string | null;
  data_fim_prevista: string | null;
  data_conclusao: string | null;
};

function mapDbRow(r: Record<string, unknown>, regional: string, anoGestao: number): CipaCronogramaRow {
  return {
    regional: String(r.regional ?? regional),
    unidade: String(r.unidade ?? ''),
    ano_gestao: anoGestao,
    atividade_codigo: Number(r.atividade_codigo) || 0,
    atividade_nome: String(r.atividade_nome ?? ''),
    data_inicio_prevista: r.data_inicio_prevista ? String(r.data_inicio_prevista).slice(0, 10) : null,
    data_fim_prevista: r.data_fim_prevista ? String(r.data_fim_prevista).slice(0, 10) : null,
    data_conclusao: r.data_conclusao ? String(r.data_conclusao).slice(0, 10) : null,
  };
}

export async function loadCipaCronogramaRows(
  prisma: PrismaLike,
  regional: string,
  ano: number,
): Promise<{ rows: CipaCronogramaRow[]; computed: boolean }> {
  if (ano === 2026) {
    const wh2026: string[] = ['ano_gestao = 2026'];
    if (regional) wh2026.push(`UPPER(TRIM(regional)) = UPPER('${String(regional).replace(/'/g, "''")}')`);
    const where2026 = `WHERE ${wh2026.join(' AND ')}`;
    const count2026: { total?: number }[] = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS total FROM cronograma_cipa ${where2026}`,
    );
    const total2026Db = Number(count2026?.[0]?.total ?? 0);

    if (total2026Db > 0) {
      const dbRows: Record<string, unknown>[] = await prisma.$queryRawUnsafe(`
        SELECT regional, unidade, atividade_codigo, atividade_nome,
               data_inicio_prevista::text AS data_inicio_prevista,
               data_fim_prevista::text AS data_fim_prevista,
               data_conclusao::text AS data_conclusao
        FROM cronograma_cipa
        ${where2026}
        ORDER BY unidade, atividade_codigo
      `);
      const normalized = processCipaRows(
        (dbRows || []).map((r) => mapDbRow(r, regional, 2026)),
      );
      return { rows: normalized, computed: false };
    }

    const computed = processCipaRows(await compute2026From2025(prisma, regional, ''));
    return { rows: computed, computed: true };
  }

  const wh: string[] = [`ano_gestao = ${ano}`];
  if (regional) wh.push(`UPPER(TRIM(regional)) = UPPER('${String(regional).replace(/'/g, "''")}')`);
  const whereSql = wh.length ? `WHERE ${wh.join(' AND ')}` : '';

  const dbRows: Record<string, unknown>[] = await prisma.$queryRawUnsafe(`
    SELECT regional, unidade, atividade_codigo, atividade_nome,
           data_inicio_prevista::text AS data_inicio_prevista,
           data_fim_prevista::text AS data_fim_prevista,
           data_conclusao::text AS data_conclusao
    FROM cronograma_cipa
    ${whereSql}
    ORDER BY unidade, atividade_codigo
  `);

  const normalized = processCipaRows(
    (dbRows || []).map((r) => mapDbRow(r, regional, ano)),
  );
  return { rows: normalized, computed: false };
}
