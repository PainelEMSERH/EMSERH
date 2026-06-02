import prisma from '@/lib/prisma';
import { ReportFilters } from '@/lib/relatorios/config';
import { isEpiObrigatorio } from '@/data/epiObrigatorio';

/** Normalização de CPF (mesma regra do painel de OS). */
export const SQL_CPF_KEY = (col: string) => {
  const d = `regexp_replace(TRIM(COALESCE(${col}, '')), '[^0-9]', '', 'g')`;
  return `(
    CASE
      WHEN ${d} = '' THEN NULL::text
      WHEN length(${d}) > 11 THEN right(${d}, 11)
      ELSE lpad(${d}, 11, '0')
    END
  )`;
};

export type EntregasExportFilters = ReportFilters & {
  incluir_pendentes?: boolean;
  q?: string;
};

function buildFilterParams(filters: EntregasExportFilters) {
  const now = new Date();
  const defaultAte = filters.ate || now.toISOString().slice(0, 10);
  const defaultDe =
    filters.de ||
    (filters.ate ? filters.ate : '2026-01-01');

  const where: string[] = [];
  const params: unknown[] = [];

  params.push(defaultDe);
  where.push(`j.data_entrega >= $${params.length}::date`);
  params.push(defaultAte);
  where.push(`j.data_entrega <= $${params.length}::date`);

  if (filters.regional) {
    params.push(filters.regional.toUpperCase());
    where.push(`upper(coalesce(j.regional, '')) = $${params.length}`);
  }

  if (filters.unidade) {
    params.push(`%${filters.unidade.toUpperCase()}%`);
    where.push(`upper(coalesce(j.unidade, '')) LIKE $${params.length}`);
  }

  if (filters.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    where.push(`(
      j.nome ILIKE $${params.length}
      OR j.cpf ILIKE $${params.length}
      OR j.matricula ILIKE $${params.length}
    )`);
  }

  return { whereSql: where.length ? `WHERE ${where.join(' AND ')}` : '', params, defaultDe, defaultAte };
}

const COLAB_FROM_ALTERDATA = `
  SELECT DISTINCT ON (${SQL_CPF_KEY('a.cpf')})
    ${SQL_CPF_KEY('a.cpf')} AS cpf_key,
    a.cpf,
    COALESCE(a.colaborador, '') AS nome,
    COALESCE(a.matricula, '') AS matricula,
    COALESCE(a.funcao, '') AS funcao,
    COALESCE(NULLIF(TRIM(u.nmdepartamento), ''), NULLIF(TRIM(a.unidade_hospitalar), ''), '') AS unidade,
    COALESCE(NULLIF(TRIM(u.regional_responsavel), ''), '') AS regional,
    a.admissao::text AS admissao,
    a.demissao::text AS demissao,
    'Alterdata' AS origem
  FROM stg_alterdata_v2 a
  LEFT JOIN stg_unid_reg u
    ON UPPER(TRIM(COALESCE(a.unidade_hospitalar, ''))) = UPPER(TRIM(COALESCE(u.nmdepartamento, '')))
  WHERE ${SQL_CPF_KEY('a.cpf')} IS NOT NULL
  ORDER BY ${SQL_CPF_KEY('a.cpf')}, a.updated_at DESC NULLS LAST
`;

const COLAB_MANUAL = `
  SELECT
    ${SQL_CPF_KEY('m.cpf')} AS cpf_key,
    m.cpf,
    COALESCE(m.nome, '') AS nome,
    COALESCE(m.matricula, '') AS matricula,
    COALESCE(m.funcao, '') AS funcao,
    COALESCE(m.unidade, '') AS unidade,
    COALESCE(m.regional, '') AS regional,
    m.admissao::text AS admissao,
    m.demissao::text AS demissao,
    'Manual' AS origem
  FROM epi_manual_colab m
  WHERE ${SQL_CPF_KEY('m.cpf')} IS NOT NULL
`;

