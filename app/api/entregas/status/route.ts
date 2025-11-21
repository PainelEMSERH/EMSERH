
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

const ANO_REFERENCIA = 2025;

type StatusCode =
  | 'ATIVO'
  | 'FERIAS'
  | 'INSS'
  | 'LICENCA_MATERNIDADE'
  | 'DEMITIDO_2025_SEM_EPI'
  | 'EXCLUIDO_META';

const STATUS_ALLOWED: StatusCode[] = [
  'ATIVO',
  'FERIAS',
  'INSS',
  'LICENCA_MATERNIDADE',
  'DEMITIDO_2025_SEM_EPI',
  'EXCLUIDO_META',
];

function cleanCpf(v: any): string {
  return String(v || '').replace(/\D/g, '').slice(-11);
}

async function ensureTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS epi_colab_status (
        cpf_limpo       varchar(11) NOT NULL,
        ano_referencia  integer NOT NULL DEFAULT 2025,
        status          varchar(40) NOT NULL,
        observacao      varchar(100),
        updated_at      timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (cpf_limpo, ano_referencia)
      )
    `);
  } catch (e) {
    console.error('ensureTable epi_colab_status error', e);
  }
}

export async function GET(req: Request) {
  await ensureTable();
  const url = new URL(req.url);
  const idsParam = url.searchParams.get('ids') || '';
  const ids = Array.from(
    new Set(
      idsParam
        .split(',')
        .map((s) => cleanCpf(s))
        .filter(Boolean),
    ),
  );

  if (!ids.length) {
    return NextResponse.json({ rows: [] });
  }

  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `
      SELECT cpf_limpo, status, observacao
      FROM epi_colab_status
      WHERE ano_referencia = $1
        AND cpf_limpo = ANY($2::text[])
      `,
      ANO_REFERENCIA,
      ids,
    );
    return NextResponse.json({ rows });
  } catch (e: any) {
    console.error('GET /api/entregas/status error', e);
    return NextResponse.json(
      { rows: [], error: e?.message || String(e) },
      { status: 200 },
    );
  }
}

export async function POST(req: Request) {
  await ensureTable();
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const cpf = cleanCpf(body.cpf);
  const statusRaw = (body.status || '').toString().toUpperCase().trim() as StatusCode;
  const observacao =
    (body.observacao || '').toString().slice(0, 100).trim() || null;

  if (!cpf) {
    return NextResponse.json(
      { ok: false, error: 'CPF inválido' },
      { status: 400 },
    );
  }

  if (!STATUS_ALLOWED.includes(statusRaw)) {
    return NextResponse.json(
      { ok: false, error: 'Status inválido' },
      { status: 400 },
    );
  }

  try {
    await prisma.$executeRawUnsafe(
      `
      INSERT INTO epi_colab_status (cpf_limpo, ano_referencia, status, observacao)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (cpf_limpo, ano_referencia)
      DO UPDATE SET
        status     = EXCLUDED.status,
        observacao = EXCLUDED.observacao,
        updated_at = now()
      `,
      cpf,
      ANO_REFERENCIA,
      statusRaw,
      observacao,
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('POST /api/entregas/status error', e);
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 200 },
    );
  }
}
