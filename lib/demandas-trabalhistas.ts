import prisma from '@/lib/prisma';

export type DemandaTrabalhistaImportRow = {
  'Nº SEI': string | null;
  Demandante: string | null;
  'Tipo de demanda': string | null;
  Origem: string | null;
  Unidade: string | null;
  Setor: string | null;
  Função: string | null;
  'INSAL. IADVH': string | null;
  'INSAL. EMSERH': string | null;
  Regional: string | null;
  'Data chegada': string | null;
  'Mês Chegada': string | null;
  'Ano Chegada': number | null;
  Responsável: string | null;
  Status: string | null;
  'Prazo (dias)': number | null;
  'Data limite': string | null;
  'Data de conclusão': string | null;
  'Mês Conclusão': string | null;
  Destino: string | null;
  'Status Final': string | null;
  'Tempo de Resposta (dias)': number | null;
  Observações: string | null;
};

export function normText(value: any): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

export function normHeaderKey(value: any): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function excelSerialToUTCDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDateISO(value: any): string | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof value === 'number') {
    const d = excelSerialToUTCDate(value);
    if (!d) return null;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [day, month, year] = s.split('/');
    return `${year}-${month}-${day}`;
  }
  if (/^\d+(\.\d+)?$/.test(s)) return toDateISO(Number(s));
  return null;
}

export function toNullableInt(value: any): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value);
  const s = String(value).trim();
  if (!s) return null;
  const cleaned = s.replace(/[^\d-]/g, '');
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((line) => line.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = (() => {
    const first = lines[0];
    const comma = (first.match(/,/g) || []).length;
    const semicolon = (first.match(/;/g) || []).length;
    return semicolon > comma ? ';' : ',';
  })();

  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  };

  const headers = parseLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = (cells[index] ?? '').trim();
    });
    return row;
  });

  return { headers, rows };
}

function buildNormalizedHeaderMap(row: Record<string, any>): Record<string, any> {
  const map: Record<string, any> = {};
  for (const key of Object.keys(row || {})) {
    const normalized = normHeaderKey(key);
    if (!normalized || normalized in map) continue;
    map[normalized] = row[key];
  }
  return map;
}

