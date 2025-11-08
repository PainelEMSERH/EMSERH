export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { UNID_TO_REGIONAL, canonUnidade } from '@/lib/unidReg';

type Row = { id: string; nome: string; funcao: string; unidade: string; regional: string };

function normUp(s: any): string {
  return (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
}

function allDigits(t: string): boolean {
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    if (c < 48 || c > 57) return false;
  }
  return true;
}

function parseDemissao(val: any): Date | null {
  const s = (val ?? '').toString().trim();
  if (!s) return null;
  const first10 = s.slice(0, 10);
  if (first10.length === 10 && first10[4] === '-' && first10[7] === '-') {
    return new Date(first10);
  }
  const parts = s.split(/[^0-9]/).filter(Boolean);
  if (parts.length === 3) {
    const [a,b,c] = parts;
    if (c.length === 4) {
      const dd = a.padStart(2,'0');
      const mm = b.padStart(2,'0');
      return new Date(`${c}-${mm}-${dd}`);
    }
  }
  if (s.length === 8 && allDigits(s)) {
    return new Date(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}`);
  }
  return null;
}

async function getLatestBatchId(): Promise<string | null> {
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

  const latest = await getLatestBatchId();

  let baseRows: any[] = [];
  if (latest) {
    baseRows = await prisma.$queryRaw<any[]>`
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
      )
      SELECT id, nome, funcao, unidade, demissao
      FROM raw
      WHERE id IS NOT NULL AND id <> ''
    `;
  }

  const keptBase = baseRows.filter(r => {
    const d = parseDemissao(r.demissao);
    return !d || d >= new Date('2025-01-01');
  });

  let manualRows: any[] = [];
  try {
    manualRows = await prisma.$queryRaw<any[]>`
      SELECT cpf AS id, nome, funcao, unidade, regional, demissao
      FROM epi_manual_colab
    `;
  } catch {}

  const byId = new Map<string, Row>();

  for (const r of manualRows) {
    const id = String(r.id || '').trim();
    if (!id) continue;
    const d = parseDemissao(r.demissao);
    if (d && d < new Date('2025-01-01')) continue;
    const un = String(r.unidade || '');
    const reg = String(r.regional || (UNID_TO_REGIONAL as any)[canonUnidade(un)] || '');
    byId.set(id, { id, nome: String(r.nome||''), funcao: String(r.funcao||''), unidade: un, regional: reg });
  }

  for (const r of keptBase) {
    const id = String(r.id || '').trim();
    if (!id || byId.has(id)) continue;
    const un = String(r.unidade || '');
    const reg = String((UNID_TO_REGIONAL as any)[canonUnidade(un)] || '');
    byId.set(id, { id, nome: String(r.nome||''), funcao: String(r.funcao||''), unidade: un, regional: reg });
  }

  const regUp = normUp(regional);
  const uniUp = normUp(unidade);
  const qUp   = normUp(q);

  let rows: Row[] = Array.from(byId.values());
  if (regUp) rows = rows.filter(r => normUp(r.regional) === regUp);
  if (uniUp) rows = rows.filter(r => normUp(r.unidade) === uniUp);
  if (qUp)   rows = rows.filter(r => normUp(r.nome).includes(qUp) || normUp(r.id).includes(qUp));

  rows.sort((a,b)=>a.nome.localeCompare(b.nome));
  const total = rows.length;
  const pageRows = rows.slice(offset, offset + pageSize);

  return NextResponse.json({ rows: pageRows, total, page, pageSize, source: latest ? 'v2_raw+manual' : 'manual_only' });
}