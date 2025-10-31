import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, nome, descricao, itens } = body || {};

    if (!nome || typeof nome !== 'string') {
      return NextResponse.json({ ok:false, error:'Nome inválido' }, { status: 400 });
    }

    let kitId: string | undefined = id;

    if (kitId) {
      await prisma.kit.update({
        where: { id: kitId },
        data: { nome, descricao },
      } as any);
      // reset composição
      await prisma.kitItem.deleteMany({ where: { kitId } } as any);
    } else {
      const created = await prisma.kit.create({ data: { nome, descricao } } as any);
      kitId = created.id;
    }

    if (Array.isArray(itens) && itens.length > 0) {
      const toCreate = itens
        .filter((it: any) => it && it.itemId && (it.quantidade ?? 0) >= 0)
        .map((it: any) => ({
          kitId: kitId!,
          itemId: String(it.itemId),
          quantidade: Number(it.quantidade || 0),
        }));
      if (toCreate.length) {
        await prisma.kitItem.createMany({ data: toCreate } as any);
      }
    }

    return NextResponse.json({ ok: true, id: kitId });
  } catch (e: any) {
    return NextResponse.json({ ok:false, error: e?.message ?? 'Erro' }, { status: 500 });
  }
}
