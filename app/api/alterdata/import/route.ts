
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
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
  const email =
    user?.primaryEmailAddress?.emailAddress?.toLowerCase() || '';
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
    // Cria view materializada otimizada para carregamento rápido
    `CREATE MATERIALIZED VIEW IF NOT EXISTS mv_alterdata_v2_raw_flat AS
     SELECT 
       r.row_no,
       r.batch_id,
       r.imported_at,
       r.data->>'CPF' as cpf,
       r.data->>'Matrícula' as matricula,
       r.data->>'Colaborador' as colaborador,
       r.data->>'Unidade Hospitalar' as unidade_hospitalar,
       r.data->>'Função' as funcao,
       r.data->>'Admissão' as admissao,
       r.data->>'Demissão' as demissao,
       r.data->>'Nmdepartamento' as nmdepartamento,
       r.data->>'Cdchamada' as cdchamada,
       r.data as data_jsonb
     FROM stg_alterdata_v2_raw r`,
    `CREATE INDEX IF NOT EXISTS idx_mv_alterdata_raw_flat_batch ON mv_alterdata_v2_raw_flat (batch_id)`,
    `CREATE INDEX IF NOT EXISTS idx_mv_alterdata_raw_flat_row_no ON mv_alterdata_v2_raw_flat (row_no)`,
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
         cpf, matricula, colaborador, unidade_hospitalar, cidade, funcao, estado_civil, sexo,
         telefone, data_nascimento, admissao, demissao, data_atestado, proximo_aso,
         mes_ultimo_aso, tipo_aso, periodicidade, status_aso, nome_medico,
         inicio_afastamento, fim_afastamento, celular, last_batch_id, updated_at
       )
       SELECT
         CASE 
           WHEN regexp_replace(COALESCE(
             data->>'CPF', data->>'Cpf', data->>'cpf',
             data->>'NrCPF', data->>'Nrcpf', data->>'nrcpf',
             data->>'Nr CPF', data->>'nr cpf',
             ''
           ), '[^0-9]', '', 'g') != '' 
           THEN regexp_replace(COALESCE(
             data->>'CPF', data->>'Cpf', data->>'cpf',
             data->>'NrCPF', data->>'Nrcpf', data->>'nrcpf',
             data->>'Nr CPF', data->>'nr cpf'
           ), '[^0-9]', '', 'g')
           ELSE 'SEM_CPF_' || lpad(row_no::text, 10, '0')
         END as cpf,
         COALESCE(
           NULLIF(TRIM(COALESCE(
             data->>'Matrícula', data->>'Matricula', data->>'matricula',
             data->>'CdChamada', data->>'Cdchamada', data->>'cdchamada',
             data->>'Cd Chamada', data->>'cd chamada',
             data->>'Chamada', data->>'chamada',
             ''
           )), ''),
           md5(COALESCE(
             data->>'Colaborador', data->>'Nome', data->>'colaborador',
             data->>'NmFuncionario', data->>'Nmfuncionario', data->>'nmfuncionario',
             data->>'Nm Funcionario', data->>'nm funcionario',
             ''
           ) || '|' || row_no::text)
         ) as matricula,
         COALESCE(NULLIF(TRIM(COALESCE(
           data->>'Colaborador', data->>'Nome', data->>'colaborador',
           data->>'NmFuncionario', data->>'Nmfuncionario', data->>'nmfuncionario',
           data->>'Nm Funcionario', data->>'nm funcionario',
           ''
         )), ''), 'SEM_NOME_' || row_no::text) as colaborador,
         COALESCE(NULLIF(TRIM(COALESCE(
           data->>'Unidade Hospitalar', data->>'Unidade', data->>'unidade_hospitalar',
           data->>'nmdepartamento', data->>'Nmdepartamento', data->>'NmDepartamento',
           data->>'Nm Departamento', data->>'nm departamento',
           data->>'Departamento', data->>'departamento',
           ''
         )), ''), '') as unidade_hospitalar,
         NULLIF(TRIM(COALESCE(
           data->>'Cidade', data->>'cidade',
           data->>'nmcidade', data->>'Nmcidade', data->>'NmCidade',
           data->>'Nm Cidade', data->>'nm cidade',
           ''
         )), '') as cidade,
         COALESCE(NULLIF(TRIM(COALESCE(
           data->>'Função', data->>'Funcao', data->>'Cargo', data->>'funcao',
           data->>'nmfuncao', data->>'Nmfuncao', data->>'NmFuncao',
           data->>'Nm Funcao', data->>'nm funcao',
           ''
         )), ''), '') as funcao,
         NULLIF(TRIM(COALESCE(
           data->>'Estado Civil', data->>'estado_civil',
           data->>'TpEstadoCivil', data->>'Tpestadocivil', data->>'tpestadocivil',
           data->>'Tp Estado Civil', data->>'tp estado civil',
           ''
         )), '') as estado_civil,
         NULLIF(TRIM(COALESCE(
           data->>'Sexo', data->>'sexo',
           data->>'TpSexo', data->>'Tpsexo', data->>'tpsexo',
           data->>'Tp Sexo', data->>'tp sexo',
           ''
         )), '') as sexo,
         NULLIF(TRIM(COALESCE(
           data->>'Telefone', data->>'telefone',
           data->>'NrTelefone', data->>'Nrtelefone', data->>'nrtelefone',
           data->>'Nr Telefone', data->>'nr telefone',
           ''
         )), '') as telefone,
         NULLIF(TRIM(COALESCE(
           data->>'Data Nascimento', data->>'data_nascimento',
           data->>'DtNascimento', data->>'Dtnascimento', data->>'dtnascimento',
           data->>'Dt Nascimento', data->>'dt nascimento',
           data->>'Nascimento', data->>'nascimento',
           ''
         )), '') as data_nascimento,
         NULLIF(TRIM(COALESCE(
           data->>'Admissão', data->>'Admissao', data->>'admissao',
           data->>'DtAdmissao', data->>'Dtadmissao', data->>'dtadmissao',
           data->>'Dt Admissao', data->>'dt admissao',
           ''
         )), '') as admissao,
         NULLIF(TRIM(COALESCE(
           data->>'Demissão', data->>'Demissao', data->>'demissao',
           data->>'DtDemissao', data->>'Dtdemissao', data->>'dtdemissao',
           data->>'Dt Demissao', data->>'dt demissao',
           ''
         )), '') as demissao,
         NULLIF(TRIM(COALESCE(
           data->>'Data Atestado', data->>'data_atestado',
           data->>'Data_Atestado', data->>'Data_atestado', data->>'data_Atestado',
           data->>'Data Atestado', data->>'data atestado',
           ''
         )), '') as data_atestado,
         NULLIF(TRIM(COALESCE(
           data->>'Próximo ASO', data->>'proximo_aso',
           data->>'Proximo_aso', data->>'Proximo_ASO', data->>'proximo_ASO',
           data->>'Próximo ASO', data->>'proximo aso',
           ''
         )), '') as proximo_aso,
         NULLIF(TRIM(COALESCE(
           data->>'Mês Último ASO', data->>'mes_ultimo_aso',
           data->>'N_MES_ULTIMO_ASO', data->>'N_Mes_Ultimo_ASO', data->>'n_mes_ultimo_aso',
           data->>'N MES ULTIMO ASO', data->>'n mes ultimo aso',
           ''
         )), '') as mes_ultimo_aso,
         NULLIF(TRIM(COALESCE(
           data->>'Tipo ASO', data->>'tipo_aso',
           data->>'Tipo_ASO', data->>'Tipo_Aso', data->>'tipo_Aso',
           data->>'Tipo ASO', data->>'tipo aso',
           ''
         )), '') as tipo_aso,
         NULLIF(TRIM(COALESCE(
           data->>'Periodicidade', data->>'periodicidade',
           data->>'periodicidade', data->>'Periodicidade',
           ''
         )), '') as periodicidade,
         NULLIF(TRIM(COALESCE(
           data->>'Status ASO', data->>'status_aso',
           data->>'Status_ASO', data->>'Status_Aso', data->>'status_Aso',
           data->>'Status ASO', data->>'status aso',
           ''
         )), '') as status_aso,
         NULLIF(TRIM(COALESCE(
           data->>'Nome Médico', data->>'nome_medico',
           data->>'Nome_Medico', data->>'Nome_medico', data->>'nome_Medico',
           data->>'Nome Médico', data->>'nome medico',
           ''
         )), '') as nome_medico,
         NULLIF(TRIM(COALESCE(
           data->>'Início Afastamento', data->>'inicio_afastamento',
           data->>'Início Afastamento', data->>'Inicio_Afastamento', data->>'inicio_Afastamento',
           data->>'Início Afastamento', data->>'inicio afastamento',
           ''
         )), '') as inicio_afastamento,
         NULLIF(TRIM(COALESCE(
           data->>'Fim Afastamento', data->>'fim_afastamento',
           data->>'Fim_Afastamento', data->>'Fim_afastamento', data->>'fim_Afastamento',
           data->>'Fim Afastamento', data->>'fim afastamento',
           ''
         )), '') as fim_afastamento,
         NULLIF(TRIM(COALESCE(
           data->>'Celular', data->>'celular',
           data->>'NrCelular', data->>'Nrcelular', data->>'nrcelular',
           data->>'Nr Celular', data->>'nr celular',
           ''
         )), '') as celular,
         batch_id,
         now()
       FROM stg_alterdata_v2_raw
       WHERE batch_id = p_batch
       ON CONFLICT (cpf, matricula) DO UPDATE SET
         colaborador = EXCLUDED.colaborador,
         unidade_hospitalar = EXCLUDED.unidade_hospitalar,
         cidade = EXCLUDED.cidade,
         funcao = EXCLUDED.funcao,
         estado_civil = EXCLUDED.estado_civil,
         sexo = EXCLUDED.sexo,
         telefone = EXCLUDED.telefone,
         data_nascimento = EXCLUDED.data_nascimento,
         admissao = EXCLUDED.admissao,
         demissao = EXCLUDED.demissao,
         data_atestado = EXCLUDED.data_atestado,
         proximo_aso = EXCLUDED.proximo_aso,
         mes_ultimo_aso = EXCLUDED.mes_ultimo_aso,
         tipo_aso = EXCLUDED.tipo_aso,
         periodicidade = EXCLUDED.periodicidade,
         status_aso = EXCLUDED.status_aso,
         nome_medico = EXCLUDED.nome_medico,
         inicio_afastamento = EXCLUDED.inicio_afastamento,
         fim_afastamento = EXCLUDED.fim_afastamento,
         celular = EXCLUDED.celular,
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

    // Verifica se deve limpar antes de importar
    const clearBeforeImport = form.get('clearBeforeImport') === 'true';

    const filename = (file.name || 'alterdata').toLowerCase();
    const buf = Buffer.from(await file.arrayBuffer());

    await ensureSetup();

    // Limpa as tabelas antes de importar se solicitado
    if (clearBeforeImport) {
      console.log('[alterdata/import] Limpando tabelas antes de importar...');
      // Ordem: imports, raw, v2 — evita "último lote" apontar para dados apagados
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE stg_alterdata_v2_imports CASCADE`);
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE stg_alterdata_v2_raw CASCADE`);
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE stg_alterdata_v2 CASCADE`);
      console.log('[alterdata/import] Tabelas limpas com sucesso');
    }

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

// Atualiza view materializada otimizada (se existir) para carregamento rápido
try {
  await prisma.$executeRawUnsafe(`
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_alterdata_v2_raw_flat;
    ANALYZE mv_alterdata_v2_raw_flat;
  `);
} catch (e) {
  // View ainda não existe, ignora erro (será criada na primeira vez)
  console.log('View materializada ainda não existe, será criada na próxima vez');
}

try {
  await prisma.$executeRawUnsafe(`
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_alterdata_flat;
    ANALYZE mv_alterdata_flat;
  `);
} catch {
  // mv_alterdata_flat pode não existir em todos os ambientes
}

// Audit log da importação
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

return NextResponse.json({
  ok: true,
  batchId,
  total_rows: inserted,
  cleared: clearBeforeImport,
  message: clearBeforeImport
    ? 'Base Alterdata limpa e reimportada. Ordens de Serviço (lista) refletem a planilha; lançamentos de OS já feitos foram preservados.'
    : 'Base Alterdata atualizada (merge por CPF/matrícula).',
});

  }catch(e:any){
    console.error('[alterdata/import] error', e);
    return NextResponse.json({ ok:false, error: String(e?.message || e) }, { status:500 });
  }
}
