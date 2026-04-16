export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import { formatDateBR, getMesBR, parseDateBR } from '@/lib/spci/utils';

const ROOT_ADMIN_EMAIL = 'jonathan.alves@emserh.ma.gov.br';

async function requireRootAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error('UNAUTHENTICATED');
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || '';
  if (email !== ROOT_ADMIN_EMAIL) throw new Error('FORBIDDEN');
  return { userId, email };
}

function excelSerialToUTCDate(serial: number): Date | null {
  if (!Number.isFinite(serial)) return null;
  // Excel "serial date" uses 1899-12-30 as day 0 (for most modern exports).
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return isNaN(d.getTime()) ? null : d;
}

function toDateBR(value: any): string | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    // Use local date parts; file values are date-only.
    return formatDateBR(value);
  }

  if (typeof value === 'number') {
    const d = excelSerialToUTCDate(value);
    if (!d) return null;
    // Format using UTC to avoid timezone shifts.
    const day = String(d.getUTCDate()).padStart(2, '0');
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    const year = d.getUTCFullYear();
    return `${day}/${month}/${year}`;
  }

  if (typeof value === 'string') {
    const s = value.trim();
    if (!s) return null;
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-');
      return `${d}/${m}/${y}`;
    }
    if (/^\d+(\.\d+)?$/.test(s)) {
      const n = Number(s);
      if (!Number.isFinite(n)) return null;
      return toDateBR(n);
    }
    return null;
  }

  return null;
}

function normText(value: any): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s ? s : null;
}

