import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(req: Request) {
  const { oldName, newName } = await req.json();
  if (!oldName || !newName) return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });

  try {
    await prisma.$executeRawUnsafe(
      `update stg_epi_map set nome_site = $1 where nome_site = $2`,
      String(newName).trim(),
      String(oldName).trim(),
    );
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: 'Falha ao renomear' }, { status: 500 });
  }
}