const KIT_HINT = `
  SELECT
    ${SQL_CPF_KEY('a.cpf')} AS cpf_key,
    string_agg(DISTINCT TRIM(COALESCE(m.unidade_hospitalar, '')), '; ' ORDER BY TRIM(COALESCE(m.unidade_hospitalar, ''))) FILTER (
      WHERE TRIM(COALESCE(m.unidade_hospitalar, '')) <> ''
        AND UPPER(TRIM(m.unidade_hospitalar)) NOT IN ('SEM SETOR ESPECÍFICO', 'SEM SETOR ESPECIFICO')
    ) AS setores_no_mapa,
    string_agg(DISTINCT TRIM(COALESCE(m.pcg, '')), '; ' ORDER BY TRIM(COALESCE(m.pcg, ''))) FILTER (
      WHERE TRIM(COALESCE(m.pcg, '')) <> ''
    ) AS pcgs_no_mapa,
    MAX(NULLIF(TRIM(m.funcao_normalizada), '')) AS funcao_normalizada,
    bool_or(UPPER(TRIM(COALESCE(m.pcg, ''))) = 'PCG UNIVERSAL') AS tem_pcg_universal
  FROM stg_alterdata_v2 a
  INNER JOIN stg_epi_map m ON (
    UPPER(TRIM(COALESCE(m.alterdata_funcao, ''))) = UPPER(TRIM(COALESCE(a.funcao, '')))
    OR UPPER(TRIM(COALESCE(m.funcao_normalizada, ''))) = UPPER(TRIM(COALESCE(a.funcao, '')))
  )
  WHERE ${SQL_CPF_KEY('a.cpf')} IS NOT NULL
  GROUP BY ${SQL_CPF_KEY('a.cpf')}
`;

/**
 * Um lançamento por linha (cada elemento do JSONB deliveries).
 */
export async function fetchEntregasDetalhado(filters: EntregasExportFilters) {
  const { whereSql, params } = buildFilterParams(filters);
  const cpfE = SQL_CPF_KEY('e.cpf');

  const sql = `
    WITH colab AS (
      ${COLAB_FROM_ALTERDATA}
    ),
    colab_manual AS (
      ${COLAB_MANUAL}
    ),
    colab_all AS (
      SELECT * FROM colab
      UNION ALL
      SELECT cm.* FROM colab_manual cm
      WHERE NOT EXISTS (SELECT 1 FROM colab c WHERE c.cpf_key = cm.cpf_key)
    ),
    kit_hint AS (
      ${KIT_HINT}
    ),
    base AS (
      SELECT
        ${cpfE} AS cpf_key,
        e.cpf AS cpf_raw,
        e.item,
        e.qty_required,
        e.qty_delivered,
        e.updated_at AS registro_atualizado_em,
        NULLIF(TRIM(elem->>'date'), '') AS data_raw,
        CASE
          WHEN NULLIF(TRIM(elem->>'date'), '') ~ '^\\d{4}-\\d{2}-\\d{2}$'
            THEN (NULLIF(TRIM(elem->>'date'), ''))::date
          ELSE NULL
        END AS data_entrega,
        COALESCE(NULLIF((elem->>'qty')::text, '')::int, 0) AS qtd_lancamento,
        NULLIF(TRIM(elem->>'entregue_por'), '') AS entregue_por,
        NULLIF(TRIM(elem->>'entregue_em'), '') AS entregue_em
      FROM epi_entregas e
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.deliveries, '[]'::jsonb)) elem
      WHERE NULLIF(TRIM(elem->>'date'), '') IS NOT NULL
        AND (
          NULLIF(TRIM(elem->>'date'), '') ~ '^\\d{4}-\\d{2}-\\d{2}$'
          AND substring(NULLIF(TRIM(elem->>'date'), ''), 1, 4)::int >= 2026
        )
    ),
    joined AS (
      SELECT
        b.*,
        COALESCE(c.nome, '—') AS nome,
        COALESCE(c.matricula, '—') AS matricula,
        COALESCE(c.funcao, '—') AS funcao,
        COALESCE(c.unidade, '—') AS unidade,
        COALESCE(c.regional, '—') AS regional,
        c.admissao,
        c.demissao,
        COALESCE(c.origem, '—') AS origem_colaborador,
        COALESCE(k.funcao_normalizada, '') AS funcao_normalizada,
        COALESCE(k.setores_no_mapa, '') AS setores_no_mapa,
        COALESCE(k.pcgs_no_mapa, '') AS pcgs_no_mapa,
        COALESCE(k.tem_pcg_universal, false) AS tem_pcg_universal
      FROM base b
      LEFT JOIN colab_all c ON c.cpf_key = b.cpf_key
      LEFT JOIN kit_hint k ON k.cpf_key = b.cpf_key
    )
    SELECT
      j.cpf_raw AS cpf,
      j.nome,
      j.matricula,
      j.funcao,
      j.funcao_normalizada,
      j.unidade,
      j.regional,
      j.admissao,
      j.demissao,
      j.origem_colaborador,
      j.item,
      j.qtd_lancamento AS quantidade,
      j.data_entrega,
      j.entregue_por,
      j.entregue_em,
      j.qty_required,
      j.qty_delivered,
      GREATEST(0, j.qty_required - j.qty_delivered) AS qtd_pendente,
      j.setores_no_mapa,
      j.pcgs_no_mapa,
      j.tem_pcg_universal,
      j.registro_atualizado_em
    FROM joined j
    ${whereSql}
    ORDER BY j.data_entrega DESC NULLS LAST, j.nome, j.item
  `;

  const rows: Record<string, unknown>[] = await prisma.$queryRawUnsafe(sql, ...params);
  return rows.map((r) => formatDetalheRow(r));
}

