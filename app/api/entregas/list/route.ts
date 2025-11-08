export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { UNID_TO_REGIONAL, canonUnidade } from '@/lib/unidReg';

type Row = { id: string; nome: string; funcao: string; unidade: string; regional: string; nome_site?: string | null };

function normUp(s: any): string {
  return (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
}

async function latestBatchId(): Promise<string | null> {
  try {
    const r = await prisma.$queryRaw<{batch_id: string}[]>`
      SELECT batch_id FROM stg_alterdata_v2_imports ORDER BY imported_at DESC LIMIT 1
    `;
    return r?.[0]?.batch_id ?? null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const regional = (url.searchParams.get('regional') || '').trim();
  const unidade  = (url.searchParams.get('unidade')  || '').trim();
  const q        = (url.searchParams.get('q')        || '').trim();
  const page     = Math.max(1, Number(url.searchParams.get('page') || '1'));
  const pageSize = Math.min(200, Math.max(10, Number(url.searchParams.get('pageSize') || '25')));
  const offset   = (page - 1) * pageSize;

  const latest = await latestBatchId();

  // 1) Carrega colaboradores do Alterdata v2_raw (ultimo batch)
  let srcRows: any[] = [];
  if (latest) {
    srcRows = await prisma.$queryRaw<any[]>`
      WITH raw AS (
        SELECT
          COALESCE(
            (SELECT kv.value FROM jsonb_each_text(r.data) kv WHERE upper(kv.key) LIKE '%CPF%' ORDER BY 1 LIMIT 1),
            (SELECT kv.value FROM jsonb_each_text(r.data) kv WHERE upper(kv.key) LIKE '%MATRIC%' ORDER BY 1 LIMIT 1)
          ) AS id,
          (SELECT kv.value FROM jsonb_each_text(r.data) kv WHERE upper(kv.key) LIKE '%NOME%' ORDER BY 1 LIMIT 1) AS nome,
          (SELECT kv.value FROM jsonb_each_text(r.data) kv WHERE (upper(kv.key) LIKE '%FUN%' OR upper(kv.key) LIKE '%CARGO%') ORDER BY 1 LIMIT 1) AS funcao,
          (SELECT kv.value FROM jsonb_each_text(r.data) kv WHERE (upper(kv.key) LIKE '%UNID%' OR upper(kv.key) LIKE '%LOTA%' OR upper(kv.key) LIKE '%HOSP%' OR upper(kv.key) LIKE '%SETOR%') ORDER BY 1 LIMIT 1) AS unidade,
          (SELECT kv.value FROM jsonb_each_text(r.data) kv WHERE upper(kv.key) LIKE '%DEMI%' ORDER BY 1 LIMIT 1) AS demissao
        FROM stg_alterdata_v2_raw r
        WHERE r.batch_id = ${latest}
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
  }

  // 2) Manuais (prioridade)
  let manualRows: any[] = [];
  try {
    manualRows = await prisma.$queryRaw<any[]>`
      SELECT cpf AS id, nome, funcao, unidade, regional, demissao
      FROM epi_manual_colab
    `;
  } catch { manualRows = []; }

  // 3) Monta map por id (manual prioriza) e calcula regional pela unidade quando não vier
  const byId = new Map<string, Row>();

  for (const r of manualRows) {
    const id = String(r.id || '').trim();
    if (!id) continue;
    let keep = true;
    if (r.demissao) {
      const s = String(r.demissao);
      // tenta parsear datas comuns
      let ymd: string | null = null;
      if (/^\\d{4}-\\d{2}-\\d{2}/.test(s)) ymd = s.substring(0,10);
      else if (/^\\d{2}\\/\\d{2}\\/\\d{4}$/.test(s)) { const [dd,mm,yy] = s.split('/'); ymd = `${yy}-${mm}-${dd}`; }
      if (ymd && new Date(ymd) < new Date('2025-01-01')) keep = false;
    }
    if (!keep) continue;
    const un = String(r.unidade || '');
    const reg = String(r.regional || (UNID_TO_REGIONAL as any)[canonUnidade(un)] || '');
    byId.set(id, { id, nome: String(r.nome || ''), funcao: String(r.funcao || ''), unidade: un, regional: reg });
  }

  for (const r of srcRows) {
    const id = String(r.id || '').trim();
    if (!id || byId.has(id)) continue;
    const un = String(r.unidade || '');
    const reg = String((UNID_TO_REGIONAL as any)[canonUnidade(un)] || '');
    byId.set(id, { id, nome: String(r.nome || ''), funcao: String(r.funcao || ''), unidade: un, regional: reg });
  }

  // 4) Aplica filtros regionais/unidade/q no servidor
  const regUp = normUp(regional);
  const uniUp = normUp(unidade);
  const qUp   = normUp(q);

  let rows: Row[] = Array.from(byId.values());
  if (regUp) rows = rows.filter(r => normUp(r.regional) === regUp);
  if (uniUp) rows = rows.filter(r => normUp(r.unidade) === uniUp);
  if (qUp)   rows = rows.filter(r => normUp(r.nome).includes(qUp) || normUp(r.id).includes(qUp));

  // 5) Ordena, pagina e responde
  rows.sort((a,b) => a.nome.localeCompare(b.nome));
  const total = rows.length;
  const pageRows = rows.slice(offset, offset + pageSize);

  return NextResponse.json({ rows: pageRows, total, page, pageSize, source: latest ? 'v2_raw+manual' : 'manual_only' });
}