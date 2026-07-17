export type CipaConcluidaItem = {
  regional: string;
  unidade: string;
  totalAtividades: number;
  concluidas: number;
  dataUltimaConclusao: string | null;
};

type RowIn = {
  regional: string;
  unidade: string;
  atividade_codigo: number;
  data_conclusao: string | null;
};

/** Unidades com todas as atividades do cronograma concluídas (data_conclusao preenchida). */
export function computeCipasConcluidas(rows: RowIn[]) {
  const porUnidade = new Map<
    string,
    { regional: string; unidade: string; total: number; concluidas: number; ultimaConclusao: string | null }
  >();

  for (const row of rows) {
    const regional = String(row.regional ?? '').trim().toUpperCase();
    const unidade = String(row.unidade ?? '').trim();
    if (!unidade) continue;

    const key = `${regional}|${unidade}`;
    const cur = porUnidade.get(key) ?? {
      regional,
      unidade,
      total: 0,
      concluidas: 0,
      ultimaConclusao: null,
    };

    cur.total += 1;
    if (row.data_conclusao) {
      cur.concluidas += 1;
      const conc = String(row.data_conclusao).slice(0, 10);
      if (!cur.ultimaConclusao || conc > cur.ultimaConclusao) {
        cur.ultimaConclusao = conc;
      }
    }

    porUnidade.set(key, cur);
  }

  const todas = [...porUnidade.values()];
  const cipasConcluidas: CipaConcluidaItem[] = todas
    .filter((u) => u.total > 0 && u.concluidas === u.total)
    .map((u) => ({
      regional: u.regional,
      unidade: u.unidade,
      totalAtividades: u.total,
      concluidas: u.concluidas,
      dataUltimaConclusao: u.ultimaConclusao,
    }))
    .sort((a, b) => {
      if (a.regional !== b.regional) return a.regional.localeCompare(b.regional);
      return a.unidade.localeCompare(b.unidade);
    });

  const totalUnidades = todas.filter((u) => u.total > 0).length;
  const emAndamento = totalUnidades - cipasConcluidas.length;

  return {
    totalUnidades,
    cipasConcluidas: cipasConcluidas.length,
    emAndamento,
    unidades: cipasConcluidas,
  };
}
