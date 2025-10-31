import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ ok:false, error:'ID inválido' }, { status: 400 });

    await prisma.kitItem.deleteMany({ where: { kitId: id } } as any);
    await prisma.kit.delete({ where: { id } } as any);

    return NextResponse.json({ ok:true });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error: e?.message ?? 'Erro ao excluir' }, { status: 500 });
  }
}
