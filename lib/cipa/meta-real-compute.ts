export type MetaRealRow = {
  unidade: string;
  data_fim_prevista: string | null;
  data_conclusao: string | null;
};

function monthFromDate(iso: string | null | undefined, ano: number): string | null {
  if (!iso) return null;
  const s = String(iso).trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m] = s.split('-').map(Number);
  if (y !== ano) return null;
  if (m < 1 || m > 12) return null;
  return String(m).padStart(2, '0');
}

/** Espera linhas já filtradas por `filterDesignadoRows` (quando aplicável). */
export function computeMetaRealFromRows(rows: MetaRealRow[], ano: number) {
  const meses = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  const metaMeses: Record<string, number> = Object.fromEntries(meses.map((m) => [m, 0]));
  const realMeses: Record<string, number> = Object.fromEntries(meses.map((m) => [m, 0]));

  let totalReal = 0;
  for (const row of rows) {
    const mesMeta = monthFromDate(row.data_fim_prevista, ano);
    if (mesMeta) metaMeses[mesMeta] = (metaMeses[mesMeta] ?? 0) + 1;

    if (row.data_conclusao) {
      totalReal += 1;
      const mesReal = monthFromDate(row.data_conclusao, ano);
      if (mesReal) realMeses[mesReal] = (realMeses[mesReal] ?? 0) + 1;
    }
  }

  const totalMeta = rows.length;
  const meta: Record<string, number> = {};
  const real: Record<string, number> = {};
  const metaPercent: Record<string, number> = {};
  const realPercent: Record<string, number> = {};
  const metaPercentAcumulado: Record<string, number> = {};
  const realPercentAcumulado: Record<string, number> = {};
  const evolucaoMensal: Record<string, number> = {};

  let metaQtdAcum = 0;
  let realQtdAcum = 0;
  meses.forEach((mes) => {
    const metaVal = metaMeses[mes] ?? 0;
    const realVal = realMeses[mes] ?? 0;
    meta[mes] = metaVal;
    real[mes] = realVal;
    metaPercent[mes] = totalMeta > 0 ? Math.round((metaVal / totalMeta) * 10000) / 100 : 0;
    realPercent[mes] = totalMeta > 0 ? Math.round((realVal / totalMeta) * 10000) / 100 : 0;
    metaQtdAcum += metaVal;
    realQtdAcum += realVal;
    metaPercentAcumulado[mes] =
      totalMeta > 0 ? Math.min(100, Math.round((metaQtdAcum / totalMeta) * 10000) / 100) : 0;
    realPercentAcumulado[mes] =
      totalMeta > 0 ? Math.min(100, Math.round((realQtdAcum / totalMeta) * 10000) / 100) : 0;
    evolucaoMensal[mes] = realPercent[mes];
  });

  if (totalMeta > 0) {
    metaPercentAcumulado['12'] = 100;
    if (totalReal >= totalMeta) realPercentAcumulado['12'] = 100;
  }

  return {
    meta,
    real,
    metaPercent,
    realPercent,
    metaPercentAcumulado,
    realPercentAcumulado,
    evolucaoMensal,
    totalMeta,
    totalReal,
    percentTotal: totalMeta > 0 ? Math.round((totalReal / totalMeta) * 100) : 0,
  };
}
