// file: app/api/estoque/mov/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Tabelas específicas do estoque SESMT.
 *
 * - estoque_sesmt_mov:
 *   Guarda o histórico de movimentações por Regional / Unidade / Item,
 *   sem depender das tabelas antigas (unidade, regional, estoque_mov).
 */
async function ensureTables() {
  // Enum do tipo de movimentação
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estoque_sesmt_mov_tipo') THEN
        CREATE TYPE estoque_sesmt_mov_tipo AS ENUM ('entrada', 'saida');
      END IF;
    END $$;
  `);

  // Tabela de movimentações
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS estoque_sesmt_mov (
      id TEXT PRIMARY KEY DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 24),
      regional   TEXT NOT NULL,
      unidade    TEXT NOT NULL,
      item       TEXT NOT NULL,
      tipo       estoque_sesmt_mov_tipo NOT NULL,
      quantidade INT NOT NULL CHECK (quantidade >= 0),
      destino    TEXT NULL,
      observacao TEXT NULL,
      data       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // Índices básicos
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_sesmt_mov_reg_unid_item
      ON estoque_sesmt_mov (regional, unidade, item, data DESC);
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_sesmt_mov_tipo_data
      ON estoque_sesmt_mov (tipo, data DESC);
  `);
}

/**
 * Lista movimentações do estoque SESMT.
 * Filtra por regional/unidade/item/tipo/período e texto livre em item/destino.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const regionalId = (searchParams.get('regionalId') || '').trim();
    const unidadeId  = (searchParams.get('unidadeId')  || '').trim();
    const itemId     = (searchParams.get('itemId')     || '').trim();
    const tipo       = (searchParams.get('tipo')       || '').trim();
    const de         = (searchParams.get('de')         || '').trim();
    const ate        = (searchParams.get('ate')        || '').trim();
    const q          = (searchParams.get('q')          || '').trim();
    const page       = Math.max(1, Number(searchParams.get('page') || '1'));
    const size       = Math.min(100, Math.max(10, Number(searchParams.get('size') || '25')));
    const offset     = (page - 1) * size;

    await ensureTables();

    const where: string[] = [];
    const params: any[] = [];

    if (regionalId) {
      params.push(regionalId);
      where.push(`m.regional = $${params.length}`);
    }
    if (unidadeId) {
      params.push(unidadeId);
      where.push(`m.unidade = $${params.length}`);
    }
    if (itemId) {
      params.push(itemId);
      where.push(`m.item = $${params.length}`);
    }
    if (tipo) {
      params.push(tipo);
      where.push(`m.tipo = $${params.length}::estoque_sesmt_mov_tipo`);
    }
    if (de) {
      params.push(de);
      where.push(`m.data >= $${params.length}::timestamptz`);
    }
    if (ate) {
      params.push(ate);
      where.push(`m.data <= $${params.length}::timestamptz`);
    }
    if (q) {
      const like = `%${q.toUpperCase()}%`;
      params.push(like);
      where.push(`(UPPER(m.item) LIKE $${params.length} OR UPPER(m.destino) LIKE $${params.length})`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const rows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT
        m.id,
        m.tipo,
        m.quantidade,
        m.destino,
        m.observacao,
        m.data,
        m.unidade  AS "unidade",
        m.unidade  AS "unidadeId",
        m.regional AS "regional",
        m.regional AS "regionalId",
        m.item     AS "item",
        m.item     AS "itemId"
      FROM estoque_sesmt_mov m
      ${whereSql}
      ORDER BY m.data DESC, m.criado_em DESC
      LIMIT ${size} OFFSET ${offset}
    `, *params);

    const totalRows = await prisma.$queryRawUnsafe<any[]>(`
      SELECT COUNT(*)::int AS c
      FROM estoque_sesmt_mov m
      ${whereSql}
    `, *params);

    const total = Number(totalRows?.[0]?.c ?? 0);

    return NextResponse.json({ total, rows });
  } catch (e: any) {
    console.error('Erro em /api/estoque/mov GET', e);
    return NextResponse.json(
      { total: 0, rows: [], error: e?.message || 'Erro interno ao listar movimentações' },
      { status: 500 },
    );
  }
}

/**
 * Registra nova movimentação de estoque SESMT.
 * Não depende de outras tabelas (unidade/regional/estoque/item).
 */
export async function POST(req: Request) {
  try {
    await ensureTables();
    const body = await req.json();

    const unidadeRaw = (body?.unidadeId || '').toString().trim();
    const itemRaw    = (body?.itemId || '').toString().trim();
    const tipo       = (body?.tipo || '').toString().trim();
    const quantidade = Number(body?.quantidade || 0);
    const destino    = (body?.destino || null) as string | null;
    const observacao = (body?.observacao || null) as string | null;
    const dataIso    = (body?.data || null) as string | null;

    if (!unidadeRaw || !itemRaw || !['entrada', 'saida'].includes(tipo) || !Number.isFinite(quantidade) || quantidade <= 0) {
      return NextResponse.json({ ok: false, error: 'Dados inválidos' }, { status: 400 });
    }

    // Tenta usar o campo regional enviado; se não tiver, deduz a partir do texto da unidade
    let regional = (body?.regional || '').toString().trim().toUpperCase();
    if (!regional) {
      const upper = unidadeRaw.toUpperCase();
      for (const r of ['NORTE', 'SUL', 'LESTE', 'CENTRO']) {
        if (upper.includes(r)) {
          regional = r;
          break;
        }
      }
    }
    if (!regional) {
      regional = 'DESCONHECIDA';
    }

    const unidade = unidadeRaw;
    const item = itemRaw;
    const dataParam = dataIso && dataIso.trim() ? dataIso : null;

    const inserted = await prisma.$queryRawUnsafe<any[]>(`
      INSERT INTO estoque_sesmt_mov (regional, unidade, item, tipo, quantidade, destino, observacao, data)
      VALUES ($1, $2, $3, $4::estoque_sesmt_mov_tipo, $5, $6, $7, COALESCE($8::timestamptz, NOW()))
      RETURNING id
    `, regional, unidade, item, tipo, quantidade, destino, observacao, dataParam);

    const id = inserted?.[0]?.id || null;
    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    console.error('Erro em /api/estoque/mov POST', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Erro interno ao salvar movimentação' },
      { status: 500 },
    );
  }
}
