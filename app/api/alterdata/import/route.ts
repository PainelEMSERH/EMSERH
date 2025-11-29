
export const runtime = 'nodejs';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth, currentUser } from '@clerk/nextjs/server';
import { randomUUID } from 'crypto';

const ROOT_ADMIN_EMAIL = 'jonathan.alves@emserh.ma.gov.br';

async function requireRootAdmin() {
  const { userId } = await auth();
  if (!userId) {
    throw new Error('UNAUTHENTICATED');
  }
  const user = await currentUser();
  const email = (user?.primaryEmailAddress?.emailAddress || '').toLowerCase();
  if (email !== ROOT_ADMIN_EMAIL) {
    throw new Error('FORBIDDEN');
  }
  return { userId, email };
}

async function ensureSetup(){
  const stmts = [
    `CREATE EXTENSION IF NOT EXISTS pgcrypto`,
    `CREATE TABLE IF NOT EXISTS stg_alterdata_v2_raw (
      id BIGSERIAL PRIMARY KEY,
      batch_id UUID NOT NULL,
      row_no INTEGER NOT NULL,
      data JSONB NOT NULL,
      source_file TEXT,
      imported_by TEXT,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS stg_alterdata_v2_imports (
      batch_id UUID PRIMARY KEY,
      source_file TEXT,
      total_rows INTEGER,
      imported_by TEXT,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS stg_alterdata_v2 (
      cpf TEXT,
      matricula TEXT,
      colaborador TEXT,
      unidade_hospitalar TEXT,
      cidade TEXT,
      funcao TEXT,
      estado_civil TEXT,
      sexo TEXT,
      telefone TEXT,
      data_nascimento TEXT,
      admissao TEXT,
      demissao TEXT,
      data_atestado TEXT,
      proximo_aso TEXT,
      mes_ultimo_aso TEXT,
      tipo_aso TEXT,
      periodicidade TEXT,
      status_aso TEXT,
      nome_medico TEXT,
      inicio_afastamento TEXT,
      fim_afastamento TEXT,
      celular TEXT,
      last_batch_id UUID,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS ux_stg_alterdata_v2_cpf_matricula ON stg_alterdata_v2 (cpf, matricula)`,
    `CREATE OR REPLACE FUNCTION apply_alterdata_v2_batch(p_batch UUID)
     RETURNS VOID AS $$
     BEGIN
       INSERT INTO stg_alterdata_v2 (
         cpf, matricula, colaborador, unidade_hospitalar, funcao, admissao, demissao, last_batch_id, updated_at
       )
       SELECT
         regexp_replace(data->>'CPF', '[^0-9]', '', 'g') as cpf,
         COALESCE(NULLIF(data->>'Matrícula',''), md5(COALESCE(data->>'Colaborador',''))) as matricula,
         data->>'Colaborador' as colaborador,
         data->>'Unidade Hospitalar' as unidade_hospitalar,
         data->>'Função' as funcao,
         data->>'Admissão' as admissao,
         data->>'Demissão' as demissao,
         batch_id,
         now()
       FROM stg_alterdata_v2_raw
       WHERE batch_id = p_batch
       ON CONFLICT (cpf, matricula) DO UPDATE SET
         colaborador = EXCLUDED.colaborador,
         unidade_hospitalar = EXCLUDED.unidade_hospitalar,
         funcao = EXCLUDED.funcao,
         admissao = EXCLUDED.admissao,
         demissao = EXCLUDED.demissao,
         last_batch_id = EXCLUDED.last_batch_id,
         updated_at = now();
     END;
     $$ LANGUAGE plpgsql`,
    `CREATE OR REPLACE VIEW stg_alterdata_v2_compat AS
     SELECT
       cpf::text AS cpf,
       matricula::text AS matricula,
       COALESCE(colaborador,'') AS colaborador,
       COALESCE(funcao,'') AS funcao,
       COALESCE(unidade_hospitalar,'') AS unidade_hospitalar,
       CASE
         WHEN admissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN to_date(admissao,'YYYY-MM-DD')
         WHEN admissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(admissao,'DD/MM/YYYY')
         ELSE NULL
       END AS admissao,
       CASE
         WHEN demissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN to_date(demissao,'YYYY-MM-DD')
         WHEN demissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(demissao,'DD/MM/YYYY')
         ELSE NULL
       END AS demissao,
       last_batch_id, updated_at
     FROM stg_alterdata_v2`
  ];
  for (const s of stmts){
    await prisma.$executeRawUnsafe(s);
  }
}

