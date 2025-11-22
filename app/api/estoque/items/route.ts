// file: app/api/estoque/items/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import catalogo from '@/data/catalogo_sesmt.json';

type CatalogItem = {
  codigo_pa: string | null;
  descricao_cahosp: string | null;
  descricao_site: string | null;
  categoria_site: string | null;
  grupo_cahosp: string | null;
  unidade_site: string | null;
  tamanho_site: string | null;
  tamanho: string | null;
};

async function loadExtras(): Promise<CatalogItem[]> {
  try {
    // Garante tabela de extras (EPIs cadastrados via sistema)
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS catalogo_sesmt_extra (
        id TEXT PRIMARY KEY DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 24),
        codigo_pa TEXT NULL,
        descricao_cahosp TEXT NULL,
        descricao_site TEXT NULL,
        categoria_site TEXT NULL,
        grupo_cahosp TEXT NULL,
        unidade_site TEXT NULL,
        tamanho_site TEXT NULL,
        tamanho TEXT NULL,
        criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const rows: any[] = await prisma.$queryRawUnsafe(`
      SELECT codigo_pa,
             descricao_cahosp,
             descricao_site,
             categoria_site,
             grupo_cahosp,
             unidade_site,
             tamanho_site,
             tamanho
        FROM catalogo_sesmt_extra
       ORDER BY COALESCE(descricao_site, descricao_cahosp, codigo_pa)
    `);

    return (rows || []).map((r) => ({
      codigo_pa: r.codigo_pa ?? null,
      descricao_cahosp: r.descricao_cahosp ?? null,
      descricao_site: r.descricao_site ?? null,
      categoria_site: r.categoria_site ?? null,
      grupo_cahosp: r.grupo_cahosp ?? null,
      unidade_site: r.unidade_site ?? null,
      tamanho_site: r.tamanho_site ?? null,
      tamanho: r.tamanho ?? null,
    }));
  } catch (e) {
    console.error('Erro ao carregar extras do catálogo SESMT em /api/estoque/items', e);
    return [];
  }
}

export async function GET() {
  try {
    const base = (catalogo as CatalogItem[]) || [];
    const extras = await loadExtras();
    const all: CatalogItem[] = [...base, ...extras];

    // Mapa para evitar itens duplicados
    const byKey = new Map<string, string>();

    for (const it of all) {
      const codigo = (it.codigo_pa || '').trim();
      const descSite = (it.descricao_site || '').trim();
      const descCahosp = (it.descricao_cahosp || '').trim();

      const nome =
        descSite ||
        descCahosp ||
        (codigo ? `Item ${codigo}` : '');

      if (!nome) continue;

      // Usamos o próprio nome como "id" lógico.
      // A rota /api/estoque/mov se encarrega de criar/ligar isso à tabela Item real.
      if (!byKey.has(nome)) {
        byKey.set(nome, nome);
      }
    }

    const items = Array.from(byKey.entries()).map(([id, nome]) => ({
      id,
      nome,
    }));

    return NextResponse.json({ items });
  } catch (e: any) {
    console.error('Erro em /api/estoque/items', e);
    return NextResponse.json(
      { items: [], error: e?.message ?? 'Erro interno' },
      { status: 500 },
    );
  }
}
