import prisma from '@/lib/prisma';

export const HHT_POR_ATIVO = 150;

export async function ativosPorMesAlterdata(ano: number): Promise<Record<number, number> | null> {
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      WITH ultimo_dia AS (
        SELECT m AS mes, (make_date($1::int, m, 1) + interval '1 month' - interval '1 day')::date AS fim
        FROM generate_series(1, 12) AS m
      ),
      base AS (
        SELECT
          COALESCE(a.cpf, '') AS cpf,
          CASE
            WHEN TRIM(COALESCE(a.admissao,'')) ~ '^[0-9]+$' THEN (DATE '1899-12-30' + TRIM(a.admissao)::int)::date
            WHEN TRIM(COALESCE(a.admissao,'')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN SUBSTRING(TRIM(a.admissao), 1, 10)::date
            WHEN TRIM(COALESCE(a.admissao,'')) ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' THEN to_date(SUBSTRING(TRIM(a.admissao), 1, 10), 'DD/MM/YYYY')
            ELSE NULL
          END AS admissao_d,
          CASE
            WHEN a.demissao IS NULL OR TRIM(COALESCE(a.demissao,'')) = '' THEN NULL
            WHEN TRIM(a.demissao) ~ '^[0-9]+$' THEN (DATE '1899-12-30' + TRIM(a.demissao)::int)::date
            WHEN TRIM(a.demissao) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN SUBSTRING(TRIM(a.demissao), 1, 10)::date
            WHEN TRIM(a.demissao) ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' THEN to_date(SUBSTRING(TRIM(a.demissao), 1, 10), 'DD/MM/YYYY')
            ELSE NULL
          END AS demissao_d
        FROM stg_alterdata_v2 a
        WHERE COALESCE(a.cpf, '') != ''
      )
      SELECT ud.mes::int AS mes, COUNT(DISTINCT b.cpf)::int AS ativos
      FROM ultimo_dia ud
      CROSS JOIN base b
      WHERE b.admissao_d IS NOT NULL
        AND b.admissao_d <= ud.fim
        AND (b.demissao_d IS NULL OR b.demissao_d > ud.fim)
      GROUP BY ud.mes
      ORDER BY ud.mes
      `,
      ano
    );
    const out: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) out[m] = 0;
    for (const r of rows || []) {
      const mes = Number(r.mes);
      if (mes >= 1 && mes <= 12) out[mes] = Number(r.ativos ?? 0);
    }
    return out;
  } catch {
    return null;
  }
}

export type RegistroTaxaFrequenciaMes = {
  mes: number;
  ativos: number;
  horasHomemTrabalhadas: number;
  numeroAcidentes: number;
  taxaFrequencia: number | null;
};

export async function getTaxaFrequenciaRegistros(
  ano: number,
  regional: string
): Promise<{
  registros: RegistroTaxaFrequenciaMes[];
  fonteAtivos: 'alterdata' | 'manual';
  anosComDados: number[];
}> {
  const dataParsedExpr = `(CASE
      WHEN TRIM(COALESCE(data_acidente,'')) ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN (SUBSTRING(TRIM(data_acidente), 1, 10))::date
      WHEN TRIM(COALESCE(data_acidente,'')) ~ '^[0-9]{1,2}/[0-9]{1,2}/[0-9]{4}' THEN to_date(SUBSTRING(TRIM(data_acidente), 1, 10), 'DD/MM/YYYY')
      ELSE NULL END)`;
  const yearExpr = `EXTRACT(YEAR FROM ${dataParsedExpr})::int`;
  const monthExprStg = `EXTRACT(MONTH FROM ${dataParsedExpr})::int`;
  const params: any[] = [ano];
  let whereStg = `WHERE ( (ano IS NOT NULL AND ano::int = $1) OR ( (ano IS NULL OR ano::text = '') AND ${dataParsedExpr} IS NOT NULL AND ${yearExpr} = $1 ) )`;
  if (regional) {
    params.push(regional);
    whereStg += ` AND "Regional" ILIKE $2`;
  }
  const mesColStg = `COALESCE(mes::int, ${monthExprStg})::int`;
  const yearColStg = `COALESCE(ano::int, ${yearExpr})::int`;

  const [ativosAlterdata, ativosRows, acidentesPorMesRows, anosComDadosRows] = await Promise.all([
    ativosPorMesAlterdata(ano),
    prisma.ativosMensal.findMany({
      where: { ano },
      orderBy: { mes: 'asc' },
    }),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT ${mesColStg} AS mes, COUNT(*)::int AS quantidade
         FROM stg_acidentes ${whereStg}
         GROUP BY ${mesColStg} ORDER BY 1`,
      ...params
    ),
    prisma.$queryRawUnsafe<any[]>(
      `SELECT DISTINCT ${yearColStg} AS ano FROM stg_acidentes
         WHERE (ano IS NOT NULL AND ano::text != '') OR (${dataParsedExpr} IS NOT NULL)
         ORDER BY 1`
    ),
  ]);

  const anosComDados: number[] = (anosComDadosRows || [])
    .map((r: any) => Number(r.ano))
    .filter((y: number) => !Number.isNaN(y) && y > 2000 && y <= new Date().getFullYear() + 1)
    .sort((a, b) => a - b);

  const ativosPorMes: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) ativosPorMes[m] = 0;
  if (ativosAlterdata) {
    for (let m = 1; m <= 12; m++) ativosPorMes[m] = ativosAlterdata[m] ?? 0;
  } else {
    for (const r of ativosRows) {
      if (r.mes >= 1 && r.mes <= 12) ativosPorMes[r.mes] = r.ativos;
    }
  }
  const acidentesPorMes: Record<number, number> = {};
  for (const r of acidentesPorMesRows || []) {
    const m = Number(r.mes);
    if (m >= 1 && m <= 12) acidentesPorMes[m] = Number(r.quantidade || 0);
  }

  const registros: RegistroTaxaFrequenciaMes[] = [];
  for (let mes = 1; mes <= 12; mes++) {
    const ativos = ativosPorMes[mes] ?? 0;
    const horasHomemTrabalhadas = ativos * HHT_POR_ATIVO;
    const numeroAcidentes = acidentesPorMes[mes] ?? 0;
    const taxaFrequencia =
      horasHomemTrabalhadas > 0 ? (numeroAcidentes * 1_000_000) / horasHomemTrabalhadas : null;
    registros.push({
      mes,
      ativos,
      horasHomemTrabalhadas,
      numeroAcidentes,
      taxaFrequencia: taxaFrequencia != null ? Math.round(taxaFrequencia * 100) / 100 : null,
    });
  }

  return {
    registros,
    fonteAtivos: ativosAlterdata ? 'alterdata' : 'manual',
    anosComDados,
  };
}
