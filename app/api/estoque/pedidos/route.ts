// file: app/api/estoque/pedidos/route.ts
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Controle de pedidos de reposição de EPI do ESTOQUE SESMT.
 *
 *   estoque_sesmt_pedido
 *   - id, regional, solicitante_tipo ('UNIDADE' | 'SESMT'),
 *     unidade_solicitante, data_pedido, responsavel,
 *     numero_cahosp, observacao, status, criado_em
 *
 *   estoque_sesmt_pedido_item
 *   - id, pedido_id, item_id, descricao, grupo, subgrupo,
 *     tamanho, unidade_medida, quantidade
 */
async function ensureTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS estoque_sesmt_pedido (
      id              bigserial PRIMARY KEY,
      regional        text        NOT NULL,
      solicitante_tipo text       NOT NULL,
      unidade_solicitante text,
      data_pedido     timestamptz NOT NULL DEFAULT now(),
      responsavel     text,
      numero_cahosp   text,
      observacao      text,
      status          text        NOT NULL DEFAULT 'ABERTO',
      criado_em       timestamptz NOT NULL DEFAULT now()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS estoque_sesmt_pedido_item (
      id            bigserial PRIMARY KEY,
      pedido_id     bigint      NOT NULL REFERENCES estoque_sesmt_pedido(id) ON DELETE CASCADE,
      item_id       text,
      descricao     text        NOT NULL,
      grupo         text,
      subgrupo      text,
      tamanho       text,
      unidade_medida text,
      quantidade    numeric     NOT NULL
    );
  `);
}

export async function GET(req: Request) {
  try {
    await ensureTables();

    const url = new URL(req.url);
    const searchParams = url.searchParams;

    const regionalId = (searchParams.get('regionalId') || '').toString().trim();
    const status = (searchParams.get('status') || '').toString().trim();
    const qRaw = (searchParams.get('q') || '').toString().trim();

    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const sizeRaw = Number(searchParams.get('size') || '20');
    const size = Number.isFinite(sizeRaw) ? Math.min(100, Math.max(10, sizeRaw)) : 20;
    const offset = (page - 1) * size;

    const where: string[] = [];
    const params: any[] = [];

    if (regionalId) {
      params.push(regionalId);
      where.push(\`p.regional = $\${params.length}\`);
    }

    if (status) {
      params.push(status);
      where.push(\`p.status = $\${params.length}\`);
    }

    if (qRaw) {
      const q = \`%\${qRaw.toUpperCase()}%\`;
      params.push(q);
      const idx = params.length;
      where.push(
        \`(
          upper(coalesce(p.unidade_solicitante, '')) LIKE $\${idx}
          OR upper(coalesce(p.responsavel, '')) LIKE $\${idx}
          OR upper(coalesce(p.numero_cahosp, '')) LIKE $\${idx}
        )\`,
      );
    }

    const whereSql = where.length ? \`WHERE \${where.join(' AND ')}\` : '';

    const listSql = \`
      SELECT
        p.id::text,
        p.data_pedido,
        p.regional,
        p.solicitante_tipo,
        p.unidade_solicitante,
        p.numero_cahosp,
        p.responsavel,
        p.status,
        p.observacao,
        COALESCE(SUM(i.quantidade), 0)          AS total_qtd,
        COUNT(i.id)::int                        AS total_itens
      FROM estoque_sesmt_pedido p
      LEFT JOIN estoque_sesmt_pedido_item i
        ON i.pedido_id = p.id
      \${whereSql}
      GROUP BY
        p.id,
        p.data_pedido,
        p.regional,
        p.solicitante_tipo,
        p.unidade_solicitante,
        p.numero_cahosp,
        p.responsavel,
        p.status,
        p.observacao
      ORDER BY p.data_pedido DESC, p.id DESC
      LIMIT \${size} OFFSET \${offset}
    \`;

    const countSql = \`
      SELECT COUNT(*)::int AS c
      FROM estoque_sesmt_pedido p
      \${whereSql}
    \`;

    const rows = await prisma.$queryRawUnsafe<any[]>(listSql, ...params);
    const totalRows = await prisma.$queryRawUnsafe<any[]>(countSql, ...params);
    const total = Number(totalRows?.[0]?.c ?? 0);

    return NextResponse.json({ rows, total });
  } catch (e: any) {
    console.error('Erro em /api/estoque/pedidos GET', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Erro ao listar pedidos de reposição' },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  try {
    await ensureTables();

    const body = await req.json();

    let regional = (body?.regionalId || '').toString().trim().toUpperCase();
    const solicitanteTipoRaw = (body?.solicitanteTipo || '').toString().trim().toUpperCase();
    const solicitanteTipo = solicitanteTipoRaw === 'SESMT' ? 'SESMT' : 'UNIDADE';
    const unidade = (body?.unidade || '').toString().trim() || null;
    const dataIso = (body?.data || null) as string | null;
    const responsavel = (body?.responsavel || null) as string | null;
    const numeroCahosp = (body?.numeroCahosp || null) as string | null;
    const observacao = (body?.observacao || null) as string | null;
    const itensRaw = Array.isArray(body?.itens) ? body.itens : [];
    const itens = itensRaw.filter((it: any) => {
      const desc = (it?.descricao || '').toString().trim();
      const qtd = Number(it?.quantidade || 0);
      return !!desc && Number.isFinite(qtd) && qtd > 0;
    });

    if (!regional) {
      return NextResponse.json(
        { ok: false, error: 'Regional é obrigatória para registrar o pedido.' },
        { status: 400 },
      );
    }

    if (solicitanteTipo === 'UNIDADE' && !unidade) {
      return NextResponse.json(
        { ok: false, error: 'Unidade solicitante é obrigatória quando o pedido vem da Unidade.' },
        { status: 400 },
      );
    }

    if (!itens.length) {
      return NextResponse.json(
        { ok: false, error: 'Informe ao menos um item com quantidade válida.' },
        { status: 400 },
      );
    }

    const dataParam = dataIso && dataIso.trim() ? dataIso : null;

    const inserted = await prisma.$queryRawUnsafe<any[]>(
      \`
      INSERT INTO estoque_sesmt_pedido
        (regional, solicitante_tipo, unidade_solicitante, data_pedido, responsavel, numero_cahosp, observacao, status)
      VALUES
        ($1, $2, $3, COALESCE($4::timestamptz, now()), $5, $6, $7, 'ABERTO')
      RETURNING id
      \`,
      regional,
      solicitanteTipo,
      unidade,
      dataParam,
      responsavel,
      numeroCahosp,
      observacao,
    );

    const pedidoId = inserted?.[0]?.id;
    if (!pedidoId) {
      throw new Error('Falha ao criar registro do pedido.');
    }

    for (const it of itens) {
      const descricao = (it?.descricao || '').toString().trim();
      const itemId = (it?.itemId || null) as string | null;
      const grupo = (it?.grupo || null) as string | null;
      const subgrupo = (it?.subgrupo || null) as string | null;
      const tamanho = (it?.tamanho || null) as string | null;
      const unidadeMedida = (it?.unidadeMedida || null) as string | null;
      const quantidade = Number(it?.quantidade || 0);

      await prisma.$executeRawUnsafe(
        \`
        INSERT INTO estoque_sesmt_pedido_item
          (pedido_id, item_id, descricao, grupo, subgrupo, tamanho, unidade_medida, quantidade)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8)
        \`,
        pedidoId,
        itemId,
        descricao,
        grupo,
        subgrupo,
        tamanho,
        unidadeMedida,
        quantidade,
      );
    }

    return NextResponse.json({ ok: true, id: pedidoId });
  } catch (e: any) {
    console.error('Erro em /api/estoque/pedidos POST', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Erro ao registrar pedido de reposição' },
      { status: 500 },
    );
  }
}
