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

/** Converte data do JSONB (ISO, BR ou serial Excel) para date. */
const SQL_PARSE_DELIVERY_DATE = (rawExpr: string) => `(
  CASE
    WHEN ${rawExpr} IS NULL OR TRIM(${rawExpr}) = '' THEN NULL::date
    WHEN TRIM(${rawExpr}) ~ '^\\d{4}-\\d{2}-\\d{2}' THEN SUBSTRING(TRIM(${rawExpr}), 1, 10)::date
    WHEN TRIM(${rawExpr}) ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(TRIM(${rawExpr}), 'DD/MM/YYYY')
    WHEN TRIM(${rawExpr}) ~ '^\\d+$' THEN (DATE '1899-12-30' + TRIM(${rawExpr})::int)
    ELSE NULL::date
  END
)`;

async function tableExists(name: string): Promise<boolean> {
  const rows: { exists: boolean }[] = await prisma.$queryRawUnsafe(
    `SELECT EXISTS (
      SELECT 1 FROM pg_catalog.pg_class c
      JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = $1
    ) AS exists`,
    name,
  );
  return Boolean(rows?.[0]?.exists);
}

function buildFilterParams(filters: EntregasExportFilters) {
  const now = new Date();
  const defaultAte = filters.ate || now.toISOString().slice(0, 10);
  const defaultDe = filters.de || '2026-01-01';

  const where: string[] = [];
  const params: unknown[] = [];

  params.push(defaultDe);
  where.push(`j.data_entrega >= $${params.length}::date`);
  params.push(defaultAte);
  where.push(`j.data_entrega <= $${params.length}::date`);

  // Filtro por regional/unidade no colaborador (não em '—' quando o join falha)
  if (filters.regional) {
    params.push(filters.regional.toUpperCase());
    where.push(`EXISTS (
      SELECT 1 FROM colab_all c_f
      WHERE c_f.cpf_key = j.cpf_key
        AND upper(trim(coalesce(c_f.regional, ''))) = $${params.length}
    )`);
  }

  if (filters.unidade) {
    params.push(`%${filters.unidade.toUpperCase()}%`);
    where.push(`EXISTS (
      SELECT 1 FROM colab_all c_f
      WHERE c_f.cpf_key = j.cpf_key
        AND upper(trim(coalesce(c_f.unidade, ''))) LIKE $${params.length}
    )`);
  }

  if (filters.q?.trim()) {
    params.push(`%${filters.q.trim()}%`);
    where.push(`(
      j.nome ILIKE $${params.length}
      OR j.cpf ILIKE $${params.length}
      OR j.matricula ILIKE $${params.length}
      OR EXISTS (
        SELECT 1 FROM colab_all c_f
        WHERE c_f.cpf_key = j.cpf_key
          AND (
            c_f.nome ILIKE $${params.length}
            OR c_f.cpf ILIKE $${params.length}
            OR c_f.matricula ILIKE $${params.length}
          )
      )
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

async function buildColabCtes(): Promise<string> {
  const hasAlterdata = await tableExists('stg_alterdata_v2');
  const hasManual = await tableExists('epi_manual_colab');
  const hasMv = await tableExists('mv_alterdata_flat');

  const parts: string[] = [];

  if (hasAlterdata) {
    parts.push(`colab AS (${COLAB_FROM_ALTERDATA})`);
  } else if (hasMv) {
    parts.push(`colab AS (
      SELECT DISTINCT ON (${SQL_CPF_KEY('f.cpf')})
        ${SQL_CPF_KEY('f.cpf')} AS cpf_key,
        f.cpf,
        COALESCE(f.nome, '') AS nome,
        COALESCE(f.matricula, '') AS matricula,
        COALESCE(f.funcao, '') AS funcao,
        COALESCE(f.unidade, '') AS unidade,
        COALESCE(f.regional, '') AS regional,
        f.admissao::text AS admissao,
        f.demissao::text AS demissao,
        'Alterdata (view)' AS origem
      FROM mv_alterdata_flat f
      WHERE ${SQL_CPF_KEY('f.cpf')} IS NOT NULL
      ORDER BY ${SQL_CPF_KEY('f.cpf')}
    )`);
  } else {
    parts.push(`colab AS (
      SELECT NULL::text AS cpf_key, NULL::text AS cpf, '' AS nome, '' AS matricula,
        '' AS funcao, '' AS unidade, '' AS regional,
        NULL::text AS admissao, NULL::text AS demissao, '' AS origem
      WHERE false
    )`);
  }

  if (hasManual) {
    parts.push(`colab_manual AS (${COLAB_MANUAL})`);
  } else {
    parts.push(`colab_manual AS (
      SELECT NULL::text AS cpf_key, NULL::text AS cpf, '' AS nome, '' AS matricula,
        '' AS funcao, '' AS unidade, '' AS regional,
        NULL::text AS admissao, NULL::text AS demissao, '' AS origem
      WHERE false
    )`);
  }

  parts.push(`colab_all AS (
    SELECT * FROM colab
    UNION ALL
    SELECT cm.* FROM colab_manual cm
    WHERE NOT EXISTS (SELECT 1 FROM colab c WHERE c.cpf_key = cm.cpf_key)
  )`);

  const hasEpiMap = await tableExists('stg_epi_map');
  if (hasAlterdata && hasEpiMap) {
    parts.push(`kit_hint AS (${KIT_HINT})`);
  } else {
    parts.push(`kit_hint AS (
      SELECT NULL::text AS cpf_key, '' AS setores_no_mapa, '' AS pcgs_no_mapa,
        '' AS funcao_normalizada, false AS tem_pcg_universal
      WHERE false
    )`);
  }

  return parts.join(',\n');
}

/**
 * Um lançamento por linha (cada elemento do JSONB deliveries).
 */
export async function fetchEntregasDetalhado(filters: EntregasExportFilters) {
  const { whereSql, params } = buildFilterParams(filters);
  const cpfE = SQL_CPF_KEY('e.cpf');
  const dataRawExpr = `COALESCE(
    NULLIF(TRIM(elem->>'date'), ''),
    NULLIF(TRIM(elem->>'Date'), ''),
    NULLIF(TRIM(elem->>'data'), '')
  )`;

  const colabCtes = await buildColabCtes();

  const sql = `
    WITH ${colabCtes},
    base AS (
      SELECT
        ${cpfE} AS cpf_key,
        e.cpf AS cpf_raw,
        e.item,
        e.qty_required,
        e.qty_delivered,
        e.updated_at AS registro_atualizado_em,
        ${dataRawExpr} AS data_raw,
        ${SQL_PARSE_DELIVERY_DATE(dataRawExpr)} AS data_entrega,
        GREATEST(0, COALESCE(
          NULLIF(regexp_replace(COALESCE(elem->>'qty', elem->>'quantity', '0'), '[^0-9]', '', 'g'), '')::int,
          0
        )) AS qtd_lancamento,
        NULLIF(TRIM(COALESCE(elem->>'entregue_por', elem->>'Entregue_por', '')), '') AS entregue_por,
        NULLIF(TRIM(COALESCE(elem->>'entregue_em', elem->>'Entregue_em', '')), '') AS entregue_em
      FROM epi_entregas e
      CROSS JOIN LATERAL jsonb_array_elements(
        CASE
          WHEN jsonb_typeof(COALESCE(e.deliveries, '[]'::jsonb)) = 'array' THEN COALESCE(e.deliveries, '[]'::jsonb)
          ELSE '[]'::jsonb
        END
      ) elem
    ),
    base_legacy AS (
      SELECT
        ${cpfE} AS cpf_key,
        e.cpf AS cpf_raw,
        e.item,
        e.qty_required,
        e.qty_delivered,
        e.updated_at AS registro_atualizado_em,
        to_char(e.updated_at AT TIME ZONE 'America/Fortaleza', 'YYYY-MM-DD') AS data_raw,
        (e.updated_at AT TIME ZONE 'America/Fortaleza')::date AS data_entrega,
        e.qty_delivered AS qtd_lancamento,
        NULL::text AS entregue_por,
        NULL::text AS entregue_em
      FROM epi_entregas e
      WHERE e.qty_delivered > 0
        AND (
          e.deliveries IS NULL
          OR jsonb_typeof(e.deliveries) <> 'array'
          OR jsonb_array_length(e.deliveries) = 0
        )
    ),
    base_ok AS (
      SELECT * FROM base WHERE data_entrega IS NOT NULL
      UNION ALL
      SELECT * FROM base_legacy WHERE data_entrega IS NOT NULL
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
      FROM base_ok b
      LEFT JOIN colab_all c ON c.cpf_key = b.cpf_key
      LEFT JOIN kit_hint k ON k.cpf_key = b.cpf_key
    )
    SELECT
      j.cpf_raw AS cpf,
      j.cpf_key,
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

  let rows: Record<string, unknown>[];
  try {
    rows = await prisma.$queryRawUnsafe(sql, ...params);
  } catch (e) {
    console.error('[entregas-export] query principal falhou, usando fallback simples', e);
    rows = await fetchEntregasDetalhadoFallback(filters);
  }

  if (rows.length === 0) {
    const fallback = await fetchEntregasDetalhadoFallback(filters);
    if (fallback.length > 0) rows = fallback;
  }

  return rows.map((r) => formatDetalheRow(r));
}

/** Fallback: mesma lógica do relatório antigo (mv_alterdata_flat + cast direto). */
async function fetchEntregasDetalhadoFallback(filters: EntregasExportFilters) {
  const now = new Date();
  const defaultAte = filters.ate || now.toISOString().slice(0, 10);
  const defaultDe = filters.de || '2026-01-01';
  const params: unknown[] = [defaultDe, defaultAte];
  const wh: string[] = [
    `j.data_entrega >= $1::date`,
    `j.data_entrega <= $2::date`,
  ];

  if (filters.regional) {
    params.push(filters.regional.toUpperCase());
    wh.push(`upper(coalesce(j.regional, '')) = $${params.length}`);
  }
  if (filters.unidade) {
    params.push(`%${filters.unidade.toUpperCase()}%`);
    wh.push(`upper(coalesce(j.unidade, '')) LIKE $${params.length}`);
  }

  const sql = `
    WITH base AS (
      SELECT
        e.cpf,
        e.item,
        e.qty_required,
        e.qty_delivered,
        ${SQL_PARSE_DELIVERY_DATE(`COALESCE(NULLIF(TRIM(elem->>'date'), ''), NULLIF(TRIM(elem->>'Date'), ''))`)} AS data_entrega,
        GREATEST(0, COALESCE((elem->>'qty')::int, 0)) AS quantidade,
        NULLIF(TRIM(elem->>'entregue_por'), '') AS entregue_por,
        NULLIF(TRIM(elem->>'entregue_em'), '') AS entregue_em
      FROM epi_entregas e
      CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.deliveries, '[]'::jsonb)) elem
    ),
    joined AS (
      SELECT
        b.*,
        COALESCE(f.regional, m.regional, '—') AS regional,
        COALESCE(f.unidade, m.unidade, '—') AS unidade,
        COALESCE(f.nome, m.nome, '—') AS nome,
        COALESCE(f.matricula, m.matricula, '—') AS matricula,
        COALESCE(f.funcao, m.funcao, '—') AS funcao,
        COALESCE(f.admissao, m.admissao::text, NULL) AS admissao,
        COALESCE(f.demissao, m.demissao::text, NULL) AS demissao,
        CASE WHEN f.cpf IS NOT NULL THEN 'Alterdata' WHEN m.cpf IS NOT NULL THEN 'Manual' ELSE '—' END AS origem_colaborador
      FROM base b
      LEFT JOIN mv_alterdata_flat f ON ${SQL_CPF_KEY('f.cpf')} = ${SQL_CPF_KEY('b.cpf')}
      LEFT JOIN epi_manual_colab m ON ${SQL_CPF_KEY('m.cpf')} = ${SQL_CPF_KEY('b.cpf')}
      WHERE b.data_entrega IS NOT NULL
    )
    SELECT * FROM joined j
    WHERE ${wh.join(' AND ')}
    ORDER BY j.data_entrega DESC, j.nome, j.item
  `;

  try {
    const rows: Record<string, unknown>[] = await prisma.$queryRawUnsafe(sql, ...params);
    return rows.map((r) =>
      formatDetalheRow({
        ...r,
        funcao_normalizada: '',
        setores_no_mapa: '',
        pcgs_no_mapa: '',
        tem_pcg_universal: false,
        qtd_pendente: Math.max(0, Number(r.qty_required || 0) - Number(r.qty_delivered || 0)),
      }),
    );
  } catch {
    return [];
  }
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
  const cpfJoin = SQL_CPF_KEY('e.cpf');

  if (regional) {
    wh.push(`EXISTS (
      SELECT 1 FROM colab_all c_f
      WHERE c_f.cpf_key = ${cpfJoin}
        AND upper(trim(coalesce(c_f.regional, ''))) = upper('${regional}')
    )`);
  }
  if (unidade) {
    wh.push(`EXISTS (
      SELECT 1 FROM colab_all c_f
      WHERE c_f.cpf_key = ${cpfJoin}
        AND upper(trim(coalesce(c_f.unidade, ''))) LIKE upper('%${unidade}%')
    )`);
  }

  const colabCtes = await buildColabCtes();

  const sql = `
    WITH ${colabCtes}
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

  let totalEpiRows = 0;
  let totalDeliveryEvents = 0;
  try {
    const counts: { total_itens: bigint; total_eventos: bigint }[] = await prisma.$queryRawUnsafe(`
      SELECT
        COUNT(*)::bigint AS total_itens,
        COALESCE(SUM(jsonb_array_length(COALESCE(deliveries, '[]'::jsonb))), 0)::bigint AS total_eventos
      FROM epi_entregas
    `);
    totalEpiRows = Number(counts[0]?.total_itens ?? 0);
    totalDeliveryEvents = Number(counts[0]?.total_eventos ?? 0);
  } catch {
    /* ignore */
  }

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
    ['Itens em epi_entregas (banco)', String(totalEpiRows)],
    ['Eventos em deliveries JSON (banco)', String(totalDeliveryEvents)],
    [''],
    detalhe.length === 0 && totalDeliveryEvents > 0
      ? ['Aviso', 'Há entregas no banco, mas nenhuma no período/filtros. Amplie as datas ou use Regional = Consolidado.']
      : ['Nota', 'Setor usado na entrega não é salvo no banco; colunas de mapa EPI são referência.'],
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