async function ensureSPCIPlanilhaTable() {
  // Table used by `/spci-extintores` APIs (spci_planilha).
  // Uses quoted column names to match existing API queries.
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS spci_planilha (
      id BIGSERIAL PRIMARY KEY,
      "Ano do Planejamento" INTEGER,
      "TAG" TEXT,
      "Unidade" TEXT,
      "Local" TEXT,
      "Regional" TEXT,
      "Classe" TEXT,
      "Massa/Volume (kg/L)" TEXT,
      "TAG de Controle Mensal" TEXT,
      "Data Tagueamento" TEXT,
      "Lote Contrato" TEXT,
      "Possui Contrato" TEXT,
      "Nº série (Selo INMETRO)" TEXT,
      "Última recarga" TEXT,
      "Planej. Recarga" TEXT,
      "Mês Planej Recarga" TEXT,
      "Data Execução Recarga" TEXT,
      "Mês Exec Recarga" TEXT,
      "_import_batch_id" UUID,
      "_imported_at" TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  // Backfill schema if table already existed without these columns.
  await prisma.$executeRawUnsafe(`
    ALTER TABLE spci_planilha
      ADD COLUMN IF NOT EXISTS "Ano do Planejamento" INTEGER,
      ADD COLUMN IF NOT EXISTS "TAG" TEXT,
      ADD COLUMN IF NOT EXISTS "Unidade" TEXT,
      ADD COLUMN IF NOT EXISTS "Local" TEXT,
      ADD COLUMN IF NOT EXISTS "Regional" TEXT,
      ADD COLUMN IF NOT EXISTS "Classe" TEXT,
      ADD COLUMN IF NOT EXISTS "Massa/Volume (kg/L)" TEXT,
      ADD COLUMN IF NOT EXISTS "TAG de Controle Mensal" TEXT,
      ADD COLUMN IF NOT EXISTS "Data Tagueamento" TEXT,
      ADD COLUMN IF NOT EXISTS "Lote Contrato" TEXT,
      ADD COLUMN IF NOT EXISTS "Possui Contrato" TEXT,
      ADD COLUMN IF NOT EXISTS "Nº série (Selo INMETRO)" TEXT,
      ADD COLUMN IF NOT EXISTS "Última recarga" TEXT,
      ADD COLUMN IF NOT EXISTS "Planej. Recarga" TEXT,
      ADD COLUMN IF NOT EXISTS "Mês Planej Recarga" TEXT,
      ADD COLUMN IF NOT EXISTS "Data Execução Recarga" TEXT,
      ADD COLUMN IF NOT EXISTS "Mês Exec Recarga" TEXT,
      ADD COLUMN IF NOT EXISTS "_import_batch_id" UUID,
      ADD COLUMN IF NOT EXISTS "_imported_at" TIMESTAMPTZ NOT NULL DEFAULT now()
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

    const filename = (file.name || 'spci-planilha').toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());

    await ensureSPCIPlanilhaTable();

    let rows: any[] = [];
    if (filename.endsWith('.xlsx')) {
      const xlsx = await import('xlsx');
      const wb = xlsx.read(buf, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
    } else {
      const text = buf.toString('utf8');
      const parsed = parseCSV(text);
      rows = parsed.rows;
    }

    if (!rows.length) return NextResponse.json({ ok: false, error: 'Arquivo vazio' }, { status: 400 });

    const batchId = randomUUID();
    const user = email || 'admin';

    // Replace the entire base (same behavior as other imports).
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE spci_planilha RESTART IDENTITY`);

    const mapped = rows.map((r: any) => {
      const anoPlanejamento = r['Ano do Planejamento'] ?? r['Ano Planejamento'] ?? r['Ano'] ?? null;
      const ultimaRecarga = toDateBR(r['Última recarga'] ?? r['Ultima recarga'] ?? r['Última Recarga'] ?? r['Ultima Recarga']);
      const planejRecarga = toDateBR(r['Planej. Recarga'] ?? r['Planej Recarga'] ?? r['Planej.Recarga'] ?? r['Planejamento Recarga']);
      const dataExec = toDateBR(
        r['Data Execução Recarga'] ??
          r['Data Execucao Recarga'] ??
          r['Data Exec. Recarga'] ??
          r['Data Exec Recarga'] ??
          r['Exec. Recarga'] ??
          r['Exec Recarga'] ??
          r['Execução Recarga'] ??
          r['Execucao Recarga'] ??
          r['Execução de Recarga'] ??
          r['Execucao de Recarga'] ??
          r['Execução de dados Recarga'] ??
          r['Execucao de dados Recarga'] ??
          r['Data de Execução Recarga'] ??
          r['Data de Execucao Recarga'],
      );

      const mesPlanej = planejRecarga ? getMesBR(parseDateBR(planejRecarga)!) : null;
      const mesExec = dataExec ? getMesBR(parseDateBR(dataExec)!) : null;

      return {
        anoPlanejamento: anoPlanejamento ? Number(String(anoPlanejamento).trim()) : null,
        tag: normText(r['TAG'] ?? r['Tag'] ?? r['tag']),
        unidade: normText(r['Unidade'] ?? r['unidade']),
        local: normText(r['Local'] ?? r['local']),
        regional: normText(r['Regional'] ?? r['regional']),
        classe: normText(r['Classe'] ?? r['classe']),
        massaVolume: normText(r['Massa/Volume (kg/L)'] ?? r['Massa/Volume'] ?? r['Massa'] ?? r['Volume']),
        tagControleMensal: normText(r['TAG de Controle Mensal'] ?? r['Tag de Controle Mensal'] ?? r['TAG Controle Mensal'] ?? r['Tag Controle Mensal']),
        dataTagueamento: toDateBR(r['Data Tagueamento'] ?? r['Data de Tagueamento'] ?? r['Data Tag']),
        loteContrato: normText(r['Lote Contrato'] ?? r['Lote'] ?? r['Contrato']),
        possuiContrato: normText(r['Possui Contrato'] ?? r['possui contrato'] ?? r['Contrato']),
        numeroSerie: normText(r['Nº série (Selo INMETRO)'] ?? r['Nº série'] ?? r['Numero serie'] ?? r['Número de Série']),
        ultimaRecarga,
        planejRecarga,
        mesPlanej,
        dataExec,
        mesExec,
      };
    });

    const chunk = 500;
    let inserted = 0;
    for (let i = 0; i < mapped.length; i += chunk) {
      const part = mapped.slice(i, i + chunk);
      const values = part.map((m) => {
        const esc = (v: any) => String(v ?? '').replace(/'/g, "''");
        const n = (v: any) => (v === null || v === undefined || v === '' || Number.isNaN(v)) ? 'NULL' : String(Number(v));
        const t = (v: any) => (v === null || v === undefined || v === '') ? 'NULL' : `'${esc(v)}'`;
        return `(
          ${n(m.anoPlanejamento)},
          ${t(m.tag)},
          ${t(m.unidade)},
          ${t(m.local)},
          ${t(m.regional)},
          ${t(m.classe)},
          ${t(m.massaVolume)},
          ${t(m.tagControleMensal)},
          ${t(m.dataTagueamento)},
          ${t(m.loteContrato)},
          ${t(m.possuiContrato)},
          ${t(m.numeroSerie)},
          ${t(m.ultimaRecarga)},
          ${t(m.planejRecarga)},
          ${t(m.mesPlanej)},
          ${t(m.dataExec)},
          ${t(m.mesExec)},
          '${batchId}'::uuid,
          now()
        )`;
      }).join(',\n');

      const sql = `
        INSERT INTO spci_planilha (
          "Ano do Planejamento",
          "TAG",
          "Unidade",
          "Local",
          "Regional",
          "Classe",
          "Massa/Volume (kg/L)",
          "TAG de Controle Mensal",
          "Data Tagueamento",
          "Lote Contrato",
          "Possui Contrato",
          "Nº série (Selo INMETRO)",
          "Última recarga",
          "Planej. Recarga",
          "Mês Planej Recarga",
          "Data Execução Recarga",
          "Mês Exec Recarga",
          "_import_batch_id",
          "_imported_at"
        ) VALUES ${values}
      `;
      await prisma.$executeRawUnsafe(sql);
      inserted += part.length;
    }

    return NextResponse.json({
      ok: true,
      imported: inserted,
      batchId,
      message: `✅ Importação concluída! ${inserted} registro(s) importado(s). A base anterior foi apagada.`,
      imported_by: user,
    });
  } catch (e: any) {
    console.error('[import/spci-planilha] error', e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}

