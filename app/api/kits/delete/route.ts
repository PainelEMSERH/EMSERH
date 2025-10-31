import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body || {};
    if (!id) return NextResponse.json({ ok:false, error:'ID inválido' }, { status: 400 });

    await prisma.kit_item.deleteMany({ where: { kitId: id } } as any);
    await prisma.kit.delete({ where: { id } } as any);

    return NextResponse.json({ ok:true });
  } catch (e:any) {
    console.error(e);
    return NextResponse.json({ ok:false, error:e.message || 'Erro' }, { status: 500 });
  }
}
