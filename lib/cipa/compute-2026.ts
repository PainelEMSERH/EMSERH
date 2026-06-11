import type { PrismaClient } from '@prisma/client';
import { DESIGNADO_ACTIVITY_NAMES, isDesignadoUnit } from '@/lib/cipa/designado';
import { canonUnidade } from '@/lib/unidReg';
import { cipaUnidadeMatchSql, normalizeCipaUnidade } from '@/lib/cipa/unidades';

function toWeekday(d: Date): Date {
  const out = new Date(d);
  const day = out.getDay();
  if (day === 6) out.setDate(out.getDate() - 1);
  else if (day === 0) out.setDate(out.getDate() + 1);
  return out;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function dateToYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const NOMES_ATIVIDADES: Record<number, string> = {
  1: 'Ofício Comunicação à Unidade e Sindicato',
  2: 'Constituição da Comissão Eleitoral',
  3: 'Convocação para as Inscrições',
  4: 'Período de Inscrição',
  5: 'Edital de Divulgação de Candidatos Inscritos',
  6: 'Período de Campanha Eleitoral',
  7: 'Período da Eleição',
  8: 'Ata de Eleição e Apuração de Votos',
  9: 'Solicitar Indicados',
  10: 'Treinamento CIPA',
  11: 'Emissão Certificado',
  12: 'Reunião de Posse',
};

export type Row2026 = {
  id: string;
  regional: string;
  unidade: string;
  ano_gestao: number;
  atividade_codigo: number;
  atividade_nome: string;
  data_inicio_prevista: string;
  data_fim_prevista: string;
  data_conclusao: null;
  data_posse_gestao: string;
};

/**
 * Calcula cronograma 2026 a partir da data de posse do ano anterior.
 * A data de posse de cada unidade está no banco: item 12 (Reunião de Posse) de 2025, coluna data_conclusao.
 * Regras: posse 2025 = data_conclusao item 12 | Reunião Posse 2026 = posse 2025 + 364 | Ofício = posse 2025 + 305 | etc.
 */
export async function compute2026From2025(
  p: Pick<PrismaClient, '$queryRawUnsafe'>,
  filterRegional: string,
  filterUnidade: string
): Promise<Row2026[]> {
  const wh: string[] = ['ano_gestao = 2025', 'atividade_codigo = 12'];
  if (filterRegional) wh.push(`UPPER(TRIM(regional)) = UPPER('${String(filterRegional).replace(/'/g, "''")}')`);
  if (filterUnidade) wh.push(cipaUnidadeMatchSql(filterUnidade));
  const whereSql = `WHERE ${wh.join(' AND ')}`;

  // Data de posse por unidade: item 12 (Reunião de Posse) de 2025, coluna data_conclusão.
  const posseRows: any[] = await p.$queryRawUnsafe(`
    SELECT DISTINCT TRIM(regional) AS regional, TRIM(unidade) AS unidade,
           data_conclusao::text AS data_conclusao
    FROM cronograma_cipa
    ${whereSql}
    AND data_conclusao IS NOT NULL
    ORDER BY regional, unidade
  `);

  type PosseGroup = { regional: string; unidade: string; posse2025Str: string; score: number };
  const posseGroups = new Map<string, PosseGroup>();

  for (const row of posseRows) {
    const reg = String(row.regional ?? '').trim();
    const uniRaw = String(row.unidade ?? '').trim();
    const uni = normalizeCipaUnidade(uniRaw);
    const posse2025Str = String(row.data_conclusao ?? '').slice(0, 10);
    if (!posse2025Str || !/^\d{4}-\d{2}-\d{2}$/.test(posse2025Str)) continue;

    const key = `${reg}|${uni}`;
    const sourceCanon = canonUnidade(uniRaw);
    let score = 0;
    if (sourceCanon.includes('POLICLINICA')) score += 10;
    if (sourceCanon.includes('UPA')) score += 5;

    const existing = posseGroups.get(key);
    if (!existing || score > existing.score) {
      posseGroups.set(key, { regional: reg, unidade: uni, posse2025Str, score });
    }
  }

  const out: Row2026[] = [];
  for (const group of posseGroups.values()) {
    const reg = group.regional;
    const uni = group.unidade;
    const posse2025Str = group.posse2025Str;
    const [y, mo, d] = posse2025Str.split('-').map(Number);
    // data_conclusão do item 12 = data de posse 2025 dessa unidade (ex: 16/05/2025)
    const posseAnoAnterior = new Date(y, mo - 1, d);

    // Reunião de Posse 2026 = posse 2025 + 364
    const posse = addDays(posseAnoAnterior, 364);

    // Ofício = posse do ano anterior + 1 ano - 60 dias (posse 2025 + 305)
    const oficio = addDays(posseAnoAnterior, 305);
    // Constituição da comissão deve seguir o início do cronograma (logo após o Ofício),
    // não ficar próxima da posse. Regra prática: Ofício + 5 dias úteis.
    const constituicao = toWeekday(addDays(oficio, 5));

    // Ata = data da posse + um ano - 30 dias
    const ata = addDays(posse, -30);
    // Convocação = Ata - 20 dias
    const convocacao = addDays(ata, -20);

    // Período de Inscrição = Convocação (início); fim = Convocação + 14
    const periodoInicio = convocacao;
    const periodoFim = addDays(convocacao, 14);
    // Edital = conclusão do período de inscrições + 1
    const edital = addDays(periodoFim, 1);
    // Campanha = Edital + 1 | Eleição = Campanha
    const campanha = addDays(edital, 1);

    const treinamento = addDays(ata, 2);
    const emissao = addDays(treinamento, 7);
    const solicitacaoDesignado = toWeekday(addDays(oficio, 5));

    // Na coluna DATA POSSE exibimos a referência usada: posse 2025 (data_conclusão do item 12)
    const dataPosseExibir = dateToYMD(posseAnoAnterior);

    const designado = isDesignadoUnit(uni);
    const activities: { cod: number; nome: string; inicio: Date; fim: Date }[] = designado
      ? [
          { cod: 1, nome: DESIGNADO_ACTIVITY_NAMES[1], inicio: oficio, fim: addDays(oficio, 2) },
          {
            cod: 9,
            nome: DESIGNADO_ACTIVITY_NAMES[9],
            inicio: solicitacaoDesignado,
            fim: addDays(solicitacaoDesignado, 1),
          },
          { cod: 10, nome: DESIGNADO_ACTIVITY_NAMES[10], inicio: treinamento, fim: addDays(treinamento, 26) },
          { cod: 11, nome: DESIGNADO_ACTIVITY_NAMES[11], inicio: emissao, fim: addDays(emissao, 26) },
          { cod: 12, nome: DESIGNADO_ACTIVITY_NAMES[12], inicio: addDays(posse, -1), fim: posse },
        ]
      : [
          { cod: 1, nome: NOMES_ATIVIDADES[1], inicio: oficio, fim: addDays(oficio, 2) },
          { cod: 2, nome: NOMES_ATIVIDADES[2], inicio: constituicao, fim: addDays(constituicao, 2) },
          { cod: 3, nome: NOMES_ATIVIDADES[3], inicio: convocacao, fim: addDays(convocacao, 1) },
          { cod: 4, nome: NOMES_ATIVIDADES[4], inicio: periodoInicio, fim: periodoFim },
          { cod: 5, nome: NOMES_ATIVIDADES[5], inicio: edital, fim: addDays(edital, 1) },
          { cod: 6, nome: NOMES_ATIVIDADES[6], inicio: campanha, fim: addDays(campanha, 3) },
          { cod: 7, nome: NOMES_ATIVIDADES[7], inicio: campanha, fim: addDays(campanha, 3) },
          { cod: 8, nome: NOMES_ATIVIDADES[8], inicio: ata, fim: addDays(ata, 1) },
          { cod: 9, nome: NOMES_ATIVIDADES[9], inicio: ata, fim: addDays(ata, 1) },
          { cod: 10, nome: NOMES_ATIVIDADES[10], inicio: treinamento, fim: addDays(treinamento, 26) },
          { cod: 11, nome: NOMES_ATIVIDADES[11], inicio: emissao, fim: addDays(emissao, 26) },
          { cod: 12, nome: NOMES_ATIVIDADES[12], inicio: addDays(posse, -1), fim: posse },
        ];

    for (const a of activities) {
      out.push({
        id: `2026-${reg}-${uni}-${a.cod}`,
        regional: reg,
        unidade: uni,
        ano_gestao: 2026,
        atividade_codigo: a.cod,
        atividade_nome: a.nome,
        data_inicio_prevista: dateToYMD(a.inicio),
        data_fim_prevista: dateToYMD(a.fim),
        data_conclusao: null,
        data_posse_gestao: dataPosseExibir,
      });
    }
  }
  return out.sort((a, b) => {
    if (a.regional !== b.regional) return a.regional.localeCompare(b.regional);
    if (a.unidade !== b.unidade) return a.unidade.localeCompare(b.unidade);
    return a.atividade_codigo - b.atividade_codigo;
  });
}
