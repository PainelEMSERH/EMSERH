import type { PrismaClient } from '@prisma/client';
import { compute2026From2025 } from '@/lib/cipa/compute-2026';
import { processCipaRows } from '@/lib/cipa/process-rows';
import type { MetaRealRow } from '@/lib/cipa/meta-real-compute';

type PrismaLike = Pick<PrismaClient, '$queryRawUnsafe'>;

export async function loadCipaMetaRealRows(
  prisma: PrismaLike,
  regional: string,
  ano: number,
): Promise<MetaRealRow[]> {
  const wh: string[] = [`ano_gestao = ${ano}`];
  if (regional) wh.push(`UPPER(TRIM(regional)) = UPPER('${String(regional).replace(/'/g, "''")}')`);
  const whereSql = `WHERE ${wh.join(' AND ')}`;

  const totalMetaResult: any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS total FROM cronograma_cipa ${whereSql}
  `);
  const totalDb = Number(totalMetaResult[0]?.total ?? 0);

  let useComputed = false;
  if (ano === 2026 && totalDb === 0) {
    useComputed = true;
  } else if (ano === 2026 && totalDb > 0) {
    const check2026: any[] = await prisma.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS total FROM cronograma_cipa
      ${whereSql}
      AND EXTRACT(YEAR FROM data_fim_prevista::date) = 2026
    `);
    if (Number(check2026[0]?.total ?? 0) === 0) useComputed = true;
  }

  if (ano === 2026 && useComputed) {
    const rows2026 = processCipaRows(await compute2026From2025(prisma, regional, ''));
    return rows2026.map((r) => ({
      unidade: r.unidade,
      data_fim_prevista: r.data_fim_prevista,
      data_conclusao: null,
    }));
  }

  const dbRows: any[] = await prisma.$queryRawUnsafe(`
    SELECT unidade, atividade_codigo,
           data_fim_prevista::text AS data_fim_prevista,
           data_conclusao::text AS data_conclusao
    FROM cronograma_cipa
    ${whereSql}
  `);

  const processed = processCipaRows(
    (dbRows || []).map((r) => ({
      regional: regional || '',
      unidade: String(r.unidade ?? ''),
      atividade_codigo: Number(r.atividade_codigo) || 0,
      data_fim_prevista: r.data_fim_prevista ? String(r.data_fim_prevista).slice(0, 10) : null,
      data_conclusao: r.data_conclusao ? String(r.data_conclusao).slice(0, 10) : null,
    })),
  );

  return processed.map((r) => ({
    unidade: r.unidade,
    data_fim_prevista: r.data_fim_prevista ?? null,
    data_conclusao: r.data_conclusao ?? null,
  }));
}

export type UnidadeMetaRealStats = {
  unidade: string;
  totalMeta: number;
  totalReal: number;
  pendentes: number;
  atrasadas: number;
  percentTotal: number;
  /** Quanto esta unidade pesa no "buraco" da regional (pendentes / meta regional). */
  impactoRegionalPct: number;
};

export function computeUnidadeMetaRealStats(
  rows: MetaRealRow[],
  regionalTotalMeta: number,
  ano: number,
): UnidadeMetaRealStats[] {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const byUnit = new Map<
    string,
    { totalMeta: number; totalReal: number; pendentes: number; atrasadas: number }
  >();

  for (const row of rows) {
    const u = String(row.unidade ?? '').trim();
    if (!u) continue;
    const cur = byUnit.get(u) ?? { totalMeta: 0, totalReal: 0, pendentes: 0, atrasadas: 0 };
    cur.totalMeta += 1;
    if (row.data_conclusao) {
      cur.totalReal += 1;
    } else {
      cur.pendentes += 1;
      const fim = row.data_fim_prevista ? String(row.data_fim_prevista).slice(0, 10) : '';
      if (/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
        const [y] = fim.split('-').map(Number);
        if (y === ano) {
          const dt = new Date(fim + 'T12:00:00');
          if (dt < hoje) cur.atrasadas += 1;
        }
      }
    }
    byUnit.set(u, cur);
  }

  const regionalMeta = regionalTotalMeta > 0 ? regionalTotalMeta : rows.length;

  return [...byUnit.entries()]
    .map(([unidade, s]) => ({
      unidade,
      totalMeta: s.totalMeta,
      totalReal: s.totalReal,
      pendentes: s.pendentes,
      atrasadas: s.atrasadas,
      percentTotal: s.totalMeta > 0 ? Math.round((s.totalReal / s.totalMeta) * 100) : 0,
      impactoRegionalPct:
        regionalMeta > 0 ? Math.round((s.pendentes / regionalMeta) * 10000) / 100 : 0,
    }))
    .sort((a, b) => {
      if (b.pendentes !== a.pendentes) return b.pendentes - a.pendentes;
      if (a.percentTotal !== b.percentTotal) return a.percentTotal - b.percentTotal;
      return b.atrasadas - a.atrasadas;
    });
}
