export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth, currentUser } from '@clerk/nextjs/server';
import { randomUUID } from 'crypto';

const ROOT_ADMIN_EMAIL = 'jonathan.alves@emserh.ma.gov.br';

async function requireRootAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error('UNAUTHENTICATED');
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || '';
  if (email !== ROOT_ADMIN_EMAIL) throw new Error('FORBIDDEN');
  return { userId, email };
}

async function ensureSPCITables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS stg_spci_raw (
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
    CREATE TABLE IF NOT EXISTS stg_spci_imports (
      batch_id UUID PRIMARY KEY,
      source_file TEXT,
      total_rows INTEGER,
      imported_by TEXT,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS stg_spci (
      id BIGSERIAL PRIMARY KEY,
      unidade TEXT,
      regional TEXT,
      tipo_extintor TEXT,
      capacidade TEXT,
      localizacao TEXT,
      data_vencimento DATE,
      ultima_inspecao DATE,
      proxima_inspecao DATE,
      status TEXT,
      numero_serie TEXT,
      fabricante TEXT,
      observacoes TEXT,
      last_batch_id UUID,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION apply_spci_batch(p_batch UUID)
    RETURNS VOID AS $$
    BEGIN
      INSERT INTO stg_spci (
        unidade, regional, tipo_extintor, capacidade, localizacao,
        data_vencimento, ultima_inspecao, proxima_inspecao, status,
        numero_serie, fabricante, observacoes, last_batch_id, updated_at
      )
      SELECT
        NULLIF(TRIM(COALESCE(data->>'Unidade', data->>'unidade', data->>'UNIDADE', '')), '')::text,
        NULLIF(TRIM(COALESCE(data->>'Regional', data->>'regional', data->>'REGIONAL', '')), '')::text,
        NULLIF(TRIM(COALESCE(data->>'Tipo de Extintor', data->>'Tipo Extintor', data->>'tipo_extintor', '')), '')::text,
        NULLIF(TRIM(COALESCE(data->>'Capacidade', data->>'capacidade', '')), '')::text,
        NULLIF(TRIM(COALESCE(data->>'Localização', data->>'Localizacao', data->>'localizacao', '')), '')::text,
        CASE
          WHEN data->>'Data Vencimento' ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN (data->>'Data Vencimento')::date
          WHEN data->>'Data Vencimento' ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(data->>'Data Vencimento', 'DD/MM/YYYY')
          ELSE NULL
        END,
        CASE
          WHEN data->>'Última Inspeção' ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN (data->>'Última Inspeção')::date
          WHEN data->>'Última Inspeção' ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(data->>'Última Inspeção', 'DD/MM/YYYY')
          ELSE NULL
        END,
        CASE
          WHEN data->>'Próxima Inspeção' ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN (data->>'Próxima Inspeção')::date
          WHEN data->>'Próxima Inspeção' ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(data->>'Próxima Inspeção', 'DD/MM/YYYY')
          ELSE NULL
        END,
        NULLIF(TRIM(COALESCE(data->>'Status', data->>'status', '')), '')::text,
        NULLIF(TRIM(COALESCE(data->>'Número de Série', data->>'Numero Serie', data->>'numero_serie', '')), '')::text,
        NULLIF(TRIM(COALESCE(data->>'Fabricante', data->>'fabricante', '')), '')::text,
        NULLIF(TRIM(COALESCE(data->>'Observações', data->>'Observacoes', data->>'observacoes', '')), '')::text,
        batch_id,
        now()
      FROM stg_spci_raw
      WHERE batch_id = p_batch
      ON CONFLICT DO NOTHING;
    END;
    $$ LANGUAGE plpgsql
  `);
}

function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ) {
        out.push(cur); cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  };
  const headers = parseLine(lines[0]).map(h => h.trim());
  const rows = lines.slice(1).map(l => {
    const cells = parseLine(l);
    const o: Record<string, string> = {};
    headers.forEach((h, i) => { o[h] = (cells[i] ?? '').trim(); });
    return o;
  });
  return { headers, rows };
}

export async function POST(req: Request) {
  try {
    const { email } = await requireRootAdmin();
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ ok: false, error: 'Envie um arquivo .xlsx ou .csv' }, { status: 400 });

    const filename = (file.name || 'spci').toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());

    await ensureSPCITables();

    let rows: any[] = [];
    if (filename.endsWith('.xlsx')) {
      try {
        const xlsx = await import('xlsx');
        const wb = xlsx.read(buf, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
      } catch (e: any) {
        return NextResponse.json({ ok: false, error: 'Erro ao ler arquivo Excel. Tente salvar como CSV UTF-8.' }, { status: 400 });
      }
    } else {
      const text = buf.toString('utf8');
      const parsed = parseCSV(text);
      rows = parsed.rows;
    }

    if (!rows.length) return NextResponse.json({ ok: false, error: 'Arquivo vazio' }, { status: 400 });

    const batchId = randomUUID();
    const source = file.name || 'upload';
    const user = email || 'admin';
    let inserted = 0;

    const chunk = 500;
    for (let i = 0; i < rows.length; i += chunk) {
      const part = rows.slice(i, i + chunk);
      const values = part.map((r, idx) => {
        const rowNo = i + idx + 1;
        const json = JSON.stringify(r).replace(/'/g, "''");
        return `('${batchId}'::uuid, ${rowNo}, '${json}'::jsonb, '${source}', '${user}')`;
      }).join(',\n');
      const sql = `INSERT INTO stg_spci_raw (batch_id, row_no, data, source_file, imported_by) VALUES ${values}`;
      await prisma.$executeRawUnsafe(sql);
      inserted += part.length;
    }

    await prisma.$executeRawUnsafe(`
      INSERT INTO stg_spci_imports (batch_id, source_file, total_rows, imported_by)
      VALUES ('${batchId}'::uuid, '${source}', ${inserted}, '${user}')
      ON CONFLICT (batch_id) DO NOTHING
    `);

    await prisma.$executeRawUnsafe(`SELECT apply_spci_batch('${batchId}'::uuid)`);

    return NextResponse.json({ ok: true, batchId, total_rows: inserted });
  } catch (e: any) {
    console.error('[import/spci] error', e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
