import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  const { nome_site, alterdata_funcao } = await req.json();
  if (!nome_site || !alterdata_funcao) return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });

  try {
    // seed with SEM EPI row (quantidade 0) so it aparece no kit
    await prisma.$executeRawUnsafe(
      `insert into stg_epi_map (alterdata_funcao, epi_item, quantidade, nome_site)
       values ($1, $2, $3, $4)`,
      String(alterdata_funcao).trim(), 'SEM EPI', 0, String(nome_site).trim(),
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: 'Falha ao incluir função' }, { status: 500 });
  }
}
