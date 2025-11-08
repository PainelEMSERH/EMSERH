export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { UNID_TO_REGIONAL, canonUnidade } from '@/lib/unidReg';

type Row = { id: string; nome: string; funcao: string; unidade: string; regional: string; nome_site?: string | null; };

// Helper: normalize string
function norm(s: any): string {
  return (s ?? '')
    .toString()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase().trim().replace(/\s+/g, ' ');
}

// Load expected kit per função once
async function loadKitMap(): Promise<Record<string, string>> {
  try{
    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT alterdata_funcao AS func, string_agg(DISTINCT nome_site, ',') AS kit
      FROM stg_epi_map
      GROUP BY alterdata_funcao
    `);
    const map: Record<string,string> = {};
    for(const r of rows){
      const k = norm(r.func);
      if (k) map[k] = r.kit || '';
    }
    return map;
  }catch{
    return {};
  }
}

// Get latest batch_id for v2 raw
async function latestBatchId(): Promise<string | null> {
  try{
    const r: any[] = await prisma.$queryRawUnsafe(`
      SELECT batch_id FROM stg_alterdata_v2_imports ORDER BY imported_at DESC LIMIT 1
    `);
    return r?.[0]?.batch_id ?? null;
  }catch{
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const regional = (searchParams.get('regional') || '').trim();
  const unidade  = (searchParams.get('unidade')  || '').trim();
  const q        = (searchParams.get('q')        || '').trim();
  const page     = Math.max(1, Number(searchParams.get('page') || '1'));
  const pageSize = Math.min(200, Math.max(10, Number(searchParams.get('pageSize') || '25')));
  const offset   = (page - 1) * pageSize;

  // Load kit map
  const kitMap = await loadKitMap();
  const latest = await latestBatchId();

  // Query raw v2 and project essential fields
  let srcRows: any[] = [];
  if (latest) {
    const sql = `
      WITH raw AS (
        SELECT
          -- prefer CPF, fallback Matricula
          COALESCE(
            (SELECT kv.value FROM jsonb_each_text(r.data) kv WHERE upper(kv.key) LIKE '%CPF%' ORDER BY 1 LIMIT 1),
            (SELECT kv.value FROM jsonb_each_text(r.data) kv WHERE upper(kv.key) LIKE '%MATRIC%' ORDER BY 1 LIMIT 1)
          ) AS id,
          (SELECT kv.value FROM jsonb_each_text(r.data) kv WHERE upper(kv.key) LIKE '%NOME%' ORDER BY 1 LIMIT 1) AS nome,
          (SELECT kv.value FROM jsonb_each_text(r.data) kv WHERE (upper(kv.key) LIKE '%FUN%' OR upper(kv.key) LIKE '%CARGO%') ORDER BY 1 LIMIT 1) AS funcao,
          (SELECT kv.value FROM jsonb_each_text(r.data) kv WHERE (upper(kv.key) LIKE '%UNID%' OR upper(kv.key) LIKE '%LOTA%' OR upper(kv.key) LIKE '%HOSP%' OR upper(kv.key) LIKE '%SETOR%') ORDER BY 1 LIMIT 1) AS unidade,
          (SELECT kv.value FROM jsonb_each_text(r.data) kv WHERE upper(kv.key) LIKE '%DEMI%' ORDER BY 1 LIMIT 1) AS demissao
        FROM stg_alterdata_v2_raw r
        WHERE r.batch_id = $1
      ),
      norm AS (
        SELECT
          id, nome, funcao, unidade,
          CASE 
            WHEN demissao ~ '^\\d{4}-\\d{2}-\\d{2}' THEN (substring(demissao from 1 for 10))::date
            WHEN demissao ~ '^\\d{2}/\\d{2}/\\d{4}' THEN to_date(demissao, 'DD/MM/YYYY')
            WHEN demissao ~ '^\\d{8}$' THEN to_date(demissao, 'YYYYMMDD')
            ELSE NULL
          END AS dem_data
        FROM raw
      )
      SELECT id, nome, funcao, unidade
      FROM norm
      WHERE id IS NOT NULL AND id <> ''
        AND (dem_data IS NULL OR dem_data >= DATE '2025-01-01')
    `;
    srcRows = await prisma.$queryRawUnsafe(sql, latest);
  }

  // Manual entries
  let manualRows: any[] = [];
  try{
    manualRows = await prisma.$queryRawUnsafe(`
      SELECT cpf AS id, nome, funcao, unidade, regional
      FROM epi_manual_colab
      WHERE cpf IS NOT NULL AND cpf <> ''
        AND (demissao IS NULL OR demissao >= DATE '2025-01-01')
    `);
  }catch{}

  // Merge manual ∪ src (manual priority by id)
  const byId = new Map<string, Row>();
  for(const r of manualRows){
    const id = String(r.id || '').trim();
    if (!id) continue;
    const un = String(r.unidade || '');
    const reg = r.regional ? String(r.regional) : (UNID_TO_REGIONAL[canonUnidade(un)] || '');
    byId.set(id, {
      id,
      nome: String(r.nome||''),
      funcao: String(r.funcao||''),
      unidade: un,
      regional: reg,
      nome_site: kitMap[norm(r.funcao)] || null,
    });
  }
  for(const r of srcRows){
    const id = String(r.id || '').trim();
    if (!id || byId.has(id)) continue;
    const un = String(r.unidade || '');
    const reg = UNID_TO_REGIONAL[canonUnidade(un)] || '';
    byId.set(id, {
      id,
      nome: String(r.nome||''),
      funcao: String(r.funcao||''),
      unidade: un,
      regional: reg,
      nome_site: kitMap[norm(r.funcao)] || null,
    });
  }

  // Now apply filters (regional/unidade/q)
  let rows: Row[] = Array.from(byId.values());
  if (regional) {
    const regUp = norm(regional);
    rows = rows.filter(r => norm(r.regional) === regUp);
  }
  if (unidade) {
    const uniUp = norm(unidade);
    rows = rows.filter(r => norm(r.unidade) === uniUp);
  }
  if (q) {
    const nq = norm(q);
    rows = rows.filter(r => norm(r.nome).includes(nq) || norm(r.id).includes(nq));
  }

  const total = rows.length;
  const pageRows = rows.slice(offset, offset + pageSize);

  return NextResponse.json({ rows: pageRows, total, page, pageSize, source: latest ? 'v2_raw' : 'manual_only' });
}