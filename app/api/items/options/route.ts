import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const data = await prisma.item.findMany({
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    } as any);
    return NextResponse.json({ ok: true, data });
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ ok:false, error:e.message || 'Erro' }, { status: 500 });
  }
}