function formatDetalheRow(r: Record<string, unknown>) {
  const item = String(r.item || '');
  const temUniversal = Boolean(r.tem_pcg_universal);
  const setores = String(r.setores_no_mapa || '').trim();
  let obsKit =
    'No painel, o kit depende do setor escolhido na entrega; este relatório não grava qual setor foi selecionado.';
  if (!setores && temUniversal) {
    obsKit += ' Função com PCG UNIVERSAL no mapa — possível kit genérico.';
  } else if (setores && setores.includes(';')) {
    obsKit += ` Vários setores no mapa (${setores}) — na tela pode ter sido usado o que melhor casou com a unidade.`;
  } else if (setores) {
    obsKit += ` Setor(s) no mapa: ${setores}.`;
  }

  const dataEntrega = r.data_entrega ? formatDateBr(r.data_entrega) : '';
  const entregueEm = r.entregue_em ? formatDateTimeBr(String(r.entregue_em)) : '';

  return {
    data_entrega: dataEntrega,
    cpf: formatCpfDisplay(String(r.cpf || '')),
    nome: String(r.nome || '—'),
    matricula: String(r.matricula || '—'),
    funcao: String(r.funcao || '—'),
    funcao_normalizada: String(r.funcao_normalizada || '—'),
    unidade: String(r.unidade || '—'),
    regional: String(r.regional || '—'),
    item,
    quantidade: Number(r.quantidade || 0),
    qty_required: Number(r.qty_required || 0),
    qty_delivered: Number(r.qty_delivered || 0),
    qtd_pendente: Number(r.qtd_pendente || 0),
    obrigatorio: isEpiObrigatorio(item) ? 'Sim' : 'Não',
    entregue_por: String(r.entregue_por || '—'),
    entregue_em: entregueEm,
    origem_colaborador: String(r.origem_colaborador || '—'),
    admissao: r.admissao ? formatDateBr(r.admissao) : '',
    demissao: r.demissao ? formatDateBr(r.demissao) : '',
    setores_no_mapa: setores || '—',
    pcgs_no_mapa: String(r.pcgs_no_mapa || '—'),
    observacao_kit: obsKit,
  };
}

/** Resumo por colaborador + item (totais no período). */
export async function fetchEntregasResumo(filters: EntregasExportFilters) {
  const detalhe = await fetchEntregasDetalhado(filters);
  const map = new Map<string, Record<string, unknown>>();

  for (const row of detalhe) {
    const key = `${row.cpf}|${row.item}`;
    const cur = map.get(key);
    if (!cur) {
      map.set(key, {
        ...row,
        total_lancamentos: 1,
        qtd_total_periodo: row.quantidade,
        primeira_entrega: row.data_entrega,
        ultima_entrega: row.data_entrega,
      });
      continue;
    }
    cur.total_lancamentos = Number(cur.total_lancamentos) + 1;
    cur.qtd_total_periodo = Number(cur.qtd_total_periodo) + Number(row.quantidade);
    if (String(row.data_entrega) < String(cur.primeira_entrega)) cur.primeira_entrega = row.data_entrega;
    if (String(row.data_entrega) > String(cur.ultima_entrega)) cur.ultima_entrega = row.data_entrega;
  }

  return Array.from(map.values()).sort((a, b) =>
    String(a.nome).localeCompare(String(b.nome), 'pt-BR'),
  );
}

