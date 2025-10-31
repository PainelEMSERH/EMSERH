import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get('q') || '').trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const size = Math.max(1, Math.min(100, parseInt(searchParams.get('size') || '20', 10)));

    const where = q ? { nome: { contains: q, mode: 'insensitive' as const } } : {};
    const [total, dataRaw] = await Promise.all([
      prisma.kit.count({ where } as any),
      prisma.kit.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * size,
        take: size,
        include: {
          itens: {
            include: { item: true },
          },
        },
      } as any),
    ]);

    const data = dataRaw.map(k => ({
      id: k.id,
      nome: k.nome,
      descricao: k.descricao,
      updatedAt: (k as any).updatedAt?.toISOString?.() || null,
      itens: (k as any).itens.map((ki: any) => ({
        itemId: ki.itemId,
        itemNome: ki.item?.nome || ki.itemId,
        quantidade: Number(ki.quantidade || 0),
      })),
    }));

    return NextResponse.json({ ok: true, data, total, page, size });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ ok: false, error: e.message || 'Erro' }, { status: 500 });
  }
}
