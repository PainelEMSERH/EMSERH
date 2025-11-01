import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  const { nome_site, epi_item } = await req.json();
  if (!nome_site || !epi_item) return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });

  try {
    await prisma.$executeRawUnsafe(
      `delete from stg_epi_map where nome_site = $1 and epi_item = $2`,
      String(nome_site).trim(), String(epi_item).trim()
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: 'Falha ao remover item' }, { status: 500 });
  }
}
