export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Atualiza mínimo/máximo de um item em uma unidade específica.
 * Cria o registro de estoque se ainda não existir.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const unidadeIdRaw = (body?.unidadeId || '').toString().trim();
    const itemId = (body?.itemId || '').toString().trim();
    const minimoNum = Number(body?.minimo ?? 0);
    const maximoRaw = body?.maximo;
    const maximoNum = maximoRaw === null || maximoRaw === undefined || maximoRaw === '' ? null : Number(maximoRaw);

    if (!unidadeIdRaw || !itemId) {
      return NextResponse.json({ ok: false, error: 'unidadeId e itemId são obrigatórios' }, { status: 400 });
    }

    // unidadeId pode vir como id ou como nome/sigla
    let unidadeId = unidadeIdRaw;
    const unidadeRows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id FROM "Unidade"
        WHERE id = $1 OR UPPER(nome) = UPPER($1) OR UPPER(sigla) = UPPER($1)
        LIMIT 1`,
      unidadeIdRaw,
    );
    if (unidadeRows && unidadeRows.length > 0) {
      unidadeId = String(unidadeRows[0].id);
    }

    const minimo = Number.isFinite(minimoNum) && minimoNum >= 0 ? minimoNum : 0;
    const maximo = maximoNum !== null && Number.isFinite(maximoNum) && maximoNum >= 0 ? maximoNum : null;

    const estoque = await prisma.estoque.upsert({
      where: { unidadeId_itemId: { unidadeId, itemId } },
      update: { minimo, maximo },
      create: { unidadeId, itemId, quantidade: 0, minimo, maximo },
    } as any);

    return NextResponse.json({ ok: true, id: estoque.id });
  } catch (e: any) {
    console.error('Erro em /api/estoque/config', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erro interno' }, { status: 500 });
  }
}
