export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { UNID_TO_REGIONAL, canonUnidade } from '@/lib/unidReg';

type Row = { id: string; nome: string; funcao: string; unidade: string; regional: string; nome_site?: string | null };

function normUp(s: any): string {
  return (s ?? '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ').trim();
}

async function fetchFromCompat(): Promise<any[]> {
  return await prisma.$queryRaw<any[]>`
    SELECT
      TRIM(COALESCE(cpf::text, '')) AS id,
      TRIM(COALESCE(nome::text, colaborador::text, '')) AS nome,
      TRIM(COALESCE(funcao::text, cargo::text, '')) AS funcao,
      TRIM(COALESCE(unidade::text, lotacao::text, setor::text, hospital::text, '')) AS unidade
    FROM stg_alterdata_v2_compat
  `;
}

async function fetchFromV2(): Promise<any[]> {
  return await prisma.$queryRaw<any[]>`
    SELECT
      TRIM(COALESCE(cpf::text, '')) AS id,
      TRIM(COALESCE(colaborador::text, nome::text, '')) AS nome,
      TRIM(COALESCE(funcao::text, cargo::text, '')) AS funcao,
      TRIM(COALESCE(unidade::text, lotacao::text, setor::text, hospital::text, '')) AS unidade
    FROM stg_alterdata_v2
  `;
}

async function fetchManual(): Promise<any[]> {
  try {
    return await prisma.$queryRaw<any[]>`
      SELECT TRIM(cpf::text) AS id,
             TRIM(nome::text) AS nome,
             TRIM(COALESCE(funcao::text, '')) AS funcao,
             TRIM(COALESCE(unidade::text, '')) AS unidade,
             TRIM(COALESCE(regional::text, '')) AS regional
      FROM epi_manual_colab
    `;
  } catch {
    return [];
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

  let base: any[] = [];
  let source = 'compat';
  try {
    base = await fetchFromCompat();
  } catch {
    try {
      base = await fetchFromV2();
      source = 'v2';
    } catch {
      base = [];
      source = 'none';
    }
  }
  const manual = await fetchManual();

  const byId = new Map<string, Row>();

  for (const r of manual) {
    const id = String(r.id || '').replace(/\D/g,'').slice(-11);
    if (!id) continue;
    const un = String(r.unidade || '');
    const reg = String(r.regional || (UNID_TO_REGIONAL as any)[canonUnidade(un)] || '');
    byId.set(id, { id, nome: String(r.nome || ''), funcao: String(r.funcao || ''), unidade: un, regional: reg });
  }

  for (const r of base) {
    const id = String(r.id || '').replace(/\D/g,'').slice(-11);
    if (!id || byId.has(id)) continue;
    const un = String(r.unidade || '');
    const reg = String((UNID_TO_REGIONAL as any)[canonUnidade(un)] || '');
    byId.set(id, { id, nome: String(r.nome || ''), funcao: String(r.funcao || ''), unidade: un, regional: reg });
  }

  const regUp = normUp(regional);
  const uniUp = normUp(unidade);
  const qUp   = normUp(q);

  let rows: Row[] = Array.from(byId.values());
  if (regUp) rows = rows.filter(r => normUp(r.regional) === regUp);
  if (uniUp) rows = rows.filter(r => normUp(r.unidade) === uniUp);
  if (qUp)   rows = rows.filter(r => normUp(r.nome).includes(qUp) || normUp(r.id).includes(qUp));

  rows.sort((a,b)=> a.nome.localeCompare(b.nome));
  const total = rows.length;
  const pageRows = rows.slice(offset, offset + pageSize);

  return NextResponse.json({ rows: pageRows, total, page, pageSize, source });
}