export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { randomUUID } from 'crypto';
import prisma from '@/lib/prisma';
import {
  ensureDemandasTrabalhistasTables,
  normalizeDemandaRow,
  parseCSV,
} from '@/lib/demandas-trabalhistas';

const ROOT_ADMIN_EMAIL = 'jonathan.alves@emserh.ma.gov.br';

async function requireRootAdmin() {
  const { userId } = await auth();
  if (!userId) throw new Error('UNAUTHENTICATED');
  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || '';
  if (email !== ROOT_ADMIN_EMAIL) throw new Error('FORBIDDEN');
  return { userId, email };
}

export async function POST(req: Request) {
  try {
    const { email } = await requireRootAdmin();
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ ok: false, error: 'Envie um arquivo .xlsx ou .csv' }, { status: 400 });
    }

    const filename = (file.name || 'demandas-trabalhistas').toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());

    await ensureDemandasTrabalhistasTables();

    let rows: any[] = [];
    if (filename.endsWith('.xlsx')) {
      try {
        const xlsx = await import('xlsx');
        const wb = xlsx.read(buf, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });
      } catch {
        return NextResponse.json(
          { ok: false, error: 'Erro ao ler arquivo Excel. Tente salvar como CSV UTF-8.' },
          { status: 400 }
        );
      }
    } else {
      const parsed = parseCSV(buf.toString('utf8'));
      rows = parsed.rows;
    }

    if (!rows.length) {
      return NextResponse.json({ ok: false, error: 'Arquivo vazio' }, { status: 400 });
    }

    const normalizedRows = rows.map((row) => normalizeDemandaRow(row));
    const batchId = randomUUID();
    const source = file.name || 'upload';
    const user = email || 'admin';

    await prisma.$executeRawUnsafe(`TRUNCATE TABLE stg_demandas_trabalhistas_raw RESTART IDENTITY`);
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE demandas_trabalhistas RESTART IDENTITY`);

    const chunkSize = 500;
    let inserted = 0;
    for (let i = 0; i < normalizedRows.length; i += chunkSize) {
      const part = normalizedRows.slice(i, i + chunkSize);
      const values = part
        .map((row, index) => {
          const rowNo = i + index + 1;
          const json = JSON.stringify(row).replace(/'/g, "''");
          return `('${batchId}'::uuid, ${rowNo}, '${json}'::jsonb, '${source.replace(/'/g, "''")}', '${user.replace(/'/g, "''")}')`;
        })
        .join(',\n');

      await prisma.$executeRawUnsafe(`
        INSERT INTO stg_demandas_trabalhistas_raw (batch_id, row_no, data, source_file, imported_by)
        VALUES ${values}
      `);
      inserted += part.length;
    }

    await prisma.$executeRawUnsafe(`
      INSERT INTO stg_demandas_trabalhistas_imports (batch_id, source_file, total_rows, imported_by)
      VALUES ('${batchId}'::uuid, '${source.replace(/'/g, "''")}', ${inserted}, '${user.replace(/'/g, "''")}')
      ON CONFLICT (batch_id) DO NOTHING
    `);

    await prisma.$executeRawUnsafe(`SELECT apply_demandas_trabalhistas_batch('${batchId}'::uuid)`);

    return NextResponse.json({
      ok: true,
      batchId,
      total_rows: inserted,
      message: `Importação concluída! ${inserted} registro(s) importado(s). A base anterior foi substituída.`,
    });
  } catch (e: any) {
    console.error('[import/demandas-trabalhistas] error', e);
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
