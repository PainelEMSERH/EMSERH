import { filterDesignadoRows } from '@/lib/cipa/designado';
import { canonUnidade } from '@/lib/unidReg';
import { normalizeCipaUnidade } from '@/lib/cipa/unidades';

type CipaRowBase = {
  regional: string;
  unidade: string;
  atividade_codigo: number;
  data_conclusao?: string | null;
  data_inicio_prevista?: string | null;
  data_fim_prevista?: string | null;
  data_posse_gestao?: string | null;
  atividade_nome?: string;
  [key: string]: unknown;
};

function rowScore(row: CipaRowBase, sourceCanon: string): number {
  let score = 0;
  if (row.data_conclusao) score += 100;
  if (sourceCanon.includes('POLICLINICA')) score += 10;
  if (row.data_fim_prevista) score += 1;
  return score;
}

/** Agrupa UPA + Policlínica (e renomeia CE) antes do filtro de designados. */
export function mergeCipaUnidadeRows<T extends CipaRowBase>(rows: T[]): T[] {
  const map = new Map<string, { row: T; score: number }>();

  for (const row of rows) {
    const sourceCanon = canonUnidade(row.unidade);
    const normUnit = normalizeCipaUnidade(row.unidade);
    const key = `${String(row.regional).trim()}|${normUnit}|${row.atividade_codigo}`;
    const score = rowScore(row, sourceCanon);
    const existing = map.get(key);

    if (!existing || score > existing.score) {
      map.set(key, {
        row: { ...row, unidade: normUnit },
        score,
      });
    }
  }

  return [...map.values()].map((e) => e.row);
}

/** Pipeline único: unificar unidades → aplicar regras de designado. */
export function processCipaRows<T extends CipaRowBase>(rows: T[]): T[] {
  return filterDesignadoRows(mergeCipaUnidadeRows(rows));
}
