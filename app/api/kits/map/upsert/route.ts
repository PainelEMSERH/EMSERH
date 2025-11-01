import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type Body = {
  nome_site: string;
  funcoes: string[];
  itens: { epi_item: string; quantidade: number }[];
  mode?: 'replace' | 'append';
};

export async function POST(req: Request) {
  const body = await req.json() as Body;
  if (!body?.nome_site || !Array.isArray(body.funcoes) || !Array.isArray(body.itens)) {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  const nome = body.nome_site.trim();
  const funcoes = body.funcoes.map(f => f.trim()).filter(Boolean);
  let itens = body.itens.map(i => ({
    epi_item: i.epi_item.trim() || 'SEM EPI',
    quantidade: Number.isFinite(i.quantidade) ? Number(i.quantidade) : 0
  }));

  try {
    const tx = [];
    if (body.mode !== 'append') {
      // delete existing for nome_site AND funcoes provided
      const params = [nome, funcoes];
      tx.push(prisma.$executeRawUnsafe(
        `delete from stg_epi_map where nome_site = $1 and alterdata_funcao = ANY($2::text[])`,
        ...params
      ));
    }
    // insert cross join funcao x itens
    for (const f of funcoes) {
      for (const it of itens) {
        tx.push(prisma.$executeRawUnsafe(
          `insert into stg_epi_map (alterdata_funcao, epi_item, quantidade, nome_site)
           values ($1, $2, $3, $4)`,
          f, it.epi_item, it.quantidade, nome
        ));
      }
    }
    await prisma.$transaction(tx);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: 'Falha ao salvar' }, { status: 500 });
  }
}
