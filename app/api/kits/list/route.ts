// app/api/kits/list/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

// Lista kits + composição sem depender do nome do campo de relação no modelo Kit.
// Evita erro de include desconhecido em `KitInclude`.
export async function GET() {
  try {
    // 1) Kits básicos
    const kits = await prisma.kit.findMany({
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, descricao: true },
    });

    if (kits.length === 0) {
      return NextResponse.json({ ok: true, data: [] });
    }

    const kitIds = kits.map(k => k.id);

    // 2) Composição dos kits (uma consulta só, depois agrupamos em memória)
    const comps = await prisma.kitItem.findMany({
      where: { kitId: { in: kitIds } },
      select: {
        kitId: true,
        quantidade: true,
        item: {
          select: {
            id: true,
            nome: true,
            categoria: true,
            unidadeMedida: true,
            ca: true,
            descricao: true,
            validadeDias: true,
            ativo: true,
          }
        }
      }
    });

    const byKit = new Map<string, any[]>();
    for (const c of comps) {
      const arr = byKit.get(c.kitId) ?? [];
      arr.push({
        itemId: c.item?.id ?? null,
        itemNome: c.item?.nome ?? null,
        categoria: c.item?.categoria ?? null,
        unidadeMedida: c.item?.unidadeMedida ?? null,
        ca: c.item?.ca ?? null,
        validadeDias: c.item?.validadeDias ?? null,
        ativo: c.item?.ativo ?? null,
        quantidade: c.quantidade ?? 0,
      });
      byKit.set(c.kitId, arr);
    }

    const data = kits.map(k => ({
      id: k.id,
      nome: k.nome,
      descricao: k.descricao,
      itens: byKit.get(k.id) ?? [],
    }));

    return NextResponse.json({ ok: true, data });
  } catch (err: any) {
    console.error('[GET /api/kits/list] Error:', err);
    return NextResponse.json({ ok: false, error: 'Erro ao listar kits.' }, { status: 500 });
  }
}
