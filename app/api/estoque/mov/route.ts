// file: app/api/estoque/mov/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Tabela exclusiva para controle de movimentações do ESTOQUE SESMT,
 * sem depender das tabelas legadas.
 *
 *   estoque_sesmt_mov
 *   - id, regional, unidade, item, tipo ('entrada' | 'saida'),
 *     quantidade, destino, observacao, data, criado_em
 */
async function ensureTables() {
  // Tabela principal
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS estoque_sesmt_mov (
      id TEXT PRIMARY KEY DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 24),
      regional   TEXT NOT NULL,
      unidade    TEXT NOT NULL,
      item       TEXT NOT NULL,
      tipo       TEXT NOT NULL,
      quantidade INT  NOT NULL CHECK (quantidade >= 0),
      destino    TEXT NULL,
      observacao TEXT NULL,
      data       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  // Índices básicos
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_sesmt_mov_reg_unid_item
      ON estoque_sesmt_mov (regional, unidade, item, data DESC)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_sesmt_mov_tipo_data
      ON estoque_sesmt_mov (tipo, data DESC)
  `);
}

/**
 * GET /api/estoque/mov
 * Lista movimentações do estoque SESMT.
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

    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const size = Math.min(100, Math.max(10, Number(searchParams.get('size') || '25')));
    const offset = (page - 1) * size;

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
      where.push(`m.tipo = $${params.length}`);
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
      where.push(
        `(UPPER(m.item) LIKE $${params.length} OR UPPER(m.destino) LIKE $${params.length})`
      );
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const listSql = `
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
    `;

    const countSql = `
      SELECT COUNT(*)::int AS c
      FROM estoque_sesmt_mov m
      ${whereSql}
    `;

    const rows = await prisma.$queryRawUnsafe<any[]>(listSql, ...params);
    const totalRows = await prisma.$queryRawUnsafe<any[]>(countSql, ...params);
    const total = Number(totalRows?.[0]?.c ?? 0);

    return NextResponse.json({ total, rows });
  } catch (e: any) {
    console.error('Erro em /api/estoque/mov GET', e);
    return NextResponse.json(
      { total: 0, rows: [], error: e?.message || 'Erro interno ao listar movimentações' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/estoque/mov
 * Registra nova movimentação no estoque SESMT.
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
    let   regional   = (body?.regional || '').toString().trim().toUpperCase();

    if (!unidadeRaw || !itemRaw || !['entrada', 'saida'].includes(tipo) || !Number.isFinite(quantidade) || quantidade <= 0) {
      return NextResponse.json({ ok: false, error: 'Dados inválidos' }, { status: 400 });
    }

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

    const insertSql = `
      INSERT INTO estoque_sesmt_mov (
        regional, unidade, item, tipo, quantidade, destino, observacao, data
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, NOW()))
      RETURNING id
    `;

    const inserted = await prisma.$queryRawUnsafe<any[]>(
      insertSql,
      regional,
      unidade,
      item,
      tipo,
      quantidade,
      destino,
      observacao,
      dataParam
    );

    const id = inserted?.[0]?.id || null;
    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    console.error('Erro em /api/estoque/mov POST', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Erro interno ao salvar movimentação' },
      { status: 500 }
    );
  }
}


/**
 * PUT /api/estoque/mov
 * Atualiza uma movimentação existente.
 * No momento, restringimos a edição às entradas do estoque SESMT.
 */
export async function PUT(req: Request) {
  try {
    await ensureTables();

    const body = await req.json();
    const idRaw = body?.id;
    const id = Number(idRaw);

    if (!id || !Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        { ok: false, error: 'ID da movimentação inválido.' },
        { status: 400 }
      );
    }

    const rows: any[] = await prisma.$queryRawUnsafe(
      'SELECT id, tipo FROM estoque_sesmt_mov WHERE id = $1',
      id
    );

    if (!rows || rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Movimentação não encontrada.' },
        { status: 404 }
      );
    }

    const row = rows[0];
    if (row.tipo !== 'entrada') {
      return NextResponse.json(
        { ok: false, error: 'Apenas movimentações de ENTRADA podem ser editadas por enquanto.' },
        { status: 400 }
      );
    }

    const quantidadeRaw = body?.quantidade;
    const observacao = (body?.observacao ?? null) as string | null;
    const dataIso = (body?.data ?? null) as string | null;

    const setSql: string[] = [];
    const params: any[] = [];

    if (quantidadeRaw !== undefined && quantidadeRaw !== null) {
      const quantidade = Number(quantidadeRaw);
      if (!Number.isFinite(quantidade) || quantidade <= 0) {
        return NextResponse.json(
          { ok: false, error: 'Quantidade inválida.' },
          { status: 400 }
        );
      }
      params.push(quantidade);
      setSql.push(`quantidade = $${params.length}`);
    }

    if (observacao !== undefined) {
      params.push(observacao);
      setSql.push(`observacao = $${params.length}`);
    }

    if (dataIso) {
      const d = new Date(dataIso);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json(
          { ok: false, error: 'Data inválida.' },
          { status: 400 }
        );
      }
      params.push(d);
      setSql.push(`data = $${params.length}`);
    }

    if (setSql.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Nenhum campo para atualizar.' },
        { status: 400 }
      );
    }

    params.push(id);
    const sql = `
      UPDATE estoque_sesmt_mov
         SET ${setSql.join(', ')}
       WHERE id = $${params.length}
    `;

    await prisma.$executeRawUnsafe(sql, ...params);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('Erro em /api/estoque/mov PUT', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Erro interno ao atualizar movimentação' },
      { status: 500 }
    );
  }
}