function parseCSV(text: string): { headers: string[]; rows: Record<string,string>[] } {
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const parseLine = (line: string) => {
    const out: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i=0;i<line.length;i++){
      const ch = line[i];
      if (ch === '"'){
        if (inQ && line[i+1] === '"'){ cur+='"'; i++; }
        else inQ = !inQ;
      } else if (ch === ',' && !inQ){
        out.push(cur); cur='';
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
    const o: Record<string,string> = {};
    headers.forEach((h, i) => { o[h] = (cells[i] ?? '').trim(); });
    return o;
  });
  return { headers, rows };
}

export async function POST(req: Request) {
  try{
    const { email } = await requireRootAdmin();
    const form = await req.formData();
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ ok:false, error:'Envie um arquivo .xlsx ou .csv' }, { status:400 });

    const filename = (file.name || 'alterdata').toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());

    await ensureSetup();

    let rows: any[] = [];
    if (filename.endsWith('.xlsx')) {
      try{
        const xlsx = await import('xlsx');
        const wb = xlsx.read(buf, {type:'buffer'});
        const sheet = wb.Sheets[wb.SheetNames[0]];
        rows = xlsx.utils.sheet_to_json(sheet, { defval:'' });
      }catch(e:any){
        return NextResponse.json({ ok:false, error:'Para .xlsx é preciso ter a dependência "xlsx". Salve como CSV UTF-8 e tente novamente.' }, { status:400 });
      }
    } else {
      const text = buf.toString('utf8');
      const parsed = parseCSV(text);
      rows = parsed.rows;
    }

    if (!rows.length) return NextResponse.json({ ok:false, error:'Arquivo vazio' }, { status:400 });

    const batchId = randomUUID();
    const source = file.name || 'upload';
    const user = email || 'admin';
    let inserted = 0;

    const chunk = 800;
    for (let i=0;i<rows.length;i+=chunk){
      const part = rows.slice(i, i+chunk);
      const values = part.map((r, idx) => {
        const rowNo = i + idx + 1;
        const json = JSON.stringify(r).replace(/'/g, "''");
        return `('${batchId}'::uuid, ${rowNo}, '${json}'::jsonb, '${source}', '${user}')`;
      }).join(',\n');
      const sql = `INSERT INTO stg_alterdata_v2_raw (batch_id, row_no, data, source_file, imported_by) VALUES ${values}`;
      await prisma.$executeRawUnsafe(sql);
      inserted += part.length;
    }

    await prisma.$executeRawUnsafe(`
      INSERT INTO stg_alterdata_v2_imports (batch_id, source_file, total_rows, imported_by)
      VALUES ('${batchId}'::uuid, '${source}', ${inserted}, '${user}')
      ON CONFLICT (batch_id) DO NOTHING
    `);

    await prisma.$executeRawUnsafe(`SELECT apply_alterdata_v2_batch('${batchId}'::uuid)`);

    // Audit log
    try {
      await prisma.auditLog.create({
        data: {
          actorId: user,
          action: 'alterdata_import',
          entity: 'stg_alterdata_v2',
          entityId: batchId,
          diff: {
            source,
            totalRows: inserted,
          } as any,
        },
      });
    } catch (e) {
      console.error('[alterdata/import] failed to write AuditLog', e);
    }

    return NextResponse.json({ ok:true, batchId, total_rows: inserted });
  }catch(e:any){
    console.error('[alterdata/import] error', e);
    return NextResponse.json({ ok:false, error: String(e?.message || e) }, { status:500 });
  }
}