/** Linhas em epi_entregas com pendência (acumulado < previsto). */
export async function fetchEntregasPendentes(filters: EntregasExportFilters) {
  const regional = filters.regional?.replace(/'/g, "''") || '';
  const unidade = filters.unidade?.replace(/'/g, "''") || '';
  const wh: string[] = ['e.qty_delivered < e.qty_required'];
  if (regional) {
    wh.push(`upper(coalesce(c.regional, '')) = upper('${regional}')`);
  }
  if (unidade) {
    wh.push(`upper(coalesce(c.unidade, '')) LIKE upper('%${unidade}%')`);
  }

  const sql = `
    WITH colab AS (
      ${COLAB_FROM_ALTERDATA}
    ),
    colab_manual AS (
      ${COLAB_MANUAL}
    ),
    colab_all AS (
      SELECT * FROM colab
      UNION ALL
      SELECT cm.* FROM colab_manual cm
      WHERE NOT EXISTS (SELECT 1 FROM colab c WHERE c.cpf_key = cm.cpf_key)
    )
    SELECT
      e.cpf,
      COALESCE(c.nome, '—') AS nome,
      COALESCE(c.matricula, '—') AS matricula,
      COALESCE(c.funcao, '—') AS funcao,
      COALESCE(c.unidade, '—') AS unidade,
      COALESCE(c.regional, '—') AS regional,
      e.item,
      e.qty_required,
      e.qty_delivered,
      (e.qty_required - e.qty_delivered) AS qtd_pendente,
      e.deliveries,
      COALESCE(c.origem, '—') AS origem_colaborador
    FROM epi_entregas e
    LEFT JOIN colab_all c ON c.cpf_key = ${SQL_CPF_KEY('e.cpf')}
  WHERE ${wh.join(' AND ')}
    ORDER BY c.regional, c.unidade, c.nome, e.item
  `;

  const rows: Record<string, unknown>[] = await prisma.$queryRawUnsafe(sql);
  return rows.map((r) => ({
    cpf: formatCpfDisplay(String(r.cpf || '')),
    nome: String(r.nome || '—'),
    matricula: String(r.matricula || '—'),
    funcao: String(r.funcao || '—'),
    unidade: String(r.unidade || '—'),
    regional: String(r.regional || '—'),
    item: String(r.item || ''),
    qty_required: Number(r.qty_required || 0),
    qty_delivered: Number(r.qty_delivered || 0),
    qtd_pendente: Number(r.qtd_pendente || 0),
    obrigatorio: isEpiObrigatorio(String(r.item || '')) ? 'Sim' : 'Não',
    origem_colaborador: String(r.origem_colaborador || '—'),
  }));
}

function formatCpfDisplay(cpf: string) {
  const d = cpf.replace(/\D/g, '').padStart(11, '0').slice(-11);
  if (d.length !== 11) return cpf;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatDateBr(v: unknown) {
  if (!v) return '';
  if (v instanceof Date) return v.toLocaleDateString('pt-BR');
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return s.slice(0, 10);
}

function formatDateTimeBr(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR');
}

export const ENTREGAS_DETALHE_HEADERS: { key: string; label: string }[] = [
  { key: 'data_entrega', label: 'Data da entrega' },
  { key: 'cpf', label: 'CPF' },
  { key: 'nome', label: 'Nome' },
  { key: 'matricula', label: 'Matrícula' },
  { key: 'funcao', label: 'Função (Alterdata)' },
  { key: 'funcao_normalizada', label: 'Função normalizada (mapa EPI)' },
  { key: 'unidade', label: 'Unidade / lotação' },
  { key: 'regional', label: 'Regional' },
  { key: 'item', label: 'EPI / item entregue' },
  { key: 'quantidade', label: 'Qtd neste lançamento' },
  { key: 'qty_required', label: 'Qtd prevista no kit' },
  { key: 'qty_delivered', label: 'Qtd total entregue (acum.)' },
  { key: 'qtd_pendente', label: 'Qtd pendente' },
  { key: 'obrigatorio', label: 'EPI obrigatório' },
  { key: 'entregue_por', label: 'Registrado por' },
  { key: 'entregue_em', label: 'Registrado em' },
  { key: 'origem_colaborador', label: 'Origem cadastro' },
  { key: 'admissao', label: 'Admissão' },
  { key: 'demissao', label: 'Demissão' },
  { key: 'setores_no_mapa', label: 'Setores no mapa EPI' },
  { key: 'pcgs_no_mapa', label: 'PCGs no mapa' },
  { key: 'observacao_kit', label: 'Observação kit/setor' },
];

export const ENTREGAS_RESUMO_HEADERS: { key: string; label: string }[] = [
  { key: 'cpf', label: 'CPF' },
  { key: 'nome', label: 'Nome' },
  { key: 'unidade', label: 'Unidade' },
  { key: 'regional', label: 'Regional' },
  { key: 'item', label: 'EPI / item' },
  { key: 'qtd_total_periodo', label: 'Qtd entregue no período' },
  { key: 'total_lancamentos', label: 'Nº de lançamentos' },
  { key: 'primeira_entrega', label: 'Primeira entrega (período)' },
  { key: 'ultima_entrega', label: 'Última entrega (período)' },
  { key: 'qty_required', label: 'Qtd prevista kit' },
  { key: 'qty_delivered', label: 'Qtd acumulada total' },
  { key: 'qtd_pendente', label: 'Pendente' },
];

export const ENTREGAS_PENDENTES_HEADERS: { key: string; label: string }[] = [
  { key: 'cpf', label: 'CPF' },
  { key: 'nome', label: 'Nome' },
  { key: 'unidade', label: 'Unidade' },
  { key: 'regional', label: 'Regional' },
  { key: 'funcao', label: 'Função' },
  { key: 'item', label: 'EPI / item' },
  { key: 'qty_required', label: 'Previsto' },
  { key: 'qty_delivered', label: 'Entregue' },
  { key: 'qtd_pendente', label: 'Falta entregar' },
  { key: 'obrigatorio', label: 'Obrigatório' },
];

export async function buildEntregasWorkbook(filters: EntregasExportFilters) {
  const XLSX = await import('xlsx');
  const workbook = XLSX.utils.book_new();

  const detalhe = await fetchEntregasDetalhado(filters);
  const resumo = await fetchEntregasResumo(filters);
  const pendentes = filters.incluir_pendentes !== false ? await fetchEntregasPendentes(filters) : [];

  appendSheet(workbook, XLSX, 'Lançamentos', ENTREGAS_DETALHE_HEADERS, detalhe);
  appendSheet(workbook, XLSX, 'Resumo colab+item', ENTREGAS_RESUMO_HEADERS, resumo);
  if (pendentes.length > 0 || filters.incluir_pendentes !== false) {
    appendSheet(workbook, XLSX, 'Pendências', ENTREGAS_PENDENTES_HEADERS, pendentes);
  }

  const meta = [
    ['Relatório de Entregas de EPI — EMSERH'],
    ['Gerado em', new Date().toLocaleString('pt-BR')],
    ['Período', `${filters.de || '2026-01-01'} a ${filters.ate || 'hoje'}`],
    ['Regional', filters.regional || 'Todas'],
    ['Unidade', filters.unidade || 'Todas'],
    ['Busca', filters.q || '—'],
    [''],
    ['Linhas em Lançamentos', String(detalhe.length)],
    ['Linhas em Resumo', String(resumo.length)],
    ['Linhas em Pendências', String(pendentes.length)],
    [''],
    ['Nota', 'Setor usado na entrega não é salvo no banco; colunas de mapa EPI são referência. Funções com vários setores podem ter usado PCG UNIVERSAL ou o setor que casou com a unidade na tela.'],
  ];
  const wsInfo = XLSX.utils.aoa_to_sheet(meta);
  XLSX.utils.book_append_sheet(workbook, wsInfo, 'Info');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function appendSheet(
  workbook: import('xlsx').WorkBook,
  XLSX: typeof import('xlsx'),
  name: string,
  headers: { key: string; label: string }[],
  data: Record<string, unknown>[],
) {
  const headerRow = headers.map((h) => h.label);
  const body = data.map((row) => headers.map((h) => row[h.key] ?? ''));
  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...body]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.min(50, Math.max(12, h.label.length + 2)) }));
  XLSX.utils.book_append_sheet(workbook, ws, name.substring(0, 31));
}
