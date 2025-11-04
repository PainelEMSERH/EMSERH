// file: app/api/estoque/pedidos/receber/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request){
  const body = await req.json();
  const pedidoId = (body?.pedidoId || '').toString();
  const dataIso  = (body?.data || null) as string | null;
  const itens = Array.isArray(body?.itens) ? body.itens : [];

  if (!pedidoId || itens.length === 0){
    return NextResponse.json({ ok:false, error:'Dados inválidos' }, { status:400 });
  }

  await prisma.$executeRawUnsafe(`
    UPDATE pedido_reposicao SET status='recebido', recebidoEm = COALESCE($2::date, CURRENT_DATE) WHERE id = $1
  `, pedidoId, dataIso);

  for (const it of itens){
    const itemId = (it?.itemId || '').toString();
    const qtd    = Number(it?.quantidade_recebida || 0);
    const unidadeId = (it?.unidadeId || '').toString();
    if (!itemId || qtd <= 0) continue;

    await prisma.$executeRawUnsafe(`
      UPDATE pedido_reposicao_item SET quantidade_recebida = COALESCE(quantidade_recebida,0) + $2
      WHERE "pedidoId" = $1 AND "itemId" = $3
    `, pedidoId, qtd, itemId);

    if (unidadeId){
      await prisma.$executeRawUnsafe(`
        INSERT INTO estoque ("unidadeId","itemId",quantidade,minimo,maximo)
        VALUES ($1,$2,0,0,NULL)
        ON CONFLICT ("unidadeId","itemId") DO NOTHING
      `, unidadeId, itemId);
      await prisma.$executeRawUnsafe(`
        UPDATE estoque SET quantidade = quantidade + $3 WHERE "unidadeId"=$1 AND "itemId"=$2
      `, unidadeId, itemId, qtd);
      await prisma.$executeRawUnsafe(`
        INSERT INTO estoque_mov ("unidadeId","itemId",tipo,quantidade,destino,data)
        VALUES ($1,$2,'entrada',$3,'Pedido recebido',$4::timestamptz)
      `, unidadeId, itemId, qtd, dataIso || null);
    }
  }

  return NextResponse.json({ ok:true });
}
