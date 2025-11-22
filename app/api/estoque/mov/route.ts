// file: app/api/estoque/mov/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Garante apenas os objetos específicos deste módulo:
 *  - tipo ENUM estoque_mov_tipo
 *  - tabela estoque_mov + índices
 *
 * NÃO cria / altera tabela unidade, regional, item, estoque etc.
 */
async function ensureTables() {
  // Enum
  await prisma.$executeRawUnsafe(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estoque_mov_tipo') THEN
        CREATE TYPE estoque_mov_tipo AS ENUM ('entrada','saida');
      END IF;
    END
    $$;
  `);

  // Tabela estoque_mov
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS estoque_mov (
      id TEXT PRIMARY KEY DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 24),
      "unidadeId" TEXT NOT NULL,
      "itemId"    TEXT NOT NULL,
      tipo        estoque_mov_tipo NOT NULL,
      quantidade  INT NOT NULL CHECK (quantidade >= 0),
      destino     TEXT NULL,
      observacao  TEXT NULL,
      data        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      "criadoEm"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_emov_unid_item
      ON estoque_mov("unidadeId","itemId", data DESC);
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_emov_tipo_data
      ON estoque_mov(tipo, data DESC);
  `);
}

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

    // Descobre se existem tabelas normalizadas regional/unidade
    const tables:any[] = await prisma.$queryRawUnsafe(`
      SELECT table_name
        FROM information_schema.tables
       WHERE table_schema = current_schema()
         AND table_name IN ('regional','unidade')
    `);
    const hasRegional = tables.some((t:any) => t.table_name === 'regional');
    const hasUnidade  = tables.some((t:any) => t.table_name === 'unidade');

    const where: string[] = [];
    const params: any[] = [];

    // Filtro por unidade (sempre funciona, independe de tabela unidade)
    if (unidadeId) {
      params.push(unidadeId);
      where.push(`m."unidadeId" = $${params.length}`);
    } else if (regionalId && hasRegional && hasUnidade) {
      // Só filtra por regional usando join se as tabelas existirem
      params.push(regionalId);
      where.push(`m."unidadeId" IN (SELECT id FROM unidade WHERE "regionalId" = $${params.length})`);
    }

    if (itemId) {
      params.push(itemId);
      where.push(`m."itemId" = $${params.length}`);
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
      if (hasUnidade && hasRegional) {
        where.push(`(UPPER(i.nome) LIKE $${params.length} OR UPPER(u.nome) LIKE $${params.length} OR UPPER(m.destino) LIKE $${params.length})`);
      } else {
        where.push(`(UPPER(i.nome) LIKE $${params.length} OR UPPER(m.destino) LIKE $${params.length})`);
      }
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    if (hasRegional && hasUnidade) {
      // Caminho completo, com join em unidade/regional
      const rows:any[] = await prisma.$queryRawUnsafe(
        `SELECT m.id,
                m.tipo,
                m.quantidade,
                m.destino,
                m.observacao,
                m.data,
                u.id AS "unidadeId",
                u.nome AS unidade,
                r.id AS "regionalId",
                r.nome AS regional,
                i.id AS "itemId",
                i.nome AS item
           FROM estoque_mov m
           JOIN unidade  u ON u.id = m."unidadeId"
           JOIN regional r ON r.id = u."regionalId"
           JOIN item     i ON i.id = m."itemId"
           ${whereSql}
           ORDER BY m.data DESC
           LIMIT ${size} OFFSET ${offset}`,
        ...params,
      );

      const tot:any[] = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS c
           FROM estoque_mov m
           JOIN unidade  u ON u.id = m."unidadeId"
           JOIN regional r ON r.id = u."regionalId"
           JOIN item     i ON i.id = m."itemId"
           ${whereSql}`,
        ...params,
      );

      return NextResponse.json({ total: (tot?.[0]?.c ?? 0), rows });
    } else {
      // Caminho de fallback: não existe tabela unidade/regional.
      // Usa apenas estoque_mov + item, tratando unidadeId como nome textual.
      const rows:any[] = await prisma.$queryRawUnsafe(
        `SELECT m.id,
                m.tipo,
                m.quantidade,
                m.destino,
                m.observacao,
                m.data,
                m."unidadeId" AS "unidadeId",
                m."unidadeId" AS unidade,
                ''::text      AS "regionalId",
                ''::text      AS regional,
                i.id          AS "itemId",
                i.nome        AS item
           FROM estoque_mov m
           LEFT JOIN item i ON i.id = m."itemId"
           ${whereSql}
           ORDER BY m.data DESC
           LIMIT ${size} OFFSET ${offset}`,
        ...params,
      );

      const tot:any[] = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int AS c
           FROM estoque_mov m
           LEFT JOIN item i ON i.id = m."itemId"
           ${whereSql}`,
        ...params,
      );

      return NextResponse.json({ total: (tot?.[0]?.c ?? 0), rows });
    }
  } catch (e:any) {
    console.error('Erro em /api/estoque/mov GET', e);
    const msg = e?.message || 'Erro interno ao listar movimentações';
    return NextResponse.json({ total: 0, rows: [], error: msg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureTables();
    const body = await req.json();
    const unidadeId = (body?.unidadeId || '').toString();
    const itemId    = (body?.itemId || '').toString();
    const tipo      = (body?.tipo || '').toString();
    const quantidade = Number(body?.quantidade || 0);
    const destino   = (body?.destino || null) as string | null;
    const observacao= (body?.observacao || null) as string | null;
    const dataIso   = (body?.data || null) as string | null;

    if (!unidadeId || !itemId || !['entrada','saida'].includes(tipo) || quantidade <= 0) {
      return NextResponse.json({ ok:false, error:'Dados inválidos' }, { status:400 });
    }

    // Garante registro em estoque
    await prisma.$executeRawUnsafe(
      `INSERT INTO estoque ("unidadeId","itemId",quantidade,minimo,maximo)
       VALUES ($1,$2,0,0,NULL)
       ON CONFLICT ("unidadeId","itemId") DO NOTHING`,
      unidadeId,
      itemId,
    );

    const sign = tipo === 'entrada' ? 1 : -1;
    const diff = sign * quantidade;

    const cur:any[] = await prisma.$queryRawUnsafe(
      `SELECT quantidade AS q
         FROM estoque
        WHERE "unidadeId" = $1
          AND "itemId"    = $2`,
      unidadeId,
      itemId,
    );

    const atual = Number(cur?.[0]?.q ?? 0);
    if (atual + diff < 0) {
      return NextResponse.json({ ok:false, error: `Saldo insuficiente (atual ${atual})` }, { status:400 });
    }

    await prisma.$executeRawUnsafe(
      `UPDATE estoque
          SET quantidade = quantidade + $3
        WHERE "unidadeId" = $1
          AND "itemId"    = $2`,
      unidadeId,
      itemId,
      diff,
    );

    const ins:any[] = await prisma.$queryRawUnsafe(
      `INSERT INTO estoque_mov ("unidadeId","itemId",tipo,quantidade,destino,observacao,data)
       VALUES ($1,$2,$3::estoque_mov_tipo,$4,$5,$6, COALESCE($7::timestamptz, NOW()))
       RETURNING id`,
      unidadeId,
      itemId,
      tipo,
      quantidade,
      destino,
      observacao,
      dataIso,
    );

    return NextResponse.json({ ok:true, id: ins?.[0]?.id || null });
  } catch (e:any) {
    console.error('Erro em /api/estoque/mov POST', e);
    const msg = e?.message || 'Erro interno ao registrar movimentação';
    return NextResponse.json({ ok:false, error: msg }, { status: 500 });
  }
}