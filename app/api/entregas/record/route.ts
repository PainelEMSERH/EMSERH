import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type Payload = {
  colaborador: {
    id: string;
    nome: string;
    funcao: string;
    unidade: string;
    regional: string;
    nome_site?: string | null;
  };
  data_entrega: string; // YYYY-MM-DD
  itens: { epi_item: string; quantidade: number; entregue: boolean }[];
};

export async function POST(req: Request) {
  const body = await req.json() as Payload;
  if (!body?.colaborador?.id || !body.data_entrega || !Array.isArray(body.itens)) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  const dt = new Date(body.data_entrega + 'T00:00:00');

  try {
    // Ensure table exists with permissive schema (idempotent)
    await prisma.$executeRawUnsafe(`
      create table if not exists entrega_epi (
        id bigserial primary key,
        colaborador_id text,
        colaborador_nome text,
        funcao text,
        unidade text,
        regional text,
        nome_site text,
        epi_item text,
        quantidade numeric,
        entregue boolean,
        data_entrega date,
        created_at timestamp default now()
      )
    `);

    const tx = [];
    for (const it of body.itens) {
      tx.push(prisma.$executeRawUnsafe(
        \`insert into entrega_epi (colaborador_id, colaborador_nome, funcao, unidade, regional, nome_site, epi_item, quantidade, entregue, data_entrega)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)\`,
        body.colaborador.id,
        body.colaborador.nome,
        body.colaborador.funcao,
        body.colaborador.unidade,
        body.colaborador.regional,
        body.colaborador.nome_site ?? null,
        it.epi_item,
        it.quantidade,
        !!it.entregue,
        dt
      ));
    }
    await prisma.$transaction(tx);

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: 'Falha ao registrar entrega' }, { status: 500 });
  }
}
