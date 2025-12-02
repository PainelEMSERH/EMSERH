
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

function normUnidKey(s: any): string {
  const raw = (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  const withoutStops = raw.replace(/\b(hospital|hosp|de|da|das|do|dos)\b/g, ' ');
  return withoutStops.replace(/[^a-z0-9]/gi, '');
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
    const unidadeKey = unidadeRaw ? normUnidKey(unidadeRaw) : '';

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

    const all: KitRow[] = [];
    const genericos: KitRow[] = [];
    const porUnidade: KitRow[] = [];

    for (const r of rows) {
      const fKey = normFuncKey(r.func);
      if (!fKey || fKey !== funcKey) continue;

      const site = String(r.site || '').trim();
      const siteKey = site ? normUnidKey(site) : '';

      const itemName = String(r.item || '').trim();
      if (!itemName) continue;

      const qtd = Number(r.qtd || 1) || 1;

      const base: KitRow = {
        item: itemName,
        quantidade: qtd,
        nome_site: site || null,
      };

      all.push(base);

      if (!siteKey) {
        genericos.push(base);
      } else if (unidadeKey && siteKey === unidadeKey) {
        porUnidade.push(base);
      }
    }

    let fonte: KitRow[];
    if (porUnidade.length > 0) {
      fonte = porUnidade;
    } else if (genericos.length > 0) {
      fonte = genericos;
    } else {
      fonte = all;
    }

    const byItem = new Map<string, KitRow>();

    for (const base of fonte) {
      const itemKey = normKey(base.item);
      const existing = byItem.get(itemKey);
      if (!existing) {
        byItem.set(itemKey, { ...base });
      } else {
        if (base.quantidade > existing.quantidade) {
          existing.quantidade = base.quantidade;
        }
        if (!existing.nome_site && base.nome_site) {
          existing.nome_site = base.nome_site;
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

