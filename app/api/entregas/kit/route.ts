
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

type KitRow = { item: string; quantidade: number; nome_site: string | null };

function normKey(s: any): string {
  return (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function normFuncKey(s: any): string {
  const raw = (s ?? '').toString();
  const cleaned = raw.replace(/\(A\)/gi, '').replace(/\s+/g, ' ');
  return normKey(cleaned);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const funcaoRaw = (searchParams.get('funcao') || '').trim();
  const unidadeRaw = (searchParams.get('unidade') || '').trim();

  if (!funcaoRaw) {
    return NextResponse.json(
      { ok: false, error: 'função inválida' },
      { status: 400 },
    );
  }

  try {
    const funcKey = normFuncKey(funcaoRaw);
    const unidadeKey = unidadeRaw ? normKey(unidadeRaw) : '';

    if (!funcKey) {
      return NextResponse.json({ ok: true, items: [] });
    }

    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      SELECT
        COALESCE(alterdata_funcao::text, '') AS func,
        COALESCE(nome_site::text, '')        AS site,
        COALESCE(epi_item::text, '')         AS item,
        COALESCE(quantidade::numeric, 1)     AS qtd
      FROM stg_epi_map
      `
    );

    const byItem = new Map<string, KitRow>();

    for (const r of rows) {
      const fKey = normFuncKey(r.func);
      if (!fKey || fKey !== funcKey) continue;

      const site = String(r.site || '').trim();

      const itemName = String(r.item || '').trim();
      if (!itemName) continue;

      const itemKey = normKey(itemName);
      const qtd = Number(r.qtd || 1) || 1;

      const existing = byItem.get(itemKey);
      if (!existing) {
        byItem.set(itemKey, {
          item: itemName,
          quantidade: qtd,
          nome_site: site || null,
        });
      } else {
        if (qtd > existing.quantidade) {
          existing.quantidade = qtd;
        }
        if (!existing.nome_site && site) {
          existing.nome_site = site;
        }
      }
    }

    const items = Array.from(byItem.values()).sort((a, b) =>
      a.item.localeCompare(b.item, 'pt-BR')
    );

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    console.error('Error in /api/entregas/kit', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'erro' },
      { status: 500 },
    );
  }
}