function pickHeader(row: Record<string, any>, aliases: string[]): any {
  const map = buildNormalizedHeaderMap(row);
  for (const alias of aliases) {
    const value = map[alias];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
}

export function normalizeDemandaRow(row: Record<string, any>): DemandaTrabalhistaImportRow {
  const dataChegada = toDateISO(
    pickHeader(row, ['datachegada', 'chegada', 'datadechegada']) ?? row['Data chegada']
  );
  const dataLimite = toDateISO(
    pickHeader(row, ['datalimite', 'limite', 'dataprazo']) ?? row['Data limite']
  );
  const dataConclusao = toDateISO(
    pickHeader(row, ['datadeconclusao', 'dataconclusao', 'conclusao']) ?? row['Data de conclusão']
  );

  return {
    'Nº SEI': normText(pickHeader(row, ['nsei', 'numerosei', 'nosei', 'sei']) ?? row['Nº SEI']),
    Demandante: normText(pickHeader(row, ['demandante', 'solicitante']) ?? row['Demandante']),
    'Tipo de demanda': normText(
      pickHeader(row, ['tipodedemanda', 'tipo', 'demanda']) ?? row['Tipo de demanda']
    ),
    Origem: normText(pickHeader(row, ['origem']) ?? row['Origem']),
    Unidade: normText(pickHeader(row, ['unidade']) ?? row['Unidade']),
    Setor: normText(pickHeader(row, ['setor']) ?? row['Setor']),
    'Função': normText(pickHeader(row, ['funcao', 'função']) ?? row['Função']),
    'INSAL. IADVH': normText(
      pickHeader(row, ['insaliadvh', 'insalubridadeiadvh', 'iadvh']) ?? row['INSAL. IADVH']
    ),
    'INSAL. EMSERH': normText(
      pickHeader(row, ['insalemserh', 'insalubridadeemserh', 'emserh']) ?? row['INSAL. EMSERH']
    ),
    Regional: normText(pickHeader(row, ['regional']) ?? row['Regional']),
    'Data chegada': dataChegada,
    'Mês Chegada': normText(pickHeader(row, ['meschegada', 'mzschegada']) ?? row['Mês Chegada']),
    'Ano Chegada': toNullableInt(
      pickHeader(row, ['anochegada']) ?? row['Ano Chegada']
    ),
    Responsável: normText(
      pickHeader(row, ['responsavel', 'responsável']) ?? row['Responsável']
    ),
    Status: normText(pickHeader(row, ['status']) ?? row['Status']),
    'Prazo (dias)': toNullableInt(
      pickHeader(row, ['prazodias', 'prazoemdias', 'prazo']) ?? row['Prazo (dias)']
    ),
    'Data limite': dataLimite,
    'Data de conclusão': dataConclusao,
    'Mês Conclusão': normText(
      pickHeader(row, ['mesconclusao', 'mesdeconclusao']) ?? row['Mês Conclusão']
    ),
    Destino: normText(pickHeader(row, ['destino']) ?? row['Destino']),
    'Status Final': normText(
      pickHeader(row, ['statusfinal']) ?? row['Status Final']
    ),
    'Tempo de Resposta (dias)': toNullableInt(
      pickHeader(row, ['tempoderespostadias', 'temporespostadias', 'tempoderesposta']) ??
        row['Tempo de Resposta (dias)']
    ),
    Observações: normText(
      pickHeader(row, ['observacoes', 'observação', 'observacao']) ?? row['Observações']
    ),
  };
}

export async function ensureDemandasTrabalhistasTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS stg_demandas_trabalhistas_raw (
      id BIGSERIAL PRIMARY KEY,
      batch_id UUID NOT NULL,
      row_no INTEGER NOT NULL,
      data JSONB NOT NULL,
      source_file TEXT,
      imported_by TEXT,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS stg_demandas_trabalhistas_imports (
      batch_id UUID PRIMARY KEY,
      source_file TEXT,
      total_rows INTEGER,
      imported_by TEXT,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS demandas_trabalhistas (
      id BIGSERIAL PRIMARY KEY,
      numero_sei TEXT,
      demandante TEXT,
      tipo_demanda TEXT,
      origem TEXT,
      unidade TEXT,
      setor TEXT,
      funcao TEXT,
      insal_iadvh TEXT,
      insal_emserh TEXT,
      regional TEXT,
      data_chegada DATE,
      mes_chegada TEXT,
      ano_chegada INTEGER,
      responsavel TEXT,
      status TEXT,
      prazo_dias INTEGER,
      data_limite DATE,
      data_conclusao DATE,
      mes_conclusao TEXT,
      destino TEXT,
      status_final TEXT,
      tempo_resposta_dias INTEGER,
      observacoes TEXT,
      last_batch_id UUID,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_demandas_trabalhistas_numero_sei ON demandas_trabalhistas (numero_sei);
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_demandas_trabalhistas_regional ON demandas_trabalhistas (regional);
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_demandas_trabalhistas_unidade ON demandas_trabalhistas (unidade);
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_demandas_trabalhistas_status ON demandas_trabalhistas (status);
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_demandas_trabalhistas_status_final ON demandas_trabalhistas (status_final);
  `);

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION apply_demandas_trabalhistas_batch(p_batch UUID)
    RETURNS VOID AS $$
    BEGIN
      INSERT INTO demandas_trabalhistas (
        numero_sei,
        demandante,
        tipo_demanda,
        origem,
        unidade,
        setor,
        funcao,
        insal_iadvh,
        insal_emserh,
        regional,
        data_chegada,
        mes_chegada,
        ano_chegada,
        responsavel,
        status,
        prazo_dias,
        data_limite,
        data_conclusao,
        mes_conclusao,
        destino,
        status_final,
        tempo_resposta_dias,
        observacoes,
        last_batch_id,
        updated_at
      )
      SELECT
        NULLIF(TRIM(data->>'Nº SEI'), ''),
        NULLIF(TRIM(data->>'Demandante'), ''),
        NULLIF(TRIM(data->>'Tipo de demanda'), ''),
        NULLIF(TRIM(data->>'Origem'), ''),
        NULLIF(TRIM(data->>'Unidade'), ''),
        NULLIF(TRIM(data->>'Setor'), ''),
        NULLIF(TRIM(data->>'Função'), ''),
        NULLIF(TRIM(data->>'INSAL. IADVH'), ''),
        NULLIF(TRIM(data->>'INSAL. EMSERH'), ''),
        NULLIF(TRIM(data->>'Regional'), ''),
        CASE WHEN COALESCE(TRIM(data->>'Data chegada'), '') ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN (data->>'Data chegada')::date ELSE NULL END,
        NULLIF(TRIM(data->>'Mês Chegada'), ''),
        CASE WHEN COALESCE(TRIM(data->>'Ano Chegada'), '') ~ '^-?\\d+$' THEN (data->>'Ano Chegada')::int ELSE NULL END,
        NULLIF(TRIM(data->>'Responsável'), ''),
        NULLIF(TRIM(data->>'Status'), ''),
        CASE WHEN COALESCE(TRIM(data->>'Prazo (dias)'), '') ~ '^-?\\d+$' THEN (data->>'Prazo (dias)')::int ELSE NULL END,
        CASE WHEN COALESCE(TRIM(data->>'Data limite'), '') ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN (data->>'Data limite')::date ELSE NULL END,
        CASE WHEN COALESCE(TRIM(data->>'Data de conclusão'), '') ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN (data->>'Data de conclusão')::date ELSE NULL END,
        NULLIF(TRIM(data->>'Mês Conclusão'), ''),
        NULLIF(TRIM(data->>'Destino'), ''),
        NULLIF(TRIM(data->>'Status Final'), ''),
        CASE WHEN COALESCE(TRIM(data->>'Tempo de Resposta (dias)'), '') ~ '^-?\\d+$' THEN (data->>'Tempo de Resposta (dias)')::int ELSE NULL END,
        NULLIF(TRIM(data->>'Observações'), ''),
        batch_id,
        now()
      FROM stg_demandas_trabalhistas_raw
      WHERE batch_id = p_batch;
    END;
    $$ LANGUAGE plpgsql
  `);
}
