// file: app/api/estoque/visao/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Visão geral do estoque SESMT por Regional.
 *
 * Consolida:
 *  - saldo atual por item no estoque SESMT (unidade "ESTOQUE SESMT - {REGIONAL}");
 *  - total de entradas/saídas nos últimos 30 dias;
 *  - itens com estoque baixo / zerado;
 *  - itens com maior volume de saídas nos últimos 30 dias.
 */

async function ensureMovTable() {
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

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_sesmt_mov_reg_unid_item
      ON estoque_sesmt_mov (regional, unidade, item, data DESC)
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_sesmt_mov_tipo_data
      ON estoque_sesmt_mov (tipo, data DESC)
  `);
}

export async function GET(req: Request) {
  try {
    await ensureMovTable();

    const url = new URL(req.url);
    const searchParams = url.searchParams;

    const regionalRaw = (searchParams.get('regionalId') || '').toString().trim().toUpperCase();

    if (!regionalRaw) {
      return NextResponse.json(
        { ok: false, error: 'Regional não informada.' },
        { status: 400 },
      );
    }

    const regional = regionalRaw;
    const unidadeEstoque = `ESTOQUE SESMT - ${regional}`;

    // Saldo por item no estoque SESMT da Regional
    const saldoSql = `
      SELECT
        item,
        SUM(
          CASE
            WHEN tipo = 'entrada' THEN quantidade
            WHEN tipo = 'saida'   THEN -quantidade
            ELSE 0
          END
        ) AS saldo
      FROM estoque_sesmt_mov
      WHERE regional = $1
        AND unidade  = $2
      GROUP BY item
      ORDER BY item
    `;

    const saldoRows = await prisma.$queryRawUnsafe<any[]>(saldoSql, regional, unidadeEstoque);

    const saldoItens = (saldoRows || []).map((r) => ({
      item: (r.item || '').toString(),
      saldo: Number(r.saldo ?? 0),
    }));

    let totalSaldo = 0;
    let totalItensEstoque = 0;
    for (const s of saldoItens) {
      if (s.saldo !== 0) {
        totalItensEstoque += 1;
      }
      if (s.saldo > 0) {
        totalSaldo += s.saldo;
      }
    }

    // Entradas e saídas nos últimos 30 dias (todas as unidades da Regional)
    const mov30Sql = `
      SELECT
        tipo,
        SUM(quantidade) AS total
      FROM estoque_sesmt_mov
      WHERE regional = $1
        AND data >= NOW() - INTERVAL '30 days'
      GROUP BY tipo
    `;

    const mov30Rows = await prisma.$queryRawUnsafe<any[]>(mov30Sql, regional);

    let entradas30d = 0;
    let saidas30d = 0;
    for (const r of mov30Rows || []) {
      const tipo = (r.tipo || '').toString().toLowerCase();
      const total = Number(r.total ?? 0);
      if (tipo === 'entrada') entradas30d = total;
      if (tipo === 'saida') saidas30d = total;
    }

    // Top itens por saída nos últimos 30 dias (todas as unidades da Regional)
    const topSaidasSql = `
      SELECT
        item,
        SUM(quantidade) AS quantidade
      FROM estoque_sesmt_mov
      WHERE regional = $1
        AND tipo = 'saida'
        AND data >= NOW() - INTERVAL '30 days'
      GROUP BY item
      ORDER BY quantidade DESC
      LIMIT 10
    `;

    const topSaidasRows = await prisma.$queryRawUnsafe<any[]>(topSaidasSql, regional);
    const topSaidas = (topSaidasRows || []).map((r) => ({
      item: (r.item || '').toString(),
      quantidade: Number(r.quantidade ?? 0),
    }));

    // Alertas de estoque baixo
    const alertas = saldoItens
      .filter((s) => s.saldo <= 50)
      .map((s) => ({
        item: s.item,
        saldo: s.saldo,
        nivel: s.saldo <= 0 ? 'SEM_ESTOQUE' : 'BAIXO',
      }))
      .sort((a, b) => a.saldo - b.saldo)
      .slice(0, 20);

    const resumo = {
      totalItensEstoque,
      totalSaldo,
      entradas30d,
      saidas30d,
    };

    return NextResponse.json({
      resumo,
      saldoPorItem: saldoItens,
      topSaidas30d: topSaidas,
      alertas,
    });
  } catch (e: any) {
    console.error('Erro em /api/estoque/visao GET', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Erro ao carregar visão geral do estoque.' },
      { status: 500 },
    );
  }
}
