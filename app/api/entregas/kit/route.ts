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


function normUnidKey(s: any): string {
  const raw = (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // remove palavras genéricas para aproximar variações de nome de unidade
  const noStops = raw.replace(/\b(hospital|hosp|de|da|das|do|dos)\b/g, ' ');
  return noStops.replace(/[^a-z0-9]/gi, '');
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
    const unidadeKey = unidadeRaw ? normUnidKey(unidadeRaw) : '';

    if (!funcKey) {
      return NextResponse.json({ ok: true, items: [] });
    }

    // Lê toda a base de mapeamento de EPI.
    // Usamos unidade_hospitalar quando disponível; se vier vazio,
    // caímos para nome_site apenas para compatibilidade.
    const rows: any[] = await prisma.$queryRawUnsafe(
      `
      SELECT
        COALESCE(alterdata_funcao::text, '')      AS func,
        COALESCE(unidade_hospitalar::text, '')   AS unidade,
        COALESCE(nome_site::text, '')            AS nome_site,
        COALESCE(epi_item::text, '')             AS item,
        COALESCE(quantidade::numeric, 1)         AS qtd
      FROM stg_epi_map
      `,
    );

    const all: KitRow[] = [];
    const porUnidade: KitRow[] = [];
    const genericos: KitRow[] = [];

    for (const r of rows) {
      const fKey = normFuncKey(r.func);
      if (!fKey || fKey !== funcKey) continue;

      const unidadeBase = String(r.unidade || '').trim() || String(r.nome_site || '').trim();
      const unidadeBaseKey = unidadeBase ? normUnidKey(unidadeBase) : '';

      const itemName = String(r.item || '').trim();
      if (!itemName) continue;

      const qtd = Number(r.qtd || 1) || 1;

      const base: KitRow = {
        item: itemName,
        quantidade: qtd,
        nome_site: unidadeBase || null,
      };

      all.push(base);

      // Mapeamento específico da unidade (função + unidade)
      if (unidadeKey && unidadeBaseKey && unidadeBaseKey === unidadeKey) {
        porUnidade.push(base);
      } else if (!unidadeBaseKey) {
        // Linhas genéricas (sem unidade definida) ficam como fallback.
        genericos.push(base);
      }
    }

    let fonte: KitRow[];

    // 1) Se existir kit mapeado exatamente para Função + Unidade, usa ele.
    if (porUnidade.length > 0) {
      fonte = porUnidade;
    } else if (genericos.length > 0) {
      // 2) Senão, usa apenas linhas genéricas da função.
      fonte = genericos;
    } else {
      // 3) Último recurso: qualquer linha da função, independente da unidade.
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
      a.item.localeCompare(b.item, 'pt-BR'),
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
