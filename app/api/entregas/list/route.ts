export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type Row = { id: string; nome: string; funcao: string; unidade: string; regional: string };

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
}
function canonKey(v: any): string {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const noAcc = stripAccents(s).toUpperCase();
  // remove non-alphanum without regex
  let out = '';
  for (let i = 0; i < noAcc.length; i++) {
    const c = noAcc.charCodeAt(i);
    const isDigit = c >= 48 && c <= 57;
    const isUpper = c >= 65 && c <= 90;
    if (isDigit || isUpper) out += noAcc[i];
  }
  return out;
}
function onlyDigits(v: any): string {
  const s = String(v ?? '');
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 48 && c <= 57) out += s[i];
  }
  return out;
}
function normUp(v: any): string {
  const s = String(v ?? '');
  return stripAccents(s).toUpperCase().replace(/\s+/g,' ').trim();
}

async function loadUnidRegionalMap(): Promise<Record<string,string>> {
  try {
    const rows = await prisma.$queryRaw<any[]>`SELECT unidade, regional FROM stg_unid_reg`;
    const map: Record<string,string> = {};
    for (const r of rows) {
      const key = canonKey(r.unidade);
      if (!key) continue;
      // força capitalização padrão
      const reg = String(r.regional || '').trim();
      const regStd = reg ? reg[0].toUpperCase() + reg.slice(1).toLowerCase() : '';
      map[key] = regStd;
    }
    return map;
  } catch {
    return {};
  }
}

async function loadBaseCompat(): Promise<any[]> {
  return await prisma.$queryRaw<any[]>`
    SELECT
      TRIM(COALESCE(cpf::text, '')) AS id,
      TRIM(COALESCE(nome::text, colaborador::text, '')) AS nome,
      TRIM(COALESCE(funcao::text, cargo::text, '')) AS funcao,
      TRIM(COALESCE(unidade::text, lotacao::text, setor::text, hospital::text, '')) AS unidade
    FROM stg_alterdata_v2_compat
  `;
}
async function loadBaseV2(): Promise<any[]> {
  return await prisma.$queryRaw<any[]>`
    SELECT
      TRIM(COALESCE(cpf::text, '')) AS id,
      TRIM(COALESCE(colaborador::text, nome::text, '')) AS nome,
      TRIM(COALESCE(funcao::text, cargo::text, '')) AS funcao,
      TRIM(COALESCE(unidade::text, lotacao::text, setor::text, hospital::text, '')) AS unidade
    FROM stg_alterdata_v2
  `;
}
async function loadManual(): Promise<any[]> {
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

  const unidMap = await loadUnidRegionalMap();

  let base: any[] = [];
  let source = 'compat';
  try {
    base = await loadBaseCompat();
  } catch {
    try {
      base = await loadBaseV2();
      source = 'v2';
    } catch {
      base = [];
      source = 'none';
    }
  }
  const manual = await loadManual();

  const byKey = new Map<string, Row>();

  // coloca manuais primeiro (prioridade)
  for (const r of manual) {
    const idDigits = onlyDigits(r.id);
    const id = idDigits || ''; // pode ser vazio, mas montamos uma chave estável
    const nome = String(r.nome || '');
    const un = String(r.unidade || '');
    // calcula regional com tabela se não vier do manual
    let reg = String(r.regional || '').trim();
    if (!reg) {
      const key = canonKey(un);
      reg = unidMap[key] || '';
    }
    const key = id ? `id:${id}` : `nk:${canonKey(nome)}|${canonKey(un)}`;
    byKey.set(key, { id, nome, funcao: String(r.funcao || ''), unidade: un, regional: reg });
  }

  // insere base, sem sobrescrever manuais
  for (const r of base) {
    const idDigits = onlyDigits(r.id);
    const id = idDigits || '';
    const nome = String(r.nome || '');
    const un = String(r.unidade || '');
    const key = id ? `id:${id}` : `nk:${canonKey(nome)}|${canonKey(un)}`;
    if (byKey.has(key)) continue;
    const reg = unidMap[canonKey(un)] || '';
    byKey.set(key, { id, nome, funcao: String(r.funcao || ''), unidade: un, regional: reg });
  }

  const regUp = normUp(regional);
  const uniUp = normUp(unidade);
  const qUp   = normUp(q);

  let rows: Row[] = Array.from(byKey.values());
  if (regUp) rows = rows.filter(r => normUp(r.regional) === regUp);
  if (uniUp) rows = rows.filter(r => normUp(r.unidade) === uniUp);
  if (qUp)   rows = rows.filter(r => normUp(r.nome).includes(qUp) || normUp(r.id).includes(qUp));

  rows.sort((a,b)=> a.nome.localeCompare(b.nome));
  const total = rows.length;
  const pageRows = rows.slice(offset, offset + pageSize);

  return NextResponse.json({ rows: pageRows, total, page, pageSize, source });
}