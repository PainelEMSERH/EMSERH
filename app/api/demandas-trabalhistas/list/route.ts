import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { ensureDemandasTrabalhistasTables } from '@/lib/demandas-trabalhistas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function monthShortPtFromISO(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const s = String(iso).trim();
  if (!s) return null;
  const base = /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
  const d = new Date(`${base}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const raw = new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(d);
  return raw.replace('.', '').toUpperCase();
}

function convertBigIntToNumber(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (Array.isArray(obj)) return obj.map(convertBigIntToNumber);
  if (typeof obj === 'object') {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToNumber(value);
    }
    return converted;
  }
  return obj;
}

const SORT_MAP: Record<string, string> = {
  numeroSei: 'numero_sei',
  demandante: 'demandante',
  tipoDemanda: 'tipo_demanda',
  origem: 'origem',
  unidade: 'unidade',
  setor: 'setor',
  funcao: 'funcao',
  regional: 'regional',
  dataChegada: 'data_chegada',
  responsavel: 'responsavel',
  status: 'status',
  prazoDias: 'prazo_dias',
  dataLimite: 'data_limite',
  dataConclusao: 'data_conclusao',
  destino: 'destino',
  statusFinal: 'status_final',
  tempoRespostaDias: 'tempo_resposta_dias',
};

export async function GET(req: NextRequest) {
  try {
    await ensureDemandasTrabalhistasTables();

    const url = new URL(req.url);
    const regional = (url.searchParams.get('regional') || '').trim();
    const unidade = (url.searchParams.get('unidade') || '').trim();
    const tipoDemanda = (url.searchParams.get('tipoDemanda') || '').trim();
    const status = (url.searchParams.get('status') || '').trim();
    const statusFinal = (url.searchParams.get('statusFinal') || '').trim();
    const responsavel = (url.searchParams.get('responsavel') || '').trim();
    const search = (url.searchParams.get('search') || '').trim();
    const ano = (url.searchParams.get('ano') || '2026').trim();
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const pageSize = Math.min(200, Math.max(10, parseInt(url.searchParams.get('pageSize') || '25', 10)));
    const sortBy = url.searchParams.get('sortBy') || 'dataChegada';
    const sortDir = (url.searchParams.get('sortDir') || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const offset = (page - 1) * pageSize;

    const wh: string[] = ['1=1'];
    if (regional) wh.push(`regional = '${regional.replace(/'/g, "''")}'`);
    if (unidade) wh.push(`unidade = '${unidade.replace(/'/g, "''")}'`);
    if (tipoDemanda) wh.push(`tipo_demanda = '${tipoDemanda.replace(/'/g, "''")}'`);
    if (status) wh.push(`status = '${status.replace(/'/g, "''")}'`);
    if (statusFinal) wh.push(`status_final = '${statusFinal.replace(/'/g, "''")}'`);
    if (responsavel) wh.push(`responsavel = '${responsavel.replace(/'/g, "''")}'`);
    if (ano && /^\d{4}$/.test(ano)) wh.push(`ano_chegada = ${Number(ano)}`);
    if (search) {
      const term = search.replace(/'/g, "''");
      wh.push(`(
        numero_sei ILIKE '%${term}%'
        OR demandante ILIKE '%${term}%'
      )`);
    }

    const whereSql = `WHERE ${wh.join(' AND ')}`;
    const orderBy = SORT_MAP[sortBy] || 'data_chegada';

    const rowsSql = `
      SELECT
        id,
        COALESCE(numero_sei, '') AS "numeroSei",
        COALESCE(demandante, '') AS demandante,
        COALESCE(tipo_demanda, '') AS "tipoDemanda",
        COALESCE(origem, '') AS origem,
        COALESCE(unidade, '') AS unidade,
        COALESCE(setor, '') AS setor,
        COALESCE(funcao, '') AS funcao,
        COALESCE(insal_iadvh, '') AS "insalIadvh",
        COALESCE(insal_emserh, '') AS "insalEmserh",
        COALESCE(regional, '') AS regional,
        data_chegada::text AS "dataChegada",
        COALESCE(mes_chegada, '') AS "mesChegada",
        ano_chegada AS "anoChegada",
        COALESCE(responsavel, '') AS responsavel,
        COALESCE(status, '') AS status,
        prazo_dias AS "prazoDias",
        data_limite::text AS "dataLimite",
        data_conclusao::text AS "dataConclusao",
        COALESCE(mes_conclusao, '') AS "mesConclusao",
        COALESCE(destino, '') AS destino,
        COALESCE(status_final, '') AS "statusFinal",
        tempo_resposta_dias AS "tempoRespostaDias",
        COALESCE(observacoes, '') AS observacoes
      FROM demandas_trabalhistas
      ${whereSql}
      ORDER BY ${orderBy} ${sortDir}, id DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM demandas_trabalhistas
      ${whereSql}
    `;

    const [rows, totalRes] = await Promise.all([
      prisma.$queryRawUnsafe<any[]>(rowsSql),
      prisma.$queryRawUnsafe<any[]>(countSql),
    ]);

    const safeRows = convertBigIntToNumber(Array.isArray(rows) ? rows : []);
    const safeTotal = convertBigIntToNumber(totalRes);
    const patchedRows = (Array.isArray(safeRows) ? safeRows : []).map((r: any) => {
      const mes = String(r?.mesConclusao ?? '').trim();
      if (mes) return r;
      const auto = monthShortPtFromISO(r?.dataConclusao ?? null);
      return auto ? { ...r, mesConclusao: auto } : r;
    });

    return NextResponse.json({
      ok: true,
      rows: patchedRows,
      totalCount: Number(safeTotal?.[0]?.total ?? 0),
    });
  } catch (e: any) {
    console.error('[demandas-trabalhistas/list] error', e);
    return NextResponse.json(
      { ok: false, error: String(e?.message || e), rows: [], totalCount: 0 },
      { status: 500 }
    );
  }
}
