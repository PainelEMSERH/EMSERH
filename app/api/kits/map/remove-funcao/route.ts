import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  const { nome_site, alterdata_funcao } = await req.json();
  if (!nome_site || !alterdata_funcao) return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });

  try {
    await prisma.$executeRawUnsafe(
      `delete from stg_epi_map where nome_site = $1 and alterdata_funcao = $2`,
      String(nome_site).trim(), String(alterdata_funcao).trim()
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: 'Falha ao remover função' }, { status: 500 });
  }
}
