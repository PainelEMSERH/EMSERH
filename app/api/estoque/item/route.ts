// file: app/api/estoque/item/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

/**
 * Cria (ou reutiliza) um Item e opcionalmente já cria estoque para uma Unidade.
 * Espera receber nome, categoria, unidadeMedida e, opcionalmente, unidadeId (nome ou id) e quantidadeInicial.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const nomeRaw = (body?.nome || '').toString().trim();
    const categoriaRaw = (body?.categoria || '').toString().trim() || 'EPI';
    const unidadeMedidaRaw = (body?.unidadeMedida || '').toString().trim() || 'UN';
    const unidadeKeyRaw = (body?.unidadeId || '').toString().trim();
    const quantidadeInicialNum = Number(body?.quantidadeInicial ?? 0);

    if (!nomeRaw) {
      return NextResponse.json({ ok: false, error: 'Nome do item é obrigatório' }, { status: 400 });
    }

    const nome = nomeRaw;
    const categoria = categoriaRaw;
    const unidadeMedida = unidadeMedidaRaw;
    const quantidadeInicial = Number.isFinite(quantidadeInicialNum) && quantidadeInicialNum > 0
      ? Math.floor(quantidadeInicialNum)
      : 0;

    // Reutiliza item existente com mesmo nome/categoria, se houver
    let item = await prisma.item.findFirst({
      where: { nome, categoria },
    } as any);

    if (!item) {
      item = await prisma.item.create({
        data: {
          nome,
          categoria,
          unidadeMedida,
          ativo: true,
        },
      } as any);
    }

    let estoqueId: string | null = null;

    if (unidadeKeyRaw) {
      // unidadeId pode vir como id ou como nome/sigla
      const unidadeRows: any[] = await prisma.$queryRawUnsafe(
        `SELECT id FROM "Unidade"
          WHERE id = $1 OR UPPER(nome) = UPPER($1) OR UPPER(sigla) = UPPER($1)
          LIMIT 1`,
        unidadeKeyRaw,
      );
      if (!unidadeRows || unidadeRows.length === 0) {
        return NextResponse.json({ ok: false, error: 'Unidade não encontrada' }, { status: 400 });
      }
      const unidadeId = String(unidadeRows[0].id);

      // Garante um registro de estoque para essa unidade/item
      const existing: any[] = await prisma.$queryRawUnsafe(
        `SELECT id, quantidade FROM estoque WHERE "unidadeId" = $1 AND "itemId" = $2 LIMIT 1`,
        unidadeId,
        item.id,
      );
      if (existing && existing.length > 0) {
        const current = Number(existing[0].quantidade || 0);
        const novoSaldo = current + quantidadeInicial;
        const upd: any[] = await prisma.$queryRawUnsafe(
          `UPDATE estoque SET quantidade = $3 WHERE "unidadeId" = $1 AND "itemId" = $2 RETURNING id`,
          unidadeId,
          item.id,
          novoSaldo,
        );
        estoqueId = upd?.[0]?.id ? String(upd[0].id) : String(existing[0].id);
      } else {
        const ins: any[] = await prisma.$queryRawUnsafe(
          `INSERT INTO estoque ("unidadeId","itemId",quantidade,minimo,maximo)
           VALUES ($1,$2,$3,0,NULL)
           RETURNING id`,
          unidadeId,
          item.id,
          quantidadeInicial,
        );
        estoqueId = ins?.[0]?.id ? String(ins[0].id) : null;
      }
    }

    return NextResponse.json({
      ok: true,
      itemId: item.id,
      estoqueId,
    });
  } catch (e: any) {
    console.error('Erro em /api/estoque/item', e);
    return NextResponse.json({ ok: false, error: e?.message ?? 'Erro interno' }, { status: 500 });
  }
}
