// file: app/api/estoque/pedidos/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

async function ensurePedidoTables(){
  await prisma.$executeRawUnsafe(`
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pedido_status') THEN
        CREATE TYPE pedido_status AS ENUM ('pendente','recebido','cancelado');
      END IF;
    END $$;
    CREATE TABLE IF NOT EXISTS pedido_reposicao (
      id TEXT PRIMARY KEY DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 24),
      regionalId TEXT NULL,
      unidadeId  TEXT NULL,
      status pedido_status NOT NULL DEFAULT 'pendente',
      criadoEm TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      previstoEm DATE NULL,
      recebidoEm DATE NULL,
      observacao TEXT NULL
    );
    CREATE TABLE IF NOT EXISTS pedido_reposicao_item (
      id TEXT PRIMARY KEY DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 24),
      pedidoId TEXT NOT NULL,
      itemId TEXT NOT NULL,
      quantidade_solicitada INT NOT NULL CHECK (quantidade_solicitada >= 0),
      quantidade_recebida INT NOT NULL DEFAULT 0 CHECK (quantidade_recebida >= 0)
    );
    CREATE INDEX IF NOT EXISTS idx_ped_status ON pedido_reposicao(status, criadoEm DESC);
    CREATE INDEX IF NOT EXISTS idx_pedi_pedido ON pedido_reposicao_item(pedidoId);
  `);
}

export async function GET(req: Request){
  const { searchParams } = new URL(req.url);
  const status  = (searchParams.get('status')||'').trim();
  const unidadeId = (searchParams.get('unidadeId')||'').trim();
  const regionalId = (searchParams.get('regionalId')||'').trim();
  const page   = Math.max(1, Number(searchParams.get('page')||'1'));
  const size   = Math.min(100, Math.max(10, Number(searchParams.get('size')||'25')));
  const offset = (page-1)*size;

  await ensurePedidoTables();

  const where:string[] = [];
  const params:any[] = [];
  if (status){ params.push(status); where.push(`p.status = $${params.length}`); }
  if (unidadeId){ params.push(unidadeId); where.push(`p."unidadeId" = $${params.length}`); }
  if (regionalId){ params.push(regionalId); where.push(`p."regionalId" = $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows:any[] = await prisma.$queryRawUnsafe(`
    SELECT p.id, p.status, p.criadoEm, p.previstoEm, p.recebidoEm, p.observacao,
           r.id AS "regionalId", r.nome AS regional,
           u.id AS "unidadeId",  u.nome AS unidade,
           COALESCE(SUM(pi.quantidade_solicitada),0)::int AS qtd_solicitada,
           COALESCE(SUM(pi.quantidade_recebida),0)::int AS qtd_recebida
    FROM pedido_reposicao p
    LEFT JOIN unidade  u ON u.id = p."unidadeId"
    LEFT JOIN regional r ON r.id = COALESCE(p."regionalId", u."regionalId")
    LEFT JOIN pedido_reposicao_item pi ON pi."pedidoId" = p.id
    ${whereSql}
    GROUP BY p.id, r.id, u.id
    ORDER BY p.criadoEm DESC
    LIMIT ${size} OFFSET ${offset}
  `, ...params);

  const total:any[] = await prisma.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS c
    FROM pedido_reposicao p
    ${whereSql}
  `, ...params);

  return NextResponse.json({ total: (total?.[0]?.c ?? 0), rows });
}

export async function POST(req: Request){
  await ensurePedidoTables();
  const body = await req.json();
  const regionalId = (body?.regionalId || null) as string | null;
  const unidadeId  = (body?.unidadeId || null) as string | null;
  const previstoEm = (body?.previstoEm || null) as string | null;
  const observacao = (body?.observacao || null) as string | null;
  const itens = Array.isArray(body?.itens) ? body.itens : [];

  if (!regionalId && !unidadeId){
    return NextResponse.json({ ok:false, error:'Informe regionalId ou unidadeId' }, { status:400 });
  }
  if (!Array.isArray(itens) || itens.length === 0){
    return NextResponse.json({ ok:false, error:'Itens obrigatórios' }, { status:400 });
  }

  const ins:any[] = await prisma.$queryRawUnsafe(`
    INSERT INTO pedido_reposicao ("regionalId","unidadeId",previstoEm,observacao)
    VALUES ($1,$2,$3,$4) RETURNING id
  `, regionalId, unidadeId, previstoEm, observacao);
  const pedidoId = ins?.[0]?.id as string;

  for (const it of itens){
    const itemId = (it?.itemId || '').toString();
    const quantidade = Number(it?.quantidade || 0);
    if (!itemId || quantidade <= 0) continue;
    await prisma.$executeRawUnsafe(`
      INSERT INTO pedido_reposicao_item ("pedidoId","itemId",quantidade_solicitada)
      VALUES ($1,$2,$3)
    `, pedidoId, itemId, quantidade);
  }
  return NextResponse.json({ ok:true, id: pedidoId });
}
